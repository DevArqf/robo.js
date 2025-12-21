/**
 * Flashcore v1 Adapter Types (spec rev 4.3)
 *
 * Defines the adapter interface and capability system.
 */

import type { WALConfig } from '../wal/types.js'

/**
 * Core adapter interface for Flashcore storage backends.
 *
 * Adapters must implement the required methods (get, set, delete, has, clear).
 * Optional methods enable additional capabilities (WAL, transactions, unique constraints).
 */
export interface FlashcoreAdapter<K = string, V = unknown> {
	// ─────────────────────────────────────────────────────────────
	// REQUIRED - Basic KV operations
	// ─────────────────────────────────────────────────────────────

	/**
	 * Get a value by key.
	 * Returns undefined if the key does not exist.
	 */
	get(key: K): Promise<V | undefined> | V | undefined

	/**
	 * Set a key-value pair.
	 * Returns true if the operation succeeded.
	 */
	set(key: K, value: V): Promise<boolean> | boolean

	/**
	 * Delete a key.
	 * Returns true if the key existed and was deleted.
	 */
	delete(key: K): Promise<boolean> | boolean

	/**
	 * Check if a key exists.
	 * Must return true for stored falsy values (0, false, '', null).
	 */
	has(key: K): Promise<boolean> | boolean

	/**
	 * Clear all data.
	 */
	clear(): Promise<boolean> | Promise<void> | boolean | void

	// ─────────────────────────────────────────────────────────────
	// OPTIONAL - Lifecycle
	// ─────────────────────────────────────────────────────────────

	/**
	 * Initialize the adapter (e.g., connect, create directories).
	 * Called once during Flashcore.$.init().
	 */
	init?(): Promise<void> | void

	/**
	 * Shutdown the adapter (e.g., close connections).
	 */
	shutdown?(): Promise<void> | void

	/**
	 * Human-readable adapter name for logging and introspection.
	 */
	name?: string

	// ─────────────────────────────────────────────────────────────
	// OPTIONAL - Capabilities
	// ─────────────────────────────────────────────────────────────

	/**
	 * List keys with a prefix.
	 * Required for WAL-capable crash recovery.
	 *
	 * Can return an array or an async iterable for streaming large keysets.
	 * Iteration order is unspecified.
	 */
	scan?(prefix: K): Promise<K[]> | K[] | AsyncIterable<K> | Promise<AsyncIterable<K>>

	/**
	 * Atomic "set if not exists" (conditional put).
	 * Required for race-free unique constraints in distributed mode.
	 *
	 * Returns true if the key was set (did not exist).
	 * Returns false if the key already exists.
	 */
	setIfNotExists?(key: K, value: V): Promise<boolean> | boolean

	/**
	 * Compare-and-swap: atomically update if current value matches expected.
	 * Useful for safer distributed updates and stale lock overrides.
	 *
	 * Returns true if swap succeeded.
	 * Returns false if current value differs from expected.
	 */
	compareAndSwap?(key: K, expected: V, next: V): Promise<boolean> | boolean

	/**
	 * Apply a batch of operations atomically.
	 * Required for multi-key atomic commit (bulk ops, transactions).
	 *
	 * If check operations are included (OCC), they must be atomic with the batch.
	 */
	atomicBatch?(ops: BatchOperation<K, V>[]): Promise<void> | void

	/**
	 * Native transaction API.
	 * When supported, provides full ACID guarantees.
	 */
	transaction?(fn: (tx: AdapterTransaction<K, V>) => Promise<void>): Promise<void>

	/**
	 * Maximum size in bytes for a single value.
	 * Used for chunk sizing and WAL segmentation.
	 */
	maxValueSize?: number

	/**
	 * Extended capability reporting.
	 * Allows adapters to provide richer capability information.
	 */
	capabilities?(): Partial<AdapterCapabilitiesReport>
}

/**
 * Transaction context provided by native adapter transactions.
 */
export interface AdapterTransaction<K = string, V = unknown> {
	/**
	 * Get a value within the transaction.
	 */
	get(key: K): Promise<V | undefined>

	/**
	 * Stage a set operation (committed on transaction success).
	 */
	set(key: K, value: V): void

	/**
	 * Stage a delete operation (committed on transaction success).
	 */
	delete(key: K): void
}

/**
 * Operation types for atomic batch operations.
 */
export type BatchOperation<K = string, V = unknown> =
	| { type: 'set'; key: K; value: V }
	| { type: 'delete'; key: K }
	| { type: 'check'; key: K; expectedVersion: number } // OCC primitive

/**
 * Extended capabilities that an adapter can self-report.
 */
export interface AdapterCapabilitiesReport {
	/**
	 * Transaction isolation level.
	 */
	isolation: 'none' | 'read-committed' | 'serializable'
}

/**
 * Normalized adapter capabilities.
 * Computed from adapter interface inspection and self-reporting.
 */
