/**
 * WebContainer ExecutionProvider implementation for @robojs/code SDK
 *
 * Primary provider for browser environments using StackBlitz WebContainers.
 * Provides filesystem operations and command execution in the browser.
 *
 * Key constraints:
 * - Combined stdout/stderr output (WebContainer limitation)
 * - No shell interpolation - command + args only
 * - Requires @webcontainer/api package
 */

import type { ExecutionProvider } from '../../types/execution.js'
import type {
	DirEntry,
	FileStat,
	RunOptions,
	RunResult,
	SearchOptions,
	SearchResult,
	SnapshotOptions,
	TerminalChunk,
	TerminalSessionHandle
} from '../../types/terminal.js'
import { CodeAgentError } from '../../errors/index.js'
import { validatePathWithPolicy, normalizePath, matchesDenyPath } from '../utils/path.js'
import { TerminalBufferManager, type TruncationEvent } from '../utils/buffer.js'
import { codeLogger } from '../../core/logger.js'

/**
 * WebContainer types - imported dynamically to support optional peer dependency
 */
interface WebContainerFS {
	readFile(path: string, encoding: 'utf-8'): Promise<string>
	readFile(path: string): Promise<Uint8Array>
	writeFile(path: string, data: string | Uint8Array, options?: { encoding?: string }): Promise<void>
	rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>
	readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirEntryLike[]>
	mkdir(path: string, options?: { recursive?: boolean }): Promise<void>
}

interface DirEntryLike {
	name: string
	isDirectory(): boolean
	isFile(): boolean
}

interface WebContainerProcess {
	output: ReadableStream<string>
	exit: Promise<number>
	kill(): void
}

interface WebContainerSpawnOptions {
	cwd?: string
	env?: Record<string, string>
	terminal?: { cols: number; rows: number }
}

interface WebContainerInstance {
	fs: WebContainerFS
	spawn(command: string, args?: string[], options?: WebContainerSpawnOptions): Promise<WebContainerProcess>
	on(event: 'server-ready', callback: (port: number, url: string) => void): void
	on(event: 'error', callback: (error: Error) => void): void
	on(event: 'port', callback: (port: number, type: 'open' | 'close', url: string) => void): void
	mount(tree: Record<string, unknown>): Promise<void>
	teardown(): void
}

/**
 * Configuration for WebContainerProvider
 */
export interface WebContainerProviderConfig {
	/**
	 * WebContainer instance to use
	 * Must be booted before passing to provider
	 */
	container: WebContainerInstance

	/**
	 * Root directory within the container for file operations
	 * Defaults to '/'
	 */
	rootDir?: string

	/**
	 * Paths to deny access to
	 */
	denyPaths?: string[]

	/**
	 * Maximum bytes to buffer from terminal output
	 */
	maxBufferedTerminalBytes?: number

	/**
	 * Callback for truncation events
	 */
	onTruncate?: (event: TruncationEvent) => void
}

/**
 * Internal session state
 */
interface SessionState {
	handle: TerminalSessionHandle
	process: WebContainerProcess
	aborted: boolean
	exitCode: number | null
	outputReader: ReadableStreamDefaultReader<string> | null
}

/**
 * WebContainer implementation of ExecutionProvider
 */
export class WebContainerProvider implements ExecutionProvider {
	private readonly container: WebContainerInstance
	private readonly rootDir: string
	private readonly denyPaths: string[]
	private readonly maxBufferedTerminalBytes: number
	private readonly bufferManager: TerminalBufferManager
	private readonly sessions: Map<string, SessionState> = new Map()
	private sessionCounter: number = 0

	constructor(config: WebContainerProviderConfig) {
		this.container = config.container
		this.rootDir = normalizePath(config.rootDir || '/')
		this.denyPaths = config.denyPaths || []
		this.maxBufferedTerminalBytes = config.maxBufferedTerminalBytes || 5_000_000
		this.bufferManager = new TerminalBufferManager(this.maxBufferedTerminalBytes, config.onTruncate)
	}

