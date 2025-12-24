/**
 * File read tracking for stale detection
 *
 * Tracks file state (mtime, size) when files are read to detect
 * when files have changed before writes occur. This prevents the
 * LLM from writing outdated content to modified files.
 */

/**
 * Snapshot of file state at read time
 */
export interface FileReadSnapshot {
	/**
	 * Path to the file
	 */
	path: string

	/**
	 * Modification time in milliseconds (null if file didn't exist)
	 */
	mtimeMs: number | null

	/**
	 * File size in bytes (null if file didn't exist)
	 */
	size: number | null

	/**
	 * Timestamp when the read occurred
	 */
	readAt: number

	/**
	 * Whether the file existed at read time
	 */
	exists: boolean
}

/**
 * Reason why a file is considered stale
 */
export type StaleReason = 'mtime_changed' | 'size_changed' | 'file_created' | 'file_deleted'

/**
 * Result of a stale check
 */
export interface StaleCheckResult {
	/**
	 * Whether the file is stale (changed since last read)
	 */
	isStale: boolean

	/**
	 * Reason for staleness (only present if isStale is true)
	 */
	reason?: StaleReason

	/**
	 * The snapshot from the last read
	 */
	lastRead?: FileReadSnapshot

	/**
	 * Current state of the file
	 */
	currentState?: {
		mtimeMs: number | null
		size: number | null
		exists: boolean
	}
}

/**
 * Current file state for comparison
 */
export interface CurrentFileState {
	/**
	 * Modification time in milliseconds (undefined if not available)
	 */
	mtimeMs?: number

	/**
	 * File size in bytes
	 */
	size: number

	/**
	 * Whether the file exists
	 */
	exists: boolean
}

/**
 * Tracks file state from read operations to detect staleness on write
 *
 * Usage:
 * ```typescript
 * const tracker = new FileReadTracker()
 *
 * // Record when a file is read
 * tracker.record({
 *   path: '/src/app.ts',
 *   mtimeMs: 1234567890,
 *   size: 1000,
 *   readAt: Date.now(),
 *   exists: true
 * })
 *
 * // Check before writing
 * if (tracker.hasRead('/src/app.ts')) {
 *   const snapshot = tracker.get('/src/app.ts')!
 *   const result = checkStaleness(snapshot, currentState)
 *   if (result.isStale) {
 *     // Handle stale file
 *   }
 * }
 * ```
 */
export class FileReadTracker {
	private snapshots = new Map<string, FileReadSnapshot>()

	/**
	 * Record a file read snapshot
	 *
	 * If a snapshot already exists for this path, it will be overwritten.
	 */
	record(snapshot: FileReadSnapshot): void {
		this.snapshots.set(snapshot.path, snapshot)
	}

	/**
	 * Get the last read snapshot for a path
	 *
	 * @returns The snapshot, or undefined if the path was never read
	 */
	get(path: string): FileReadSnapshot | undefined {
		return this.snapshots.get(path)
	}

	/**
	 * Check if a file has been read (has a snapshot)
	 */
	hasRead(path: string): boolean {
		return this.snapshots.has(path)
	}

	/**
	 * Clear tracking for a specific path
	 *
	 * Call this after a successful write to reset the baseline.
	 */
	clear(path: string): void {
		this.snapshots.delete(path)
	}

	/**
	 * Clear all tracking data
	 */
	clearAll(): void {
		this.snapshots.clear()
	}

	/**
	 * Get the number of tracked files
	 */
	get size(): number {
		return this.snapshots.size
	}

	/**
	 * Get all tracked paths
	 */
	getPaths(): string[] {
		return Array.from(this.snapshots.keys())
	}
}

/**
 * Compare a read snapshot against current file state to detect staleness
 *
 * @param snapshot - The snapshot from when the file was last read
 * @param current - The current state of the file
 * @returns Result indicating if the file is stale and why
 */
export function checkStaleness(snapshot: FileReadSnapshot, current: CurrentFileState): StaleCheckResult {
	// Case 1: File didn't exist when read, but now exists (externally created)
	if (!snapshot.exists && current.exists) {
		return {
			isStale: true,
			reason: 'file_created',
			lastRead: snapshot,
			currentState: {
				mtimeMs: current.mtimeMs ?? null,
				size: current.size,
				exists: true
			}
		}
	}

	// Case 2: File existed when read, but now doesn't (externally deleted)
	if (snapshot.exists && !current.exists) {
		return {
			isStale: true,
			reason: 'file_deleted',
			lastRead: snapshot,
			currentState: {
				mtimeMs: null,
				size: null,
				exists: false
			}
		}
	}

	// Case 3: Both didn't exist - not stale (still doesn't exist)
	if (!snapshot.exists && !current.exists) {
		return { isStale: false }
	}

	// Case 4: Both exist - check mtime and size
	// Check mtime first (primary indicator of modification)
	if (snapshot.mtimeMs !== null && current.mtimeMs !== undefined) {
		if (current.mtimeMs > snapshot.mtimeMs) {
			return {
				isStale: true,
				reason: 'mtime_changed',
				lastRead: snapshot,
				currentState: {
					mtimeMs: current.mtimeMs,
					size: current.size,
					exists: true
				}
			}
		}
	}

	// Check size (secondary indicator - catches edge cases where mtime is same)
	if (snapshot.size !== null && snapshot.size !== current.size) {
		return {
			isStale: true,
			reason: 'size_changed',
			lastRead: snapshot,
			currentState: {
				mtimeMs: current.mtimeMs ?? null,
				size: current.size,
				exists: true
			}
		}
	}

	// File is unchanged
	return { isStale: false }
}
