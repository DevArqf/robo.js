/**
 * Flashcore v1 (spec rev 4.3) Locking Primitives
 *
 * Provides async mutex and lock managers for embedded mode concurrency safety.
 */

/**
 * Simple async mutex for serializing operations.
 *
 * Provides mutual exclusion in single-process environments.
 * Does NOT provide distributed locking across processes.
 */
export class AsyncMutex {
	private locked = false
	private queue: Array<() => void> = []

	/**
	 * Acquire the lock.
	 * Waits if the lock is already held.
	 */
	async acquire(): Promise<void> {
		if (!this.locked) {
			this.locked = true
			return
		}

		// Wait in queue
		return new Promise<void>((resolve) => {
			this.queue.push(resolve)
		})
	}

	/**
	 * Release the lock.
	 * Wakes up the next waiter if any.
	 */
	release(): void {
		if (this.queue.length > 0) {
			// Wake up next waiter
			const next = this.queue.shift()
			next?.()
		} else {
			this.locked = false
		}
	}

	/**
	 * Check if the lock is currently held.
	 */
	isLocked(): boolean {
		return this.locked
	}

	/**
	 * Execute a function while holding the lock.
	 * Ensures lock is released even if function throws.
	 *
	 * @param fn - Function to execute
	 * @returns Result of the function
	 */
	async withLock<T>(fn: () => Promise<T>): Promise<T> {
		await this.acquire()
		try {
			return await fn()
		} finally {
			this.release()
		}
	}
}

/**
 * Lock manager for catalog operations.
 *
 * Provides per-model catalog locking to serialize catalog mutations.
 */
export class CatalogLockManager {
	private locks = new Map<string, AsyncMutex>()

	/**
	 * Get or create a lock for a model.
	 *
	 * @param modelKey - Model key (e.g., "user" or "namespace::model")
	 * @returns Mutex for the model
	 */
	private getLock(modelKey: string): AsyncMutex {
		let lock = this.locks.get(modelKey)
		if (!lock) {
			lock = new AsyncMutex()
			this.locks.set(modelKey, lock)
		}
		return lock
	}

	/**
	 * Execute a function while holding the catalog lock for a model.
	 *
	 * @param modelKey - Model key
	 * @param fn - Function to execute
	 * @returns Result of the function
	 */
	async withCatalogLock<T>(modelKey: string, fn: () => Promise<T>): Promise<T> {
		const lock = this.getLock(modelKey)
		return lock.withLock(fn)
	}

	/**
	 * Clear all locks. For testing only.
	 * @internal
	 */
	_clear(): void {
		this.locks.clear()
	}
}

/**
 * Lock manager for chunk operations.
 *
 * Provides per-chunk locking to serialize chunk read-modify-write cycles.
 */
export class ChunkLockManager {
	private locks = new Map<string, AsyncMutex>()

	/**
	 * Get or create a lock for a chunk.
	 *
	 * @param modelKey - Model key
	 * @param chunkId - Chunk ID
	 * @returns Mutex for the chunk
	 */
	private getLock(modelKey: string, chunkId: number): AsyncMutex {
		const key = `${modelKey}:chunk:${chunkId}`
		let lock = this.locks.get(key)
		if (!lock) {
			lock = new AsyncMutex()
			this.locks.set(key, lock)
		}
		return lock
	}

	/**
	 * Execute a function while holding the chunk lock.
	 *
	 * @param modelKey - Model key
	 * @param chunkId - Chunk ID
	 * @param fn - Function to execute
	 * @returns Result of the function
	 */
	async withChunkLock<T>(
		modelKey: string,
		chunkId: number,
		fn: () => Promise<T>
	): Promise<T> {
		const lock = this.getLock(modelKey, chunkId)
		return lock.withLock(fn)
	}

	/**
	 * Clear all locks. For testing only.
	 * @internal
	 */
	_clear(): void {
		this.locks.clear()
	}
}

/**
 * Global catalog lock manager instance.
 */
export const catalogLockManager = new CatalogLockManager()

/**
 * Global chunk lock manager instance.
 */
export const chunkLockManager = new ChunkLockManager()