	/**
	 * Resolve a virtual path to an absolute container path
	 */
	private resolvePath(virtualPath: string): string {
		const normalized = validatePathWithPolicy(virtualPath, this.denyPaths)
		// Join with root directory
		if (this.rootDir === '/') {
			return normalized
		}
		const relativePath = normalized.startsWith('/') ? normalized.slice(1) : normalized
		return normalizePath(this.rootDir + '/' + relativePath)
	}

	/**
	 * Convert an absolute container path back to a virtual path
	 */
	private toVirtualPath(absolutePath: string): string {
		const normalized = normalizePath(absolutePath)
		if (this.rootDir === '/') {
			return normalized
		}
		if (normalized.startsWith(this.rootDir + '/')) {
			return normalized.slice(this.rootDir.length)
		}
		if (normalized === this.rootDir) {
			return '/'
		}
		return normalized
	}

	// =========================================================================
	// File Operations
	// =========================================================================

	async readFile(filePath: string): Promise<string> {
		const absPath = this.resolvePath(filePath)
		try {
			return await this.container.fs.readFile(absPath, 'utf-8')
		} catch (error) {
			throw new CodeAgentError('EXECUTION_FAILED', `Failed to read file: ${filePath}`, {
				cause: error as Error,
				details: { path: filePath }
			})
		}
	}

	async writeFile(filePath: string, content: string): Promise<void> {
		const absPath = this.resolvePath(filePath)

		codeLogger.debug('[WebContainer] writeFile called', {
			originalPath: filePath,
			resolvedPath: absPath,
			contentLength: content.length,
			contentPreview: content.slice(0, 100) + (content.length > 100 ? '...' : '')
		})

		try {
			// Ensure parent directory exists
			const parentDir = this.getParentPath(absPath)
			if (parentDir !== '/') {
				await this.ensureDir(parentDir)
			}
			await this.container.fs.writeFile(absPath, content, { encoding: 'utf-8' })

			codeLogger.debug('[WebContainer] writeFile SUCCESS', { path: absPath })
		} catch (error) {
			codeLogger.error('[WebContainer] writeFile FAILED', {
				path: absPath,
				error: error instanceof Error ? error.message : String(error)
			})
			throw new CodeAgentError('EXECUTION_FAILED', `Failed to write file: ${filePath}`, {
				cause: error as Error,
				details: { path: filePath }
			})
		}
	}

	async deletePath(filePath: string, opts?: { recursive?: boolean }): Promise<void> {
		const absPath = this.resolvePath(filePath)
		try {
			await this.container.fs.rm(absPath, {
				recursive: opts?.recursive || false,
				force: true
			})
		} catch (error) {
			throw new CodeAgentError('EXECUTION_FAILED', `Failed to delete path: ${filePath}`, {
				cause: error as Error,
				details: { path: filePath }
			})
		}
	}

	async exists(filePath: string): Promise<boolean> {
		const absPath = this.resolvePath(filePath)
		try {
			await this.container.fs.readFile(absPath)
			return true
		} catch {
			// Try as directory
			try {
				await this.container.fs.readdir(absPath)
				return true
			} catch {
				return false
			}
		}
	}

	async readdir(dirPath: string, opts?: { recursive?: boolean }): Promise<DirEntry[]> {
		const absPath = this.resolvePath(dirPath)
		const entries: DirEntry[] = []

		const readDir = async (currentPath: string) => {
			const items = (await this.container.fs.readdir(currentPath, { withFileTypes: true })) as DirEntryLike[]

			for (const item of items) {
				const itemPath = normalizePath(currentPath + '/' + item.name)
				const virtualPath = this.toVirtualPath(itemPath)

				// Skip denied paths
				if (matchesDenyPath(virtualPath, this.denyPaths)) {
					continue
				}

				entries.push({
					name: item.name,
					path: virtualPath,
					isDirectory: item.isDirectory(),
					isFile: item.isFile()
				})

				if (opts?.recursive && item.isDirectory()) {
					await readDir(itemPath)
				}
			}
		}

		try {
			await readDir(absPath)
			return entries
		} catch (error) {
			throw new CodeAgentError('EXECUTION_FAILED', `Failed to read directory: ${dirPath}`, {
				cause: error as Error,
				details: { path: dirPath }
			})
		}
	}

