/**
 * Flashcore v4.3 System API
 *
 * Provides the Flashcore.$ system interface for initialization,
 * capabilities, introspection, and configuration.
 */

import { normalizeCapabilities, warnMissingCapabilities } from '../adapter/capabilities.js'
import { MemoryAdapter } from '../adapter/builtins/memory.js'
import type {
	AdapterCapabilities,
	FlashcoreAdapter,
	FlashcoreConfig,
	FlashcorePlugin,
	InitOptions
} from '../adapter/types.js'
import {
	DEFAULT_NAMESPACE_SEPARATOR,
	DEFAULT_SAFETY_LIMITS,
	DEFAULT_CONNECTION_SETTINGS,
	DEFAULT_TRANSACTION_SETTINGS,
	DEFAULT_INDEX_PERSISTENCE_SETTINGS
} from './constants.js'
import { FlashcoreError } from './errors.js'
import type { SchemaFields, ModelOptions } from '../schema/types.js'
import { FlashcoreModel } from '../model/model.js'
import { catalogLockManager, chunkLockManager } from '../model/locks.js'

/**
 * Introspection data returned by Flashcore.$.introspect().
 */
export interface FlashcoreIntrospection {
	/**
	 * Registered models with metadata.
	 */
	models: Array<{
		name: string
		namespace?: string
		fields: string[]
		relations: string[]
		customMethods: string[]
		indexes: string[]
		recordCount: number
		schemaChecksum?: string
	}>

	/**
	 * Known KV namespaces (best-effort; may be empty on non-scan adapters).
	 */
	kvNamespaces: string[]

	/**
	 * Storage statistics.
	 */
	storage: {
		totalKeys: number
		totalSize?: number // Optional; not all adapters can report this
	}

	/**
	 * Registered plugins.
	 */
	plugins: string[]

	/**
	 * WAL status.
	 */
	walStatus: {
		pendingEntries: number
		lastRecovery?: Date
	}
}

/**
 * Metrics counters for performance tracking.
 */
export interface FlashcoreMetrics {
	operations: {
		create: number
		update: number
		delete: number
		findUnique: number
		findMany: number
	}
	cacheHits: number
	cacheMisses: number
	indexRebuilds: number
	walRecoveries: number
	transactionRetries: number
	avgQueryTime: number
}

/**
 * Schema namespace wrapper for plugin model registration.
 */
export interface FlashcoreSchema {
	/**
	 * Register a model in this namespace.
	 */
	model<T extends { id: string }>(
		name: string,
		schema: SchemaFields,
		options?: Omit<ModelOptions, 'namespace'>
	): FlashcoreModel<T>

	/**
	 * Get the namespace name.
	 */
	readonly namespace: string
}

/**
 * Logger interface for capability warnings.
 */
interface Logger {
	warn: (msg: string) => void
	debug: (msg: string, ...args: unknown[]) => void
}

/**
 * Default logger that writes to console.
 */
const defaultLogger: Logger = {
	warn: (msg: string) => console.warn(`[Flashcore] ${msg}`),
	debug: (msg: string, ...args: unknown[]) => {
		if (process.env.FLASHCORE_DEBUG) {
			console.debug(`[Flashcore] ${msg}`, ...args)
		}
	}
}

/**
 * Internal state for the Flashcore system.
 */
class FlashcoreSystemState {
	initialized = false
	adapter: FlashcoreAdapter | null = null
	capabilities: AdapterCapabilities | null = null
	config: Readonly<FlashcoreConfig> | null = null
	plugins: FlashcorePlugin[] = []
	metrics: FlashcoreMetrics = this.createEmptyMetrics()
	logger: Logger = defaultLogger

	// Model registry: key format is "namespace::name" or just "name"
	models = new Map<string, FlashcoreModel<{ id: string }>>()

	// WAL state (Phase 4)
	walLastRecovery?: Date
	walPendingEntries = 0

	// Query time tracking for avgQueryTime
	private queryTimes: number[] = []
	private readonly maxQueryTimeSamples = 100

	createEmptyMetrics(): FlashcoreMetrics {
		return {
			operations: {
				create: 0,
				update: 0,
				delete: 0,
				findUnique: 0,
				findMany: 0
			},
			cacheHits: 0,
			cacheMisses: 0,
			indexRebuilds: 0,
			walRecoveries: 0,
			transactionRetries: 0,
			avgQueryTime: 0
		}
	}

	/**
	 * Record a query execution time and update the average.
	 */
	recordQueryTime(durationMs: number): void {
		this.queryTimes.push(durationMs)

		// Keep only the most recent samples
		if (this.queryTimes.length > this.maxQueryTimeSamples) {
			this.queryTimes.shift()
		}

		// Update running average
		if (this.queryTimes.length > 0) {
			const sum = this.queryTimes.reduce((a, b) => a + b, 0)
			this.metrics.avgQueryTime = sum / this.queryTimes.length
		}
	}

	/**
	 * Clear query time samples (called on metrics reset).
	 */
	clearQueryTimes(): void {
		this.queryTimes = []
	}
}

