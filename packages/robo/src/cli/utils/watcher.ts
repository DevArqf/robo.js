import { promises as fs, watch, FSWatcher } from 'node:fs'
import path from 'node:path'
import { logger } from '../../core/logger.js'
import { hasProperties } from './utils.js'

// Defining the possible values for file changes.
export type ChangeType = 'added' | 'removed' | 'changed'

export interface Change {
	changeType: ChangeType
	filePath: string
}

// The interface for options parameter allowing to exclude certain directories.
interface Options {
	exclude?: string[]
	/**
	 * Debounce window in milliseconds for batching changes.
	 * Defaults to 100ms.
	 */
	debounceMs?: number
	/**
	 * Prefer native recursive watching (macOS/Windows). When `false`,
	 * Robo falls back to watching directories individually.
	 *
	 * Defaults to `true` on macOS/Windows and `false` elsewhere.
	 */
	recursive?: boolean
	/**
	 * Follow symlinks when scanning directories (default: true).
	 */
	followSymlinks?: boolean
	/**
	 * Poll for changes instead of using `fs.watch`. Set to a number > 0 to enable.
	 * This is a reliability fallback for environments that can't create watchers (e.g. EMFILE).
	 */
	pollIntervalMs?: number
}

interface FileEntry {
	kind: 'file'
	mtimeMs: number
	size: number
	ino: number
}

interface DirEntry {
	kind: 'dir'
}

type SnapshotEntry = FileEntry | DirEntry

type ChangeCallback = (changes: Change[]) => void | Promise<void>

const DEFAULT_DEBOUNCE_MS = 100
const DEFAULT_STAT_CONCURRENCY = 32
const DEFAULT_POLL_INTERVAL_MS = 250

function normalizeForMatch(input: string): string {
	return input.replaceAll('\\', '/').replace(/\/+$/, '')
}

function isPlatformRecursiveWatchSupported(): boolean {
	// Node's recursive fs.watch is supported on macOS/Windows.
	return process.platform === 'darwin' || process.platform === 'win32'
}

function isWatcherResourceError(error: unknown): boolean {
	if (!hasProperties<{ code: unknown }>(error, ['code'])) return false
	return error.code === 'EMFILE' || error.code === 'ENFILE' || error.code === 'ENOSPC'
}

function mergeChange(existing: Change | undefined, next: Change): Change {
	if (!existing) return next
	if (existing.changeType === next.changeType) return next

	// If something was removed and then re-added quickly, treat it like a change.
	if (existing.changeType === 'removed' && next.changeType === 'added') {
		return { changeType: 'changed', filePath: next.filePath }
	}

	// Removals win over everything else.
	if (next.changeType === 'removed') return next
	if (existing.changeType === 'removed') return existing

	// Preserve "added" when the next event is just a follow-up "changed".
	if (existing.changeType === 'added' && next.changeType === 'changed') return existing

	// Otherwise last meaningful event wins.
	return next
}

// Watcher class will monitor files and directories for changes.
export default class Watcher {
	private watchers = new Map<string, FSWatcher>()
	private watchedDirs = new Set<string>()
	private watchedFiles = new Set<string>()

	private snapshot = new Map<string, SnapshotEntry>()
	private rootDirs: string[] = []
	private rootFiles: string[] = []
	private absoluteOutputRootDirs = new Set<string>()
	private absoluteOutputRootFiles = new Set<string>()

	private excludeExact = new Set<string>()
	private excludeBasenames = new Set<string>()
	private excludePrefixes: string[] = []

	private started = false
	private stopped = false
	private processing = false
	private needsProcessing = false

	private debounceMs = DEFAULT_DEBOUNCE_MS
	private useRecursive = false
	private followSymlinks = true
	private recursiveRoots = new Set<string>()
	private pollingIntervalMs: number | null = null
	private pollingTimer: NodeJS.Timeout | null = null
	private watchingEnabled = true

	private callback?: ChangeCallback

	private pendingPaths = new Set<string>()
	private pendingDirs = new Set<string>()
	private pendingTimer: NodeJS.Timeout | null = null
	private fullRescanRequested = false

	constructor(private paths: string[], private options: Options) {}