	async mkdir(dirPath: string, opts?: { recursive?: boolean }): Promise<void> {
		const absPath = this.resolvePath(dirPath)
		try {
			await this.container.fs.mkdir(absPath, { recursive: opts?.recursive || false })
		} catch (error) {
			throw new CodeAgentError('EXECUTION_FAILED', `Failed to create directory: ${dirPath}`, {
				cause: error as Error,
				details: { path: dirPath }
			})
		}
	}

	async stat(filePath: string): Promise<FileStat> {
		const absPath = this.resolvePath(filePath)
		try {
			// WebContainer doesn't have a native stat, so we approximate
			// Try reading as file first
			try {
				const content = await this.container.fs.readFile(absPath)
				const size = content instanceof Uint8Array ? content.length : new TextEncoder().encode(content).length
				return {
					size,
					isDirectory: false
				}
			} catch {
				// Try as directory
				await this.container.fs.readdir(absPath)
				return {
					size: 0,
					isDirectory: true
				}
			}
		} catch (error) {
			throw new CodeAgentError('EXECUTION_FAILED', `Failed to stat path: ${filePath}`, {
				cause: error as Error,
				details: { path: filePath }
			})
		}
	}

	async search(pattern: string, opts?: SearchOptions): Promise<SearchResult[]> {
		const results: SearchResult[] = []
		const searchPath = opts?.path ? this.resolvePath(opts.path) : this.resolvePath('/')
		const maxResults = opts?.maxResults || 100

		const searchDir = async (currentPath: string) => {
			if (results.length >= maxResults) return

			let items: DirEntryLike[]
			try {
				items = (await this.container.fs.readdir(currentPath, { withFileTypes: true })) as DirEntryLike[]
			} catch {
				return
			}

			for (const item of items) {
				if (results.length >= maxResults) break

				const itemPath = normalizePath(currentPath + '/' + item.name)
				const virtualPath = this.toVirtualPath(itemPath)

				// Skip denied paths
				if (matchesDenyPath(virtualPath, this.denyPaths)) {
					continue
				}

				if (item.isDirectory()) {
					// Skip node_modules for performance
					if (item.name === 'node_modules') continue
					await searchDir(itemPath)
				} else if (item.isFile()) {
					// Check if filename matches pattern
					if (this.matchesPattern(item.name, pattern, opts?.glob)) {
						const result: SearchResult = { path: virtualPath }

						// Include content matches if requested
						if (opts?.includeContent) {
							try {
								const content = await this.container.fs.readFile(itemPath, 'utf-8')
								const matches = this.findMatches(content, pattern)
								if (matches.length > 0) {
									result.matches = matches
								}
							} catch {
								// Skip binary or unreadable files
							}
						}

						results.push(result)
					}
				}
			}
		}

		try {
			await searchDir(searchPath)
			return results
		} catch (error) {
			throw new CodeAgentError('EXECUTION_FAILED', `Search failed`, {
				cause: error as Error,
				details: { pattern, opts }
			})
		}
	}

	private matchesPattern(filename: string, pattern: string, glob?: string): boolean {
		const lowerName = filename.toLowerCase()
		const lowerPattern = pattern.toLowerCase()

		if (glob) {
			return this.matchGlob(filename, glob)
		}

		return lowerName.includes(lowerPattern)
	}