// Global system state
const state = new FlashcoreSystemState()

/**
 * Flashcore.$ system API.
 *
 * Provides initialization, configuration, capabilities, and introspection.
 */
export const FlashcoreSystem = {
	/**
	 * Initialize Flashcore with the provided options.
	 *
	 * Must be called before using any Flashcore features.
	 * Idempotent: calling multiple times with the same options is safe.
	 *
	 * @param options - Initialization options
	 */
	async init(options: InitOptions = {}): Promise<void> {
		// Idempotent: if already initialized, just return
		if (state.initialized) {
			state.logger.debug('Flashcore already initialized, skipping')
			return
		}

		state.logger.debug('Initializing Flashcore with options:', options)

		// Build the adapter
		const adapter = options.adapter ?? new MemoryAdapter()

		// Build effective config with defaults
		const config: FlashcoreConfig = Object.freeze({
			adapter,
			namespaceSeparator: options.namespaceSeparator ?? DEFAULT_NAMESPACE_SEPARATOR,
			kvReadPreference: options.kvReadPreference ?? 'legacy',
			kvWriteMode: options.kvWriteMode ?? 'legacy',
			transactions: {
				...DEFAULT_TRANSACTION_SETTINGS,
				...options.transactions
			},
			indexPersistence: {
				...DEFAULT_INDEX_PERSISTENCE_SETTINGS,
				...options.indexPersistence
			},
			connection: {
				...DEFAULT_CONNECTION_SETTINGS,
				...options.connection
			},
			safety: {
				...DEFAULT_SAFETY_LIMITS,
				...options.safety
			},
			plugins: options.plugins ?? [],
			lazyLoading: options.lazyLoading ?? true,
			autoRepair: options.autoRepair ?? false
		})

		// Validate config: kvReadPreference/kvWriteMode compatibility
		if (
			config.kvReadPreference !== 'legacy' &&
			config.kvWriteMode === 'legacy'
		) {
			throw new FlashcoreError(
				'Invalid config: kvReadPreference is "v4" but kvWriteMode is "legacy". ' +
				'This would cause reads to miss legacy keys. Use kvWriteMode: "dual" for migration.',
				'CONFIG_ERROR'
			)
		}
		if (
			config.kvReadPreference !== 'v4' &&
			config.kvWriteMode === 'v4'
		) {
			throw new FlashcoreError(
				'Invalid config: kvReadPreference is "legacy" but kvWriteMode is "v4". ' +
				'This would cause reads to miss v4 keys. Use kvWriteMode: "dual" for migration.',
				'CONFIG_ERROR'
			)
		}

		// Initialize adapter (call init exactly once)
		if (typeof adapter.init === 'function') {
			await adapter.init()
		}

		// Compute capabilities
		const capabilities = normalizeCapabilities(adapter)

		// Add plugin info to capabilities (will be populated during plugin setup)
		capabilities.plugins = config.plugins.map(p => p.name)
		capabilities.indexTypes = [] // Populated by plugins later

		// Store state
		state.adapter = adapter
		state.capabilities = capabilities
		state.config = config
		state.plugins = config.plugins
		state.initialized = true

		// Warn about missing capabilities
		warnMissingCapabilities(capabilities, state.logger)

		state.logger.debug('Flashcore initialized successfully')
	},

	/**
	 * Get the current adapter capabilities.
	 *
	 * @throws FlashcoreError if not initialized
	 */
	capabilities(): AdapterCapabilities {
		if (!state.initialized || !state.capabilities) {
			throw new FlashcoreError(
				'Flashcore not initialized. Call Flashcore.$.init() first.',
				'NOT_INITIALIZED'
			)
		}
		return state.capabilities
	},

	/**
	 * Get the current configuration (read-only).
	 *
	 * @throws FlashcoreError if not initialized
	 */
	get config(): Readonly<FlashcoreConfig> {
		if (!state.initialized || !state.config) {
			throw new FlashcoreError(
				'Flashcore not initialized. Call Flashcore.$.init() first.',
				'NOT_INITIALIZED'
			)
		}
		return state.config
	},

	/**
	 * Get a namespaced schema helper.
	 *
	 * Used by plugins to register models in isolated namespaces.
	 *
	 * @param namespace - The namespace name
	 */
	schema(namespace: string): FlashcoreSchema {
		return {
			namespace,
			model: <T extends { id: string }>(
				name: string,
				schema: SchemaFields,
				options?: Omit<ModelOptions, 'namespace'>
			): FlashcoreModel<T> => {
				return FlashcoreSystem.registerModel<T>(name, schema, { ...options, namespace })
			}
		}
	},

	/**
	 * Register a model with the given schema.
	 *
	 * @param name - Model name
	 * @param schema - Schema definition using f.* field builders
	 * @param options - Optional model options (namespace, methods, hooks)
	 * @returns The registered FlashcoreModel instance
	 */
	registerModel<T extends { id: string }>(
		name: string,
		schema: SchemaFields,
		options?: ModelOptions
	): FlashcoreModel<T> {
		if (!state.initialized || !state.adapter) {
			throw new FlashcoreError(
				'Flashcore not initialized. Call Flashcore.$.init() first.',
				'NOT_INITIALIZED'
			)
		}

		// Build model key
		const modelKey = options?.namespace ? `${options.namespace}::${name}` : name

		// Check if already registered
		if (state.models.has(modelKey)) {
			throw new FlashcoreError(
				`Model "${modelKey}" is already registered.`,
				'DUPLICATE_MODEL'
			)
		}

		// Create model instance
		const model = new FlashcoreModel<T>(
			name,
			schema,
			state.adapter,
			{
				namespace: options?.namespace,
				methods: options?.methods,
				hooks: options?.hooks
			}
		)

		// Register in state (use unknown as intermediate type for generic variance)
		state.models.set(modelKey, model as unknown as FlashcoreModel<{ id: string }>)

		state.logger.debug(`Registered model: ${modelKey}`)

		return model
	},

	/**
	 * Get a registered model by name.
	 *
	 * @param name - Model name (or "namespace::name" for namespaced models)
	 * @returns The model instance or undefined if not found
	 */
	getModel<T extends { id: string }>(name: string): FlashcoreModel<T> | undefined {
		return state.models.get(name) as unknown as FlashcoreModel<T> | undefined
	},

	/**
	 * Get introspection data about the current Flashcore state.
	 *
	 * Returns information about models, storage, plugins, and WAL status.
	 */
	introspect(): FlashcoreIntrospection {
		if (!state.initialized) {
			throw new FlashcoreError(
				'Flashcore not initialized. Call Flashcore.$.init() first.',
				'NOT_INITIALIZED'
			)
		}

		// Build models array from registry
		const models: FlashcoreIntrospection['models'] = []
		for (const model of state.models.values()) {
			const schemaInfo = model.getSchema()
			models.push({
				name: model.name,
				namespace: model.namespace,
				fields: Array.from(schemaInfo.keys()),
				relations: model.getRelations().map(r => r.model),
				customMethods: [], // Would need to track this separately
				indexes: model.getIndexedFields(),
				recordCount: 0, // Would need async call to get actual count
				schemaChecksum: model.getSchemaChecksum()
			})
		}

		return {
			models,
			kvNamespaces: [], // Best-effort; requires scan capability
			storage: {
				totalKeys: 0, // Would require scan to compute
				totalSize: undefined
			},
			plugins: state.plugins.map(p => p.name),
			walStatus: {
				pendingEntries: state.walPendingEntries,
				lastRecovery: state.walLastRecovery
			}
		}
	},

	/**
	 * Get current metrics.
	 */
	metrics(): FlashcoreMetrics {
		return { ...state.metrics }
	},

	/**
	 * Reset all metrics counters.
	 */
	resetMetrics(): void {
		state.metrics = state.createEmptyMetrics()
		state.clearQueryTimes()
	},

	/**
	 * Check if Flashcore is initialized.
	 */
	get isInitialized(): boolean {
		return state.initialized
	},

	/**
	 * Get the current adapter (for internal use).
	 * @internal
	 */
	get adapter(): FlashcoreAdapter {
		if (!state.initialized || !state.adapter) {
			throw new FlashcoreError(
				'Flashcore not initialized. Call Flashcore.$.init() first.',
				'NOT_INITIALIZED'
			)
		}
		return state.adapter
	},

	/**
	 * Increment an operation counter.
	 * @internal
	 */
	_incrementMetric(key: keyof FlashcoreMetrics['operations']): void {
		state.metrics.operations[key]++
	},

	/**
	 * Increment a general metric counter.
	 * @internal
	 */
	_incrementCounter(key: 'cacheHits' | 'cacheMisses' | 'indexRebuilds' | 'walRecoveries' | 'transactionRetries'): void {
		state.metrics[key]++
	},

	/**
	 * Record a query execution time for avgQueryTime calculation.
	 * @internal
	 */
	_recordQueryTime(durationMs: number): void {
		state.recordQueryTime(durationMs)
	},

	/**
	 * Update WAL pending entries count.
	 * @internal
	 */
	_setWalPendingEntries(count: number): void {
		state.walPendingEntries = count
	},

	/**
	 * Record WAL recovery event.
	 * @internal
	 */
	_recordWalRecovery(): void {
		state.walLastRecovery = new Date()
		state.metrics.walRecoveries++
	},

	/**
	 * Reset state for testing.
	 * @internal
	 */
	async _reset(): Promise<void> {
		if (state.adapter && typeof state.adapter.shutdown === 'function') {
			await state.adapter.shutdown()
		}
		state.initialized = false
		state.adapter = null
		state.capabilities = null
		state.config = null
		state.plugins = []
		state.models.clear()
		state.metrics = state.createEmptyMetrics()
		state.walLastRecovery = undefined
		state.walPendingEntries = 0

		// Clear lock managers
		catalogLockManager._clear()
		chunkLockManager._clear()
	}
}