	async start(callback: (changes: Change[]) => Promise<void>) {
		if (this.started) {
			throw new Error('Watcher already started')
		}

		this.callback = callback
		this.stopped = false
		this.started = false

		this.debounceMs = this.options.debounceMs ?? DEFAULT_DEBOUNCE_MS
		this.followSymlinks = this.options.followSymlinks ?? true
		this.useRecursive = this.options.recursive ?? isPlatformRecursiveWatchSupported()
		this.pollingIntervalMs = typeof this.options.pollIntervalMs === 'number' ? this.options.pollIntervalMs : null
		this.watchingEnabled = !(this.pollingIntervalMs && this.pollingIntervalMs > 0)

		this.compileExcludes(this.options.exclude ?? [])

		await this.buildRoots()
		await this.buildInitialSnapshot()

		if (this.watchingEnabled) {
			await this.createWatchers()
		} else {
			this.startPolling(this.pollingIntervalMs ?? DEFAULT_POLL_INTERVAL_MS)
		}

		// Only start reacting after we have a stable snapshot.
		this.started = true
	}

	stop() {
		this.stopped = true
		this.started = false

		if (this.pendingTimer) {
			clearTimeout(this.pendingTimer)
			this.pendingTimer = null
		}

		if (this.pollingTimer) {
			clearInterval(this.pollingTimer)
			this.pollingTimer = null
		}

		this.watchers.forEach((watcher) => watcher.close())
		this.watchers.clear()
		this.watchedDirs.clear()
		this.watchedFiles.clear()
		this.recursiveRoots.clear()

		this.snapshot.clear()
		this.rootDirs = []
		this.rootFiles = []
		this.absoluteOutputRootDirs.clear()
		this.absoluteOutputRootFiles.clear()

		this.pendingPaths.clear()
		this.pendingDirs.clear()
		this.fullRescanRequested = false
	}

	private startPolling(intervalMs: number) {
		if (this.pollingTimer) return

		const effectiveInterval = Math.max(25, intervalMs)
		this.pollingTimer = setInterval(() => {
			if (this.stopped) return
			this.fullRescanRequested = true
			void this.processPending()
		}, effectiveInterval)
	}

	private enablePollingFallback(reason?: unknown) {
		if (this.stopped || !this.watchingEnabled) return

		this.watchingEnabled = false
		if (!this.pollingIntervalMs || this.pollingIntervalMs <= 0) {
			this.pollingIntervalMs = DEFAULT_POLL_INTERVAL_MS
		}

		logger.debug('Falling back to polling watcher mode')
		if (reason) {
			logger.debug('', reason)
		}

		// Stop all native watchers
		this.watchers.forEach((watcher) => watcher.close())
		this.watchers.clear()
		this.watchedDirs.clear()
		this.watchedFiles.clear()
		this.recursiveRoots.clear()

		this.startPolling(this.pollingIntervalMs)
	}

	private compileExcludes(exclude: string[]) {
		this.excludeExact.clear()
		this.excludeBasenames.clear()
		this.excludePrefixes = []

		for (const entry of exclude) {
			const normalized = normalizeForMatch(path.normalize(entry))
			this.excludeExact.add(normalized)

			const normalizedRaw = normalizeForMatch(entry)
			const hasSeparator = normalizedRaw.includes('/') || normalizedRaw.includes('\\')
			if (hasSeparator) {
				this.excludePrefixes.push(normalized)
				continue
			}

			if (normalized.length > 0) {
				this.excludeBasenames.add(normalized)
			}
		}
	}

	private isExcluded(absPath: string, kind: 'file' | 'dir'): boolean {
		const absNorm = normalizeForMatch(path.normalize(absPath))
		const relNorm = normalizeForMatch(path.normalize(path.relative(process.cwd(), absPath)))

		// Exact path exclusions always apply.
		if (this.excludeExact.has(absNorm) || this.excludeExact.has(relNorm)) {
			return true
		}

		// Prefix exclusions (relative or absolute).
		for (const prefix of this.excludePrefixes) {
			if (relNorm === prefix || relNorm.startsWith(prefix + '/')) return true
			if (absNorm === prefix || absNorm.startsWith(prefix + '/')) return true
		}

		// Basename exclusions match legacy behavior: directories are excluded by name,
		// files are only excluded by exact path/prefix.
		if (kind === 'dir') {
			const base = absNorm.split('/').pop() ?? absNorm
			return this.excludeBasenames.has(base)
		}

		return false
	}

