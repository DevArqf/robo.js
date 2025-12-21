/**
 * Flashcore v4.3 Memory Adapter
 *
 * A full-featured in-memory adapter for testing and development.
 * Implements all optional capabilities.
 */

import type {
	FlashcoreAdapter,
	BatchOperation,
	AdapterCapabilitiesReport
} from '../types.js'

/**
 * In-memory storage adapter using Map.
 *
 * Implements all optional capabilities:
 * - scan: prefix-based key listing
 * - setIfNotExists: atomic conditional set
 * - compareAndSwap: atomic update with version check
 * - atomicBatch: atomic multi-key operations
 *
 * Useful for:
 * - Unit testing
 * - Development without external dependencies
 * - Ephemeral data that doesn't need persistence
 */
export class MemoryAdapter<K extends string = string, V = unknown> implements FlashcoreAdapter<K, V> {
	readonly name = 'MemoryAdapter'

	private storage = new Map<K, V>()

	// ─────────────────────────────────────────────────────────────
	// Required Methods
	// ─────────────────────────────────────────────────────────────

	get(key: K): V | undefined {
		return this.storage.get(key)
	}

	set(key: K, value: V): boolean {
		this.storage.set(key, value)
		return true
	}

	delete(key: K): boolean {
		return this.storage.delete(key)
	}

	has(key: K): boolean {
		return this.storage.has(key)
	}

	clear(): void {
		this.storage.clear()
	}

	// ─────────────────────────────────────────────────────────────
	// Optional Lifecycle
	// ─────────────────────────────────────────────────────────────

	init(): void {
		// No initialization needed for in-memory storage
	}

	shutdown(): void {
		// Clear storage on shutdown
		this.storage.clear()
	}

	// ─────────────────────────────────────────────────────────────
	// Optional Capabilities
	// ─────────────────────────────────────────────────────────────

	/**
	 * Scan for keys with a given prefix.
	 * Returns an array for simplicity (small keysets in testing).
	 */
	scan(prefix: K): K[] {
		const results: K[] = []
		const prefixStr = String(prefix)

		for (const key of this.storage.keys()) {
			if (String(key).startsWith(prefixStr)) {
				results.push(key)
			}
		}

		return results
	}

	/**
	 * Set a key only if it doesn't exist.
	 * Returns true if set, false if key already exists.
	 */
	setIfNotExists(key: K, value: V): boolean {
		if (this.storage.has(key)) {
			return false
		}
		this.storage.set(key, value)
		return true
	}

	/**
	 * Compare and swap: update only if current value equals expected.
	 *
	 * Uses JSON serialization for deep equality check.
	 * Returns true if swap succeeded, false if value differs.
	 */
	compareAndSwap(key: K, expected: V, next: V): boolean {
		const current = this.storage.get(key)

		// Check equality using JSON serialization
		const currentJson = JSON.stringify(current)
		const expectedJson = JSON.stringify(expected)

		if (currentJson !== expectedJson) {
			return false
		}

		this.storage.set(key, next)
		return true
	}

	/**
	 * Apply a batch of operations atomically.
	 *
	 * In memory, this is trivially atomic since JavaScript is single-threaded.
	 * Validates check operations before applying any changes.
	 */
	atomicBatch(ops: BatchOperation<K, V>[]): void {
		// First, validate all check operations
		for (const op of ops) {
			if (op.type === 'check') {
				const current = this.storage.get(op.key)
				const currentVersion = (current as { _version?: number } | undefined)?._version

				if (currentVersion !== op.expectedVersion) {
					throw new Error(
						`Batch operation failed: version check failed for key "${op.key}". ` +
						`Expected version ${op.expectedVersion}, got ${currentVersion}`
					)
				}
			}
		}

		// Apply all set/delete operations
		for (const op of ops) {
			switch (op.type) {
				case 'set':
					this.storage.set(op.key, op.value)
					break
				case 'delete':
					this.storage.delete(op.key)
					break
				// 'check' operations are already validated
			}
		}
	}

	/**
	 * Report extended capabilities.
	 */
	capabilities(): AdapterCapabilitiesReport {
		return {
			// Memory adapter has no isolation concerns (single-threaded)
			isolation: 'serializable'
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Testing Utilities
	// ─────────────────────────────────────────────────────────────

	/**
	 * Get the number of stored keys.
	 */
	size(): number {
		return this.storage.size
	}

	/**
	 * Get all keys (for testing/debugging).
	 */
	keys(): K[] {
		return Array.from(this.storage.keys())
	}

	/**
	 * Get all entries (for testing/debugging).
	 */
	entries(): [K, V][] {
		return Array.from(this.storage.entries())
	}

	/**
	 * Get a snapshot of the storage (for testing).
	 */
	snapshot(): Map<K, V> {
		return new Map(this.storage)
	}

	/**
	 * Restore from a snapshot (for testing).
	 */
	restore(snapshot: Map<K, V>): void {
		this.storage = new Map(snapshot)
	}
}

/**
 * Create a new MemoryAdapter instance.
 */
export function createMemoryAdapter<K extends string = string, V = unknown>(): MemoryAdapter<K, V> {
	return new MemoryAdapter<K, V>()
}