	private matchGlob(filename: string, glob: string): boolean {
		const regex = new RegExp(
			'^' +
				glob
					.replace(/[.+^${}()|[\]\\]/g, '\\$&')
					.replace(/\*/g, '.*')
					.replace(/\?/g, '.') +
				'$',
			'i'
		)
		return regex.test(filename)
	}

	private findMatches(content: string, pattern: string): Array<{ line: number; column: number; text: string }> {
		const matches: Array<{ line: number; column: number; text: string }> = []
		const lines = content.split('\n')
		const lowerPattern = pattern.toLowerCase()

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]
			const lowerLine = line.toLowerCase()
			let column = lowerLine.indexOf(lowerPattern)

			while (column !== -1) {
				matches.push({
					line: i + 1,
					column: column + 1,
					text: line.trim()
				})
				column = lowerLine.indexOf(lowerPattern, column + 1)
			}
		}

		return matches
	}

	async snapshot(opts?: SnapshotOptions): Promise<Record<string, string>> {
		const files: Record<string, string> = {}
		const maxBytes = opts?.maxBytes || 2_000_000
		let totalBytes = 0

		const paths = opts?.paths || ['/']
		const excludePatterns = opts?.excludePatterns || ['node_modules', '.git']

		const readDir = async (currentPath: string) => {
			if (totalBytes >= maxBytes) return

			const absPath = this.resolvePath(currentPath)
			let items: DirEntryLike[]

			try {
				items = (await this.container.fs.readdir(absPath, { withFileTypes: true })) as DirEntryLike[]
			} catch {
				return
			}

			for (const item of items) {
				if (totalBytes >= maxBytes) break

				const virtualPath = normalizePath(currentPath + '/' + item.name)

				// Skip excluded patterns
				if (excludePatterns.some((p) => item.name === p || virtualPath.includes('/' + p + '/'))) {
					continue
				}

				// Skip denied paths
				if (matchesDenyPath(virtualPath, this.denyPaths)) {
					continue
				}

				if (item.isDirectory()) {
					await readDir(virtualPath)
				} else if (item.isFile()) {
					try {
						const itemAbsPath = this.resolvePath(virtualPath)
						const content = await this.container.fs.readFile(itemAbsPath, 'utf-8')
						const contentBytes = new TextEncoder().encode(content).length

						if (totalBytes + contentBytes <= maxBytes) {
							files[virtualPath] = content
							totalBytes += contentBytes
						}
					} catch {
						// Skip binary or unreadable files
					}
				}
			}
		}

		for (const p of paths) {
			await readDir(p)
		}

		return files
	}

	// =========================================================================
	// Command Execution
	// =========================================================================

	async run(command: string, args: string[], opts?: RunOptions): Promise<RunResult> {
		const cwd = opts?.cwd || this.rootDir
		const spawnOpts: WebContainerSpawnOptions = {
			cwd,
			env: opts?.env
		}

		codeLogger.debug(`Running command: ${command} ${args.join(' ')}`)

		let output = ''
		let process: WebContainerProcess

		try {
			process = await this.container.spawn(command, args, spawnOpts)
		} catch (error) {
			throw new CodeAgentError('EXECUTION_FAILED', `Failed to spawn command: ${command}`, {
				cause: error as Error,
				details: { command, args }
			})
		}

		// Set up timeout
		let timeoutId: ReturnType<typeof setTimeout> | undefined
		let timedOut = false
		if (opts?.timeout) {
			timeoutId = setTimeout(() => {
				timedOut = true
				process.kill()
			}, opts.timeout)
		}

		// Set up abort handling
		if (opts?.signal) {
			opts.signal.addEventListener('abort', () => {
				process.kill()
			})
		}

		// Collect output
		const reader = process.output.getReader()
		try {
			while (true) {
				const { done, value } = await reader.read()
				if (done) break
				output += value
			}
		} finally {
			reader.releaseLock()
		}

		// Wait for exit
		const exitCode = await process.exit

		if (timeoutId) clearTimeout(timeoutId)

		if (timedOut) {
			throw new CodeAgentError('TIMEOUT', `Command timed out after ${opts?.timeout}ms`)
		}

		return {
			exitCode,
			output // WebContainer has combined output only
		}
	}

	async *runStream(command: string, args: string[], opts?: RunOptions): AsyncIterable<TerminalChunk> {
		const cwd = opts?.cwd || this.rootDir
		const sessionId = `stream-${++this.sessionCounter}`
		const buffer = this.bufferManager.getOrCreate(sessionId, this.maxBufferedTerminalBytes)

		const spawnOpts: WebContainerSpawnOptions = {
			cwd,
			env: opts?.env
		}

		codeLogger.debug(`Streaming command: ${command} ${args.join(' ')}`)

		let process: WebContainerProcess
		try {
			process = await this.container.spawn(command, args, spawnOpts)
		} catch (error) {
			throw new CodeAgentError('EXECUTION_FAILED', `Failed to spawn command: ${command}`, {
				cause: error as Error,
				details: { command, args }
			})
		}

		// Set up timeout
		let timeoutId: ReturnType<typeof setTimeout> | undefined
		let timedOut = false
		if (opts?.timeout) {
			timeoutId = setTimeout(() => {
				timedOut = true
				process.kill()
			}, opts.timeout)
		}

		// Set up abort handling
		if (opts?.signal) {
			opts.signal.addEventListener('abort', () => {
				process.kill()
			})
		}

		// Track exit
		let exited = false
		let exitCode = -1
		process.exit.then((code) => {
			exited = true
			exitCode = code
		})

		// Stream output
		const reader = process.output.getReader()
		try {
			while (true) {
				const { done, value } = await reader.read()
				if (done) break
				buffer.append(value)
				yield { type: 'output', stream: 'combined', text: value }
			}
		} finally {
			reader.releaseLock()
		}

		// Wait for exit and yield final chunk
		if (!exited) {
			exitCode = await process.exit
		}

		if (timeoutId) clearTimeout(timeoutId)

		this.bufferManager.remove(sessionId)

		if (timedOut) {
			yield { type: 'exit', exitCode: -1 }
		} else {
			yield { type: 'exit', exitCode }
		}
	}

	// =========================================================================
	// Session Management
	// =========================================================================

	async startSession(command: string, args: string[], opts?: RunOptions): Promise<TerminalSessionHandle> {
		const cwd = opts?.cwd || this.rootDir
		const sessionId = `session-${++this.sessionCounter}-${Date.now()}`

		const spawnOpts: WebContainerSpawnOptions = {
			cwd,
			env: opts?.env,
			terminal: { cols: 80, rows: 24 }
		}

		codeLogger.debug(`Starting session: ${sessionId} - ${command} ${args.join(' ')}`)

		let process: WebContainerProcess
		try {
			process = await this.container.spawn(command, args, spawnOpts)
		} catch (error) {
			throw new CodeAgentError('EXECUTION_FAILED', `Failed to start session: ${command}`, {
				cause: error as Error,
				details: { command, args }
			})
		}

		const handle: TerminalSessionHandle = {
			id: sessionId
		}

		const session: SessionState = {
			handle,
			process,
			aborted: false,
			exitCode: null,
			outputReader: null
		}

		// Track exit code
		process.exit.then((code) => {
			session.exitCode = code
		})

		this.sessions.set(sessionId, session)

		// Create buffer for this session
		const buffer = this.bufferManager.getOrCreate(sessionId, this.maxBufferedTerminalBytes)

		// Start collecting output into buffer (background task)
		const reader = process.output.getReader()
		session.outputReader = reader

		// We don't await this - it runs in background
		;(async () => {
			try {
				while (true) {
					const { done, value } = await reader.read()
					if (done) break
					buffer.append(value)
				}
			} catch {
				// Stream closed
			}
		})()

		return handle
	}

	async *streamSession(handle: TerminalSessionHandle): AsyncIterable<TerminalChunk> {
		const session = this.sessions.get(handle.id)
		if (!session) {
			throw new CodeAgentError('INVALID_STATE', `Session not found: ${handle.id}`)
		}

		// If there's an existing reader, we need to handle this differently
		// since WebContainer only allows one reader at a time
		// For now, we'll tee the stream data through the buffer
		const buffer = this.bufferManager.getOrCreate(handle.id, this.maxBufferedTerminalBytes)

		// Check if already exited
		if (session.exitCode !== null) {
			// Yield any buffered content first
			const content = buffer.getContent()
			if (content) {
				yield { type: 'output', stream: 'combined', text: content }
			}
			yield { type: 'exit', exitCode: session.exitCode }
			return
		}

		// Poll for new content and exit
		let lastLength = 0
		let lastTotalProcessed = buffer.getStats().totalProcessed
		while (true) {
			const content = buffer.getContent()
			const stats = buffer.getStats()

			if (content.length > lastLength) {
				// Normal growth: emit the delta since last poll.
				yield { type: 'output', stream: 'combined', text: content.slice(lastLength) }
				lastLength = content.length
				lastTotalProcessed = stats.totalProcessed
			} else if (stats.totalProcessed > lastTotalProcessed) {
				// Buffer may have truncated old output to stay within max bytes,
				// keeping content length flat. Use totalProcessed as a monotonic signal
				// and emit an approximate tail delta to avoid stalling forever.
				const processedDelta = stats.totalProcessed - lastTotalProcessed
				const approxChars = Math.min(content.length, processedDelta)
				if (approxChars > 0) {
					yield { type: 'output', stream: 'combined', text: content.slice(-approxChars) }
				}
				lastLength = content.length
				lastTotalProcessed = stats.totalProcessed
			}

			if (session.exitCode !== null) {
				// Get any final content
				const finalContent = buffer.getContent()
				if (finalContent.length > lastLength) {
					yield { type: 'output', stream: 'combined', text: finalContent.slice(lastLength) }
				}
				yield { type: 'exit', exitCode: session.exitCode }
				return
			}

			// Small delay to avoid tight loop
			await new Promise((resolve) => setTimeout(resolve, 50))
		}
	}

	async stopSession(handle: TerminalSessionHandle): Promise<void> {
		const session = this.sessions.get(handle.id)
		if (!session) {
			return // Already stopped or never existed
		}

		codeLogger.debug(`Stopping session: ${handle.id}`)

		session.aborted = true

		// Release the reader if it exists
		if (session.outputReader) {
			try {
				await session.outputReader.cancel()
			} catch {
				// Reader may already be released
			}
		}

		// Kill the process
		try {
			session.process.kill()
		} catch {
			// Process may have already exited
		}

		// Wait a bit for cleanup
		await new Promise((resolve) => setTimeout(resolve, 100))

		// Cleanup
		this.sessions.delete(handle.id)
		this.bufferManager.remove(handle.id)
	}

	/**
	 * Stop all active sessions
	 */
	async stopAllSessions(): Promise<void> {
		const handles = Array.from(this.sessions.values()).map((s) => s.handle)
		await Promise.all(handles.map((h) => this.stopSession(h)))
	}

	/**
	 * Get the number of active sessions
	 */
	getActiveSessionCount(): number {
		return this.sessions.size
	}

	// =========================================================================
	// Utility Methods
	// =========================================================================

	private getParentPath(path: string): string {
		const lastSlash = path.lastIndexOf('/')
		if (lastSlash <= 0) return '/'
		return path.slice(0, lastSlash)
	}

	private async ensureDir(dirPath: string): Promise<void> {
		try {
			await this.container.fs.mkdir(dirPath, { recursive: true })
		} catch {
			// Directory may already exist
		}
	}
}