	private async buildRoots() {
		this.rootDirs = []
		this.rootFiles = []
		this.absoluteOutputRootDirs.clear()
		this.absoluteOutputRootFiles.clear()

		for (const inputPath of this.paths) {
			const outputAbsolute = path.isAbsolute(inputPath)
			const absPath = path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath)
			const stats = await this.safeStat(absPath, { followSymlinks: this.followSymlinks })

			if (!stats) {
				throw new Error(`Watcher path does not exist: ${inputPath}`)
			}

			if (stats.isDirectory()) {
				if (this.isExcluded(absPath, 'dir')) continue
				this.rootDirs.push(absPath)
				if (outputAbsolute) {
					this.absoluteOutputRootDirs.add(absPath)
				}
			} else if (stats.isFile()) {
				// Root files are only excluded by exact path.
				if (this.isExcluded(absPath, 'file')) continue
				this.rootFiles.push(absPath)
				if (outputAbsolute) {
					this.absoluteOutputRootFiles.add(absPath)
				}
			}
		}
	}

	private async buildInitialSnapshot() {
		this.snapshot.clear()

		// Track visited realpaths to avoid symlink cycles when followSymlinks=true.
		const visitedRealDirs = new Set<string>()

		for (const rootDir of this.rootDirs) {
			await this.scanDirectoryTree(rootDir, visitedRealDirs)
		}

		const fileEntries = await this.statFiles(this.rootFiles)
		for (const entry of fileEntries) {
			this.snapshot.set(entry.path, entry.entry)
		}
	}

	private async createWatchers() {
		// Watch directories
		if (this.useRecursive) {
			let failed = false
			for (const rootDir of this.rootDirs) {
				const ok = this.createDirWatcher(rootDir, true)
				if (!ok) failed = true
			}

			// If recursive watching isn't available (or fails), fall back to per-directory watchers.
			if (failed) {
				this.watchers.forEach((watcher) => watcher.close())
				this.watchers.clear()
				this.watchedDirs.clear()
				this.watchedFiles.clear()
				this.recursiveRoots.clear()

				this.useRecursive = false

				for (const [absPath, entry] of this.snapshot.entries()) {
					if (entry.kind !== 'dir') continue
					this.createDirWatcher(absPath, false)
				}
			}
		} else {
			for (const [absPath, entry] of this.snapshot.entries()) {
				if (entry.kind !== 'dir') continue
				this.createDirWatcher(absPath, false)
			}
		}

		// Watch explicit root files
		for (const rootFile of this.rootFiles) {
			this.createFileWatcher(rootFile)
		}
	}

	private createDirWatcher(dirAbs: string, recursive: boolean): boolean {
		if (!this.watchingEnabled) return false
		if (this.watchers.has(dirAbs)) return true

		try {
			const watcher = watch(
				dirAbs,
				recursive ? { recursive: true } : {},
				(eventType, filename) => {
					this.onWatchEvent(dirAbs, eventType, filename)
				}
			)

			watcher.on('error', (error) => {
				logger.debug(`Watcher error for directory: ${dirAbs}`)
				logger.debug('', error)
				if (isWatcherResourceError(error)) {
					this.enablePollingFallback(error)
				}
			})

			this.watchers.set(dirAbs, watcher)
			this.watchedDirs.add(dirAbs)
			if (recursive) {
				this.recursiveRoots.add(dirAbs)
			}
			return true
		} catch (error) {
			logger.debug(`Failed to watch directory: ${dirAbs}`)
			logger.debug('', error)
			if (isWatcherResourceError(error)) {
				this.enablePollingFallback(error)
			}
			return false
		}
	}

	private createFileWatcher(fileAbs: string): boolean {
		if (!this.watchingEnabled) return false
		if (this.watchers.has(fileAbs)) return true

		try {
			const watcher = watch(fileAbs, (eventType) => {
				this.onWatchEvent(fileAbs, eventType)
			})

			watcher.on('error', (error) => {
				logger.debug(`Watcher error for file: ${fileAbs}`)
				logger.debug('', error)
				if (isWatcherResourceError(error)) {
					this.enablePollingFallback(error)
				}
			})

			this.watchers.set(fileAbs, watcher)
			this.watchedFiles.add(fileAbs)
			return true
		} catch (error) {
			logger.debug(`Failed to watch file: ${fileAbs}`)
			logger.debug('', error)
			if (isWatcherResourceError(error)) {
				this.enablePollingFallback(error)
			}
			return false
		}
	}

	private onWatchEvent(watchedPath: string, eventType: string, filename?: string | Buffer) {
		if (this.stopped || !this.started) return

		try {
			if (this.watchedFiles.has(watchedPath)) {
				this.pendingPaths.add(watchedPath)
				this.scheduleProcessing()
				return
			}

			const name = typeof filename === 'string' ? filename : filename ? filename.toString() : undefined
			if (!name) {
				this.fullRescanRequested = true
				this.scheduleProcessing()
				return
			}

			const normalizedName = normalizeForMatch(name)
			if (this.recursiveRoots.has(watchedPath)) {
				const parts = normalizedName.split('/')
				for (const part of parts) {
					if (this.excludeBasenames.has(part)) {
						return
					}
				}
			}

			const fullPath = path.join(watchedPath, name)
			if (this.isExcluded(fullPath, 'file')) {
				return
			}

			this.pendingPaths.add(fullPath)

			// Rename events are ambiguous across platforms; rescan the containing directory
			// so we can detect both additions and removals.
			if (eventType === 'rename') {
				this.pendingDirs.add(path.dirname(fullPath))
			}

			this.scheduleProcessing()
		} catch (error) {
			logger.debug(`Failed to handle watcher event for: ${watchedPath}`)
			logger.debug('', error)
		}
	}

	private scheduleProcessing() {
		if (this.pendingTimer) {
			clearTimeout(this.pendingTimer)
		}

		this.pendingTimer = setTimeout(() => {
			void this.processPending()
		}, this.debounceMs)
	}

	private async processPending() {
		if (this.stopped) return
		if (this.processing) {
			this.needsProcessing = true
			return
		}

		if (this.pendingTimer) {
			clearTimeout(this.pendingTimer)
			this.pendingTimer = null
		}

		this.processing = true

		try {
			const changes = new Map<string, Change>()

			if (this.fullRescanRequested) {
				this.fullRescanRequested = false
				this.pendingDirs.clear()
				this.pendingPaths.clear()
				await this.fullRescan(changes)
			} else {
				const dirs = Array.from(this.pendingDirs)
				const paths = Array.from(this.pendingPaths)
				this.pendingDirs.clear()
				this.pendingPaths.clear()

				for (const dirAbs of dirs) {
					await this.reconcileDirectory(dirAbs, changes)
				}

				for (const absPath of paths) {
					await this.reconcilePath(absPath, changes)
				}
			}

			if (changes.size > 0) {
				const payload = Array.from(changes.values()).sort((a, b) => a.filePath.localeCompare(b.filePath))
				await this.invokeCallback(payload)
			}
		} finally {
			this.processing = false

			if (this.needsProcessing) {
				this.needsProcessing = false
				// If events arrived while processing, run again quickly.
				this.scheduleProcessing()
			}
		}
	}

	private async invokeCallback(changes: Change[]) {
		if (!this.callback || this.stopped) return

		try {
			await this.callback(changes)
		} catch (error) {
			logger.debug('Watcher callback threw an error')
			logger.debug('', error)
		}
	}

	private recordChange(changes: Map<string, Change>, changeType: ChangeType, absPath: string) {
		const filePath = this.toOutputPath(absPath)
		const next: Change = { changeType, filePath }
		const existing = changes.get(filePath)
		changes.set(filePath, mergeChange(existing, next))
	}

	private toOutputPath(absPath: string): string {
		// Preserve old behavior: relative roots yield relative file paths, absolute roots yield absolute file paths.
		const isUnderAbsoluteRoot = this.rootDirs.some(
			(dir) => this.absoluteOutputRootDirs.has(dir) && (absPath === dir || absPath.startsWith(dir + path.sep))
		)
		const isAbsoluteRootFile = this.absoluteOutputRootFiles.has(absPath)

		if (isUnderAbsoluteRoot || isAbsoluteRootFile) {
			return absPath
		}

		return path.relative(process.cwd(), absPath)
	}

	private async fullRescan(changes: Map<string, Change>) {
		const nextSnapshot = new Map<string, SnapshotEntry>()
		const visitedRealDirs = new Set<string>()

		for (const rootDir of this.rootDirs) {
			await this.scanDirectoryTree(rootDir, visitedRealDirs, nextSnapshot)
		}

		const fileEntries = await this.statFiles(this.rootFiles)
		for (const entry of fileEntries) {
			nextSnapshot.set(entry.path, entry.entry)
		}

		// Diff old -> new
		for (const [absPath, oldEntry] of this.snapshot.entries()) {
			const newEntry = nextSnapshot.get(absPath)
			if (!newEntry) {
				this.recordChange(changes, 'removed', absPath)
				continue
			}

			if (oldEntry.kind !== newEntry.kind) {
				this.recordChange(changes, 'removed', absPath)
				this.recordChange(changes, 'added', absPath)
				continue
			}

			if (oldEntry.kind === 'file' && newEntry.kind === 'file') {
				if (oldEntry.mtimeMs !== newEntry.mtimeMs || oldEntry.size !== newEntry.size || oldEntry.ino !== newEntry.ino) {
					this.recordChange(changes, 'changed', absPath)
				}
			}
		}

		for (const [absPath] of nextSnapshot.entries()) {
			if (!this.snapshot.has(absPath)) {
				this.recordChange(changes, 'added', absPath)
			}
		}

		// Swap snapshot
		this.snapshot = nextSnapshot

		// Keep directory watchers in sync when not using recursive mode.
		if (this.watchingEnabled && !this.useRecursive) {
			// Close watchers for directories that no longer exist
			for (const dirAbs of Array.from(this.watchedDirs)) {
				const entry = this.snapshot.get(dirAbs)
				if (!entry || entry.kind !== 'dir') {
					const watcher = this.watchers.get(dirAbs)
					if (watcher) watcher.close()
					this.watchers.delete(dirAbs)
					this.watchedDirs.delete(dirAbs)
				}
			}

			// Add watchers for newly discovered directories
			for (const [absPath, entry] of this.snapshot.entries()) {
				if (entry.kind !== 'dir') continue
				this.createDirWatcher(absPath, false)
			}
		}
	}

	private async reconcileDirectory(dirAbs: string, changes: Map<string, Change>) {
		// If this directory no longer exists, remove it and all known children.
		const stats = await this.safeStat(dirAbs, { followSymlinks: this.followSymlinks })
		if (!stats) {
			this.removeSubtree(dirAbs, changes)
			return
		}

		if (!stats.isDirectory()) {
			await this.reconcilePath(dirAbs, changes)
			return
		}

		if (this.isExcluded(dirAbs, 'dir')) return

		// Ensure directory itself is tracked.
			if (!this.snapshot.has(dirAbs)) {
				this.snapshot.set(dirAbs, { kind: 'dir' })
				this.recordChange(changes, 'added', dirAbs)
				if (this.watchingEnabled && !this.useRecursive) {
					this.createDirWatcher(dirAbs, false)
				}
			}

		let entries
		try {
			entries = await fs.readdir(dirAbs, { withFileTypes: true })
		} catch (error) {
			if (hasProperties<{ code: unknown }>(error, ['code']) && error.code === 'ENOENT') {
				this.removeSubtree(dirAbs, changes)
				return
			}
			logger.debug(`Failed to read directory: ${dirAbs}`)
			logger.debug('', error)
			return
		}

		const seen = new Set<string>()

		for (const dirent of entries) {
			const childAbs = path.join(dirAbs, dirent.name)

			if (this.isExcluded(childAbs, dirent.isDirectory() ? 'dir' : 'file')) {
				continue
			}

			if (dirent.isDirectory()) {
				seen.add(childAbs)
				if (!this.snapshot.has(childAbs)) {
					await this.addDirectoryTree(childAbs, changes)
				}
				continue
			}

			if (dirent.isFile()) {
				seen.add(childAbs)
				if (!this.snapshot.has(childAbs)) {
					const entry = await this.safeFileEntry(childAbs)
					if (entry) {
						this.snapshot.set(childAbs, entry)
						this.recordChange(changes, 'added', childAbs)
					}
				}
				continue
			}

			if (dirent.isSymbolicLink() && this.followSymlinks) {
				const targetStats = await this.safeStat(childAbs, { followSymlinks: true })
				if (!targetStats) continue
				seen.add(childAbs)
				if (targetStats.isDirectory()) {
					if (!this.snapshot.has(childAbs)) {
						await this.addDirectoryTree(childAbs, changes)
					}
				} else if (targetStats.isFile()) {
					if (!this.snapshot.has(childAbs)) {
						const entry = await this.safeFileEntry(childAbs)
						if (entry) {
							this.snapshot.set(childAbs, entry)
							this.recordChange(changes, 'added', childAbs)
						}
					}
				}
			}
		}

		// Detect removals among direct children that we were tracking.
		const missing: Array<{ absPath: string; entry: SnapshotEntry }> = []
		for (const [absPath, entry] of this.snapshot.entries()) {
			if (!absPath.startsWith(dirAbs + path.sep)) continue
			if (path.dirname(absPath) !== dirAbs) continue
			if (!seen.has(absPath)) {
				missing.push({ absPath, entry })
			}
		}

		for (const item of missing) {
			if (item.entry.kind === 'dir') {
				this.removeSubtree(item.absPath, changes)
			} else {
				this.snapshot.delete(item.absPath)
				this.recordChange(changes, 'removed', item.absPath)
			}
		}
	}

	private async reconcilePath(absPath: string, changes: Map<string, Change>) {
		if (this.isExcluded(absPath, 'file')) return

		const stats = await this.safeStat(absPath, { followSymlinks: this.followSymlinks })
		if (!stats) {
			const existing = this.snapshot.get(absPath)
			if (!existing) return

			if (existing.kind === 'dir') {
				this.removeSubtree(absPath, changes)
			} else {
				this.snapshot.delete(absPath)
				this.recordChange(changes, 'removed', absPath)
			}
			return
		}

		if (stats.isDirectory()) {
			// A directory appeared where we might not have been tracking it yet.
			if (!this.snapshot.has(absPath)) {
				await this.addDirectoryTree(absPath, changes)
			}
			return
		}

		if (!stats.isFile()) return

		const next: FileEntry = {
			kind: 'file',
			mtimeMs: stats.mtimeMs,
			size: stats.size,
			ino: stats.ino
		}

		const prev = this.snapshot.get(absPath)
		if (!prev) {
			this.snapshot.set(absPath, next)
			this.recordChange(changes, 'added', absPath)
			return
		}

		if (prev.kind !== 'file') {
			this.removeSubtree(absPath, changes)
			this.snapshot.set(absPath, next)
			this.recordChange(changes, 'added', absPath)
			return
		}

		if (prev.mtimeMs !== next.mtimeMs || prev.size !== next.size || prev.ino !== next.ino) {
			this.snapshot.set(absPath, next)
			this.recordChange(changes, 'changed', absPath)
		}
	}

	private removeSubtree(rootAbs: string, changes: Map<string, Change>) {
		// Remove known files/dirs under this subtree (including the root itself).
		for (const [absPath] of Array.from(this.snapshot.entries())) {
			if (absPath === rootAbs || absPath.startsWith(rootAbs + path.sep)) {
				this.snapshot.delete(absPath)
				this.recordChange(changes, 'removed', absPath)
			}
		}

		// Close directory watchers when not using recursive mode.
		if (this.watchingEnabled && !this.useRecursive) {
			for (const dirAbs of Array.from(this.watchedDirs)) {
				if (dirAbs === rootAbs || dirAbs.startsWith(rootAbs + path.sep)) {
					const watcher = this.watchers.get(dirAbs)
					if (watcher) watcher.close()
					this.watchers.delete(dirAbs)
					this.watchedDirs.delete(dirAbs)
				}
			}
		}
	}

	private async addDirectoryTree(dirAbs: string, changes: Map<string, Change>) {
		if (this.isExcluded(dirAbs, 'dir')) return

		if (!this.snapshot.has(dirAbs)) {
			this.snapshot.set(dirAbs, { kind: 'dir' })
			this.recordChange(changes, 'added', dirAbs)
		}

		if (this.watchingEnabled && !this.useRecursive) {
			this.createDirWatcher(dirAbs, false)
		}

		// Scan the new directory so we don't miss pre-existing content moved into place.
		const visitedRealDirs = new Set<string>()
		await this.scanDirectoryTree(dirAbs, visitedRealDirs, this.snapshot, changes)
	}

	private async scanDirectoryTree(
		rootDirAbs: string,
		visitedRealDirs: Set<string>,
		targetSnapshot: Map<string, SnapshotEntry> = this.snapshot,
		recordInto?: Map<string, Change>
	) {
		const stack: string[] = [rootDirAbs]

		while (stack.length > 0) {
			const dirAbs = stack.pop()
			if (!dirAbs) continue

			if (this.isExcluded(dirAbs, 'dir')) continue

			const stats = await this.safeStat(dirAbs, { followSymlinks: this.followSymlinks })
				if (!stats || !stats.isDirectory()) continue

				if (this.followSymlinks) {
					let real: string | null = null
					try {
						real = await fs.realpath(dirAbs)
					} catch {
						real = null
					}
					if (real) {
						const realNorm = normalizeForMatch(path.normalize(real))
						if (visitedRealDirs.has(realNorm)) continue
						visitedRealDirs.add(realNorm)
					}
			}

			if (!targetSnapshot.has(dirAbs)) {
				targetSnapshot.set(dirAbs, { kind: 'dir' })
				if (recordInto) {
					this.recordChange(recordInto, 'added', dirAbs)
				}
			}

			let dirents
			try {
				dirents = await fs.readdir(dirAbs, { withFileTypes: true })
			} catch (error) {
				if (hasProperties<{ code: unknown }>(error, ['code']) && error.code === 'ENOENT') {
					continue
				}
				logger.debug(`Failed to read directory: ${dirAbs}`)
				logger.debug('', error)
				continue
			}

			const fileCandidates: string[] = []

			for (const dirent of dirents) {
				const childAbs = path.join(dirAbs, dirent.name)

				if (this.isExcluded(childAbs, dirent.isDirectory() ? 'dir' : 'file')) {
					continue
				}

				if (dirent.isDirectory()) {
					stack.push(childAbs)
					continue
				}

				if (dirent.isFile()) {
					fileCandidates.push(childAbs)
					continue
				}

				if (dirent.isSymbolicLink() && this.followSymlinks) {
					const targetStats = await this.safeStat(childAbs, { followSymlinks: true })
					if (!targetStats) continue
					if (targetStats.isDirectory()) {
						stack.push(childAbs)
					} else if (targetStats.isFile()) {
						fileCandidates.push(childAbs)
					}
				}
			}

			const fileEntries = await this.statFiles(fileCandidates)
			for (const entry of fileEntries) {
				if (!targetSnapshot.has(entry.path)) {
					targetSnapshot.set(entry.path, entry.entry)
					if (recordInto) {
						this.recordChange(recordInto, 'added', entry.path)
					}
				}
			}

			// In non-recursive mode, ensure we watch all directories we discover.
			if (this.watchingEnabled && !this.useRecursive) {
				this.createDirWatcher(dirAbs, false)
			}
		}
	}

	private async safeStat(absPath: string, options: { followSymlinks: boolean }) {
		try {
			return options.followSymlinks ? await fs.stat(absPath) : await fs.lstat(absPath)
		} catch (error) {
			if (hasProperties<{ code: unknown }>(error, ['code']) && error.code === 'ENOENT') return null

			logger.debug(`Failed to stat path: ${absPath}`)
			logger.debug('', error)
			return null
		}
	}

	private async safeFileEntry(fileAbs: string): Promise<FileEntry | null> {
		const stats = await this.safeStat(fileAbs, { followSymlinks: this.followSymlinks })

		if (!stats || !stats.isFile()) return null

		return {
			kind: 'file',
			mtimeMs: stats.mtimeMs,
			size: stats.size,
			ino: stats.ino
		}
	}

	private async statFiles(filePaths: string[]): Promise<Array<{ path: string; entry: FileEntry }>> {
		if (filePaths.length === 0) return []

		const results: Array<{ path: string; entry: FileEntry }> = []
		let index = 0
		const concurrency = Math.min(DEFAULT_STAT_CONCURRENCY, filePaths.length)

		const workers = new Array(concurrency).fill(null).map(async () => {
			while (index < filePaths.length) {
				const i = index++
				const fileAbs = filePaths[i]

				const entry = await this.safeFileEntry(fileAbs)
				if (entry) {
					results.push({ path: fileAbs, entry })
				}
			}
		})

		await Promise.all(workers)
		return results
	}
}