export interface AdapterCapabilities {
	/**
	 * Whether the adapter supports multi-key atomic commit.
	 * True if transaction OR atomicBatch is available.
	 */
	acid: boolean

	/**
	 * Whether WAL recovery is possible.
	 * True if scan is available.
	 */
	walEnabled: boolean

	/**
	 * Whether native transactions are available.
	 */
	nativeTransactions: boolean

	/**
	 * Whether atomic batch operations are available.
	 */
	atomicBatch: boolean

	/**
	 * Transaction isolation level.
	 */
	isolation: 'none' | 'read-committed' | 'serializable'

	/**
	 * Adapter name for identification.
	 */
	adapter: string

	/**
	 * Whether setIfNotExists is available.
	 */
	setIfNotExists: boolean

	/**
	 * Whether compareAndSwap is available.
	 */
	compareAndSwap: boolean

	/**
	 * Whether scan is available.
	 */
	scan: boolean

	/**
	 * Maximum value size in bytes (undefined = no limit known).
	 */
	maxValueSize?: number

	/**
	 * Registered Flashcore plugins.
	 */
	plugins: string[]

	/**
	 * Registered index types.
	 */
	indexTypes: string[]
}

/**
 * Configuration for the Flashcore v1 client.
 */
export interface FlashcoreConfig {
	/**
	 * The storage adapter.
	 */
	adapter: FlashcoreAdapter

	/**
	 * Namespace separator for joining array namespaces.
	 * Default: '/'
	 */
	namespaceSeparator?: string

	/**
	 * KV read preference for dual-key resolution.
	 * - 'legacy': prefer legacy composed key format (default for robo.js import)
	 * - 'v1': prefer safe encoded key format (default for robo.js/flashcore import)
	 */
	kvReadPreference?: 'legacy' | 'v1'

	/**
	 * KV write mode for key storage.
	 * - 'legacy': write only legacy key format
	 * - 'v1': write only safe key format
	 * - 'dual': write both formats (for migration)
	 */
	kvWriteMode?: 'legacy' | 'v1' | 'dual'

	/**
	 * Transaction configuration.
	 */
	transactions?: {
		mode?: 'auto' | 'native' | 'batch' | 'optimistic' | 'serial' | 'single'
		maxRetries?: number
		retryDelay?: number
		timeout?: number
	}

	/**
	 * Index persistence configuration.
	 */
	indexPersistence?: {
		strategy?: 'immediate' | 'batched' | 'periodic'
		intervalMs?: number
		flushOnShutdown?: boolean
		shutdownTimeout?: number
		/** Maximum memory for indexes in bytes (default: 50MB) */
		memoryLimit?: number
		/** Maximum records to hold in memory before evicting (default: 100000) */
		maxInMemoryRecords?: number
	}

	/**
	 * Connection/retry settings.
	 */
	connection?: {
		maxRetries?: number
		retryBaseDelay?: number
		retryMaxDelay?: number
	}

	/**
	 * Safety limits.
	 */
	safety?: {
		maxDefaultResults?: number
		warnResultsThreshold?: number
		maxBulkOperationWithoutWhere?: number
	}

	/**
	 * Flashcore plugins to apply.
	 */
	plugins?: FlashcorePlugin[]

	/**
	 * Enable lazy loading of catalogs/indexes.
	 */
	lazyLoading?: boolean

	/**
	 * Auto-repair configuration.
	 */
	autoRepair?: boolean | {
		filter?: boolean
		indexes?: boolean
		uniqueIndexes?: boolean
		catalog?: boolean // requires explicit opt-in
	}

	/**
	 * WAL configuration (Phase 4).
	 */
	wal?: WALConfig
}

/**
 * Flashcore plugin interface (Phase 10).
 * Stubbed here for type completeness.
 */
export interface FlashcorePlugin {
	name: string
	setup?(ctx: unknown): void | Promise<void>
	shutdown?(): void | Promise<void>
}

/**
 * Options for Flashcore.$.init().
 */
export interface InitOptions extends Partial<FlashcoreConfig> {
	/**
	 * The storage adapter (required if not using default).
	 */
	adapter?: FlashcoreAdapter
}

/**
 * Options for KV operations.
 */
export interface FlashcoreKVOptions {
	/**
	 * Namespace for the key.
	 * Can be a single string or an array of strings.
	 */
	namespace?: string | string[]
}

/**
 * Options for KV get operation.
 */
export interface FlashcoreGetOptions extends FlashcoreKVOptions {
	/**
	 * Default value to return if key does not exist.
	 */
	default?: unknown
}

/**
 * Watcher callback signature.
 * Receives (oldValue, newValue) for compatibility with existing code.
 */
export type WatcherCallback<V = unknown> = (oldValue: V | undefined, newValue: V | undefined) => void | Promise<void>
