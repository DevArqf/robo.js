/**
 * Flashcore v1 System API (spec rev 4.3)
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
import { logger as flashcoreLogger } from './logger.js'
import { WriteAheadLog, setWALManager, getWalPendingEntriesCount, setWalPendingEntriesCount } from '../wal/manager.js'
import { recoverWAL } from '../wal/recovery.js'
import { IntegrityChecker, type IntegrityReport, type IntegrityCheckOptions } from '../integrity/check.js'
import { RepairEngine, type RepairOptions, type FullRepairResult, type RepairResult } from '../integrity/repair.js'
import { IndexPersistenceManager, setIndexPersistenceManager } from '../index/persistence.js'
import type { CuckooFilter } from '../index/filter.js'
import type { SortedIndex } from '../index/sorted.js'

// Phase 7: Migration imports
import { SchemaMetadataManager } from '../migration/metadata.js'
import { SchemaHistoryManager } from '../migration/history.js'
import { analyzeSchemaChanges, summarizeChanges } from '../migration/diff.js'
import { FlashcoreSchemaError } from './errors.js'
import type { SchemaChange, AutoRepairConfig } from '../migration/types.js'
import { DEFAULT_AUTO_REPAIR_CONFIG } from './constants.js'

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

const defaultLogger: Logger = {
	warn: (msg: string) => flashcoreLogger.warn(msg),
	debug: (msg: string, ...args: unknown[]) => {
		if (process.env.FLASHCORE_DEBUG) {
			flashcoreLogger.debug(msg, ...args)
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

	// Index persistence manager (Phase 6)
	indexPersistence: IndexPersistenceManager | null = null

	// Schema managers (Phase 7)
	schemaMetadataManager: SchemaMetadataManager | null = null
	schemaHistoryManager: SchemaHistoryManager | null = null
	schemasValidated = false

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

		const rawKvReadPreference = (options as Record<string, unknown>).kvReadPreference
		const rawKvWriteMode = (options as Record<string, unknown>).kvWriteMode

		const kvReadPreference =
			rawKvReadPreference === 'v4' ? 'v1' : (rawKvReadPreference as FlashcoreConfig['kvReadPreference'])
		const kvWriteMode =
			rawKvWriteMode === 'v4' ? 'v1' : (rawKvWriteMode as FlashcoreConfig['kvWriteMode'])

		// Build effective config with defaults
		const config: FlashcoreConfig = Object.freeze({
			adapter,
			namespaceSeparator: options.namespaceSeparator ?? DEFAULT_NAMESPACE_SEPARATOR,
			kvReadPreference: kvReadPreference ?? 'legacy',
			kvWriteMode: kvWriteMode ?? 'legacy',
			wal: options.wal,
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
		// Prevent "writes that don't read back" when both physical keys exist.
		if (config.kvReadPreference === 'v1' && config.kvWriteMode === 'legacy') {
			throw new FlashcoreError(
				'Invalid config: kvReadPreference is "v1" but kvWriteMode is "legacy". ' +
				'This can cause a value written via set() to not be returned by get() when both legacy + v1 keys exist. ' +
				'Use kvWriteMode: "dual" for migration, or set kvReadPreference: "legacy".',
				'CONFIG_ERROR'
			)
		}
		if (config.kvReadPreference === 'legacy' && config.kvWriteMode === 'v1') {
			throw new FlashcoreError(
				'Invalid config: kvReadPreference is "legacy" but kvWriteMode is "v1". ' +
				'This can cause a value written via set() to not be returned by get() when both legacy + v1 keys exist. ' +
				'Use kvWriteMode: "dual" for migration, or set kvReadPreference: "v1".',
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

		// WAL setup + recovery (Phase 4)
		// WAL is only enabled for scan-capable adapters
		if (capabilities.walEnabled) {
			const wal = new WriteAheadLog(adapter, config.wal)
			setWALManager(wal)

			// Best-effort pending count before recovery.
			const pending = await wal.getAllEntryKeys()
			state.walPendingEntries = pending.length
			setWalPendingEntriesCount(pending.length)

			// Run WAL recovery before model registration
			state.logger.debug('Running WAL recovery...')
			const recoveryResult = await recoverWAL(adapter, config.wal)

			if (recoveryResult.found > 0) {
				state.logger.debug(
					`WAL recovery complete: found=${recoveryResult.found}, replayed=${recoveryResult.replayed}, rolledBack=${recoveryResult.rolledBack}`
				)
				state.walLastRecovery = new Date()
				state.metrics.walRecoveries += recoveryResult.replayed + recoveryResult.rolledBack

				// Log any errors
				for (const error of recoveryResult.errors) {
					state.logger.warn(`WAL recovery error: ${error.message}`)
				}
			} else {
				state.logger.debug('WAL recovery: no pending entries')
			}

			// Update pending entries count after recovery
			const remaining = await wal.getAllEntryKeys()
			state.walPendingEntries = remaining.length
			setWalPendingEntriesCount(remaining.length)
		} else {
			setWALManager(null)
			setWalPendingEntriesCount(0)
			state.logger.debug('WAL disabled (adapter lacks scan capability)')
		}

		// Initialize index persistence manager (Phase 6)
		state.indexPersistence = new IndexPersistenceManager(adapter, {
			strategy: config.indexPersistence?.strategy ?? 'batched',
			intervalMs: config.indexPersistence?.intervalMs,
			flushOnShutdown: config.indexPersistence?.flushOnShutdown ?? true,
			shutdownTimeout: config.indexPersistence?.shutdownTimeout
		})
		state.indexPersistence.init()
		setIndexPersistenceManager(state.indexPersistence)
		state.logger.debug('Index persistence manager initialized')

		// Initialize schema managers (Phase 7)
		state.schemaMetadataManager = new SchemaMetadataManager(adapter)
		state.schemaHistoryManager = new SchemaHistoryManager(adapter)
		state.schemasValidated = false
		state.logger.debug('Schema managers initialized')

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
				pendingEntries: getWalPendingEntriesCount(),
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
		setWalPendingEntriesCount(count)
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
		// Shutdown index persistence manager
		if (state.indexPersistence) {
			await state.indexPersistence.shutdown()
			state.indexPersistence = null
		}
		setIndexPersistenceManager(null)

		if (state.adapter && typeof state.adapter.shutdown === 'function') {
			await state.adapter.shutdown()
		}
		setWALManager(null)
		state.initialized = false
		setWalPendingEntriesCount(0)
		state.adapter = null
		state.capabilities = null
		state.config = null
		state.plugins = []
		state.models.clear()
		state.metrics = state.createEmptyMetrics()
		state.walLastRecovery = undefined
		state.walPendingEntries = 0

		// Clear schema managers (Phase 7)
		state.schemaMetadataManager = null
		state.schemaHistoryManager = null
		state.schemasValidated = false

		// Clear WAL manager
		setWALManager(null)

		// Clear lock managers
		catalogLockManager._clear()
		chunkLockManager._clear()
	},

	// ========================================================================
	// Phase 6: Integrity & Index Management API
	// ========================================================================

	/**
	 * Check integrity of all registered models.
	 *
	 * Validates derived index structures (filter, sorted indexes, unique indexes)
	 * against authoritative data (catalog, chunks).
	 *
	 * @param options - Optional integrity check options
	 * @returns Integrity report for all models
	 */
	async checkIntegrity(options?: IntegrityCheckOptions): Promise<{
		models: IntegrityReport[]
		isValid: boolean
		durationMs: number
	}> {
		if (!state.initialized || !state.adapter) {
			throw new FlashcoreError(
				'Flashcore not initialized. Call Flashcore.$.init() first.',
				'NOT_INITIALIZED'
			)
		}

		const startTime = Date.now()
		const checker = new IntegrityChecker(state.adapter)
		const reports: IntegrityReport[] = []
		let allValid = true

		for (const model of state.models.values()) {
			const catalog = model._getCatalog()
			const filter = await model._getFilter()
			const sortedIndexes = await model._getSortedIndexes()
			const uniqueFields = model.getUniqueFields()

			const report = await checker.checkAll(model.name, catalog, {
				...options,
				filter: filter ?? undefined,
				sortedIndexes,
				uniqueFields,
				namespace: model.namespace
			})

			reports.push(report)
			if (!report.isValid) {
				allValid = false
			}
		}

		return {
			models: reports,
			isValid: allValid,
			durationMs: Date.now() - startTime
		}
	},

	/**
	 * Verify integrity of a specific model.
	 *
	 * @param modelName - Model name (or "namespace::name" for namespaced models)
	 * @param options - Optional integrity check options
	 * @returns Integrity report for the model
	 */
	async verify(modelName: string, options?: IntegrityCheckOptions): Promise<IntegrityReport> {
		if (!state.initialized || !state.adapter) {
			throw new FlashcoreError(
				'Flashcore not initialized. Call Flashcore.$.init() first.',
				'NOT_INITIALIZED'
			)
		}

		const model = state.models.get(modelName)
		if (!model) {
			throw new FlashcoreError(
				`Model "${modelName}" not found.`,
				'MODEL_NOT_FOUND'
			)
		}

		const checker = new IntegrityChecker(state.adapter)
		const catalog = model._getCatalog()
		const filter = await model._getFilter()
		const sortedIndexes = await model._getSortedIndexes()
		const uniqueFields = model.getUniqueFields()

		return checker.checkAll(model.name, catalog, {
			...options,
			filter: filter ?? undefined,
			sortedIndexes,
			uniqueFields,
			namespace: model.namespace
		})
	},

	/**
	 * Repair a specific model based on integrity check.
	 *
	 * @param modelName - Model name (or "namespace::name" for namespaced models)
	 * @param options - Optional repair options
	 * @returns Repair result
	 */
	async repair(modelName: string, options?: RepairOptions): Promise<FullRepairResult> {
		if (!state.initialized || !state.adapter) {
			throw new FlashcoreError(
				'Flashcore not initialized. Call Flashcore.$.init() first.',
				'NOT_INITIALIZED'
			)
		}

		const model = state.models.get(modelName)
		if (!model) {
			throw new FlashcoreError(
				`Model "${modelName}" not found.`,
				'MODEL_NOT_FOUND'
			)
		}

		// First check integrity
		const checker = new IntegrityChecker(state.adapter)
		const catalog = model._getCatalog()
		const filter = await model._getFilter()
		const sortedIndexes = await model._getSortedIndexes()
		const chunkManager = model._getChunkManager()
		const uniqueFields = model.getUniqueFields()

		const report = await checker.checkAll(model.name, catalog, {
			filter: filter ?? undefined,
			sortedIndexes,
			uniqueFields,
			namespace: model.namespace
		})

		// Repair based on report
		const engine = new RepairEngine(state.adapter)
		const result = await engine.repairFromReport(
			model.name,
			catalog,
			chunkManager,
			report,
			options
		)

		// If filter was repaired, update model
		if (result.filter && !options?.dryRun) {
			const repairedFilter = (result.filter as RepairResult & { filter?: CuckooFilter }).filter
			if (repairedFilter) {
				model._setFilter(repairedFilter)
			}
		}

		// If sorted indexes were repaired, update model
		if (!options?.dryRun) {
			for (const [field, repairResult] of result.sortedIndexes) {
				const repairedIndex = (repairResult as RepairResult & { index?: SortedIndex }).index
				if (repairedIndex) {
					model._setSortedIndex(field, repairedIndex)
				}
			}
		}

		// Increment metrics
		state.metrics.indexRebuilds++

		return result
	},

	/**
	 * Rebuild all indexes for a model (or all models).
	 *
	 * This completely rebuilds filter and sorted indexes from authoritative data.
	 *
	 * @param modelName - Optional model name. If not provided, rebuilds all models.
	 */
	async rebuildIndexes(modelName?: string): Promise<void> {
		if (!state.initialized || !state.adapter) {
			throw new FlashcoreError(
				'Flashcore not initialized. Call Flashcore.$.init() first.',
				'NOT_INITIALIZED'
			)
		}

		const modelsToRebuild = modelName
			? [state.models.get(modelName)]
			: Array.from(state.models.values())

		if (modelName && !modelsToRebuild[0]) {
			throw new FlashcoreError(
				`Model "${modelName}" not found.`,
				'MODEL_NOT_FOUND'
			)
		}

		const engine = new RepairEngine(state.adapter)

		for (const model of modelsToRebuild) {
			if (!model) continue

			const catalog = model._getCatalog()
			const chunkManager = model._getChunkManager()
			const indexedFields = model.getIndexedFields()

			const { filter, sortedIndexes } = await engine.rebuildAll(
				model.name,
				catalog,
				chunkManager,
				indexedFields,
				model.namespace
			)

			// Update model with rebuilt indexes
			model._setFilter(filter)
			model._setSortedIndexes(sortedIndexes)

			// Increment metrics
			state.metrics.indexRebuilds++
		}

		state.logger.debug(`Rebuilt indexes for ${modelsToRebuild.length} model(s)`)
	},

	/**
	 * Flush all pending index changes to storage.
	 *
	 * Forces immediate persistence of all dirty indexes.
	 */
	async flushIndexes(): Promise<void> {
		if (!state.initialized || !state.adapter) {
			throw new FlashcoreError(
				'Flashcore not initialized. Call Flashcore.$.init() first.',
				'NOT_INITIALIZED'
			)
		}

		if (state.indexPersistence) {
			const result = await state.indexPersistence.flushAll()
			state.logger.debug(`Flushed ${result.flushed} index(es) in ${result.durationMs}ms`)

			if (result.errors.length > 0) {
				for (const error of result.errors) {
					state.logger.warn(`Index flush error for ${error.modelName}${error.field ? ':' + error.field : ''}: ${error.error.message}`)
				}
			}
		} else {
			state.logger.debug('Index flush requested (no persistence manager)')
		}
	},

	/**
	 * Preload specified models into memory.
	 *
	 * Loads catalog, filter, and sorted indexes for the specified models.
	 * Useful when lazyLoading is enabled but you want to warm up specific models.
	 *
	 * @param modelNames - Model names to preload
	 */
	async preload(modelNames: string[]): Promise<void> {
		if (!state.initialized || !state.adapter) {
			throw new FlashcoreError(
				'Flashcore not initialized. Call Flashcore.$.init() first.',
				'NOT_INITIALIZED'
			)
		}

		for (const name of modelNames) {
			const model = state.models.get(name)
			if (!model) {
				state.logger.warn(`Model "${name}" not found for preload`)
				continue
			}

			// Load indexes (this will load catalog as well)
			await model._loadIndexes()
		}

		state.logger.debug(`Preloaded ${modelNames.length} model(s)`)
	},

	/**
	 * Rebuild indexes for a model in the background.
	 *
	 * Builds new indexes without blocking queries, then atomically swaps
	 * the new indexes in place of the old ones.
	 *
	 * @param modelName - Model name to rebuild
	 */
	async rebuildIndexesBackground(modelName: string): Promise<void> {
		if (!state.initialized || !state.adapter) {
			throw new FlashcoreError(
				'Flashcore not initialized. Call Flashcore.$.init() first.',
				'NOT_INITIALIZED'
			)
		}

		const model = state.models.get(modelName)
		if (!model) {
			throw new FlashcoreError(
				`Model "${modelName}" not found.`,
				'MODEL_NOT_FOUND'
			)
		}

		const engine = new RepairEngine(state.adapter)

		// Build new indexes in background (old indexes still serve queries)
		const catalog = model._getCatalog()
		const chunkManager = model._getChunkManager()
		const indexedFields = model.getIndexedFields()

		const { filter, sortedIndexes } = await engine.rebuildAll(
			model.name,
			catalog,
			chunkManager,
			indexedFields,
			model.namespace
		)

		// Atomic swap - replace old indexes with new ones
		model._setFilter(filter)
		model._setSortedIndexes(sortedIndexes)

		// Increment metrics
		state.metrics.indexRebuilds++

		state.logger.debug(`Background index rebuild complete for model: ${modelName}`)
	},

	// ========================================================================
	// Phase 7: Schema Validation & Migration API
	// ========================================================================

	/**
	 * Validate schemas of all registered models.
	 *
	 * Compares stored schema metadata checksums against current code checksums.
	 * - Safe changes are auto-applied
	 * - Breaking changes throw FlashcoreSchemaError
	 *
	 * Should be called after all models are registered (typically during app startup).
	 *
	 * @returns Validation result with changes applied
	 */
	async validateSchemas(): Promise<{
		modelsValidated: number
		newModels: string[]
		changedModels: Array<{ name: string; safeChanges: SchemaChange[] }>
	}> {
		if (!state.initialized || !state.adapter || !state.schemaMetadataManager) {
			throw new FlashcoreError(
				'Flashcore not initialized. Call Flashcore.$.init() first.',
				'NOT_INITIALIZED'
			)
		}

		const result = {
			modelsValidated: 0,
			newModels: [] as string[],
			changedModels: [] as Array<{ name: string; safeChanges: SchemaChange[] }>
		}

		for (const model of state.models.values()) {
			const modelKey = model.namespace ? `${model.namespace}::${model.name}` : model.name
			result.modelsValidated++

			// Get stored metadata
			const stored = await state.schemaMetadataManager.getModelMetadata(
				model.name,
				model.namespace
			)
			const currentChecksum = model.getSchemaChecksum()

			if (!stored) {
				// New model - store initial metadata
				const metadata = SchemaMetadataManager.createInitialMetadata(model.schema)
				await state.schemaMetadataManager.setModelMetadata(
					model.name,
					metadata,
					model.namespace
				)
				result.newModels.push(modelKey)
				state.logger.debug(`Registered new model: ${modelKey}`)
				continue
			}

			// Check if checksum differs
			if (stored.checksum === currentChecksum) {
				// No changes
				continue
			}

			// Schema changed - analyze changes
			const analysis = analyzeSchemaChanges(
				stored.fields,
				model.schema,
				model.name
			)

			// Breaking changes block startup
			if (analysis.hasBreakingChanges) {
				const breakingDescriptions = analysis.breaking
					.map(c => `  - ${c.description}`)
					.join('\n')

				throw new FlashcoreSchemaError(
					`Breaking schema changes detected for model '${modelKey}':\n${breakingDescriptions}`,
					{
						model: modelKey,
						schemaChange: analysis.breaking.map(c => c.description).join('; '),
						cliInstructions: "Run 'robo db migrate' to apply these changes."
					}
				)
			}

			// Safe changes are auto-applied
			if (analysis.safe.length > 0) {
				state.logger.debug(
					`Auto-applying safe schema changes for '${modelKey}': ${summarizeChanges(analysis)}`
				)

				// Apply safe changes (e.g., rebuild indexes)
				await this._applySafeChanges(model, analysis.safe)

				result.changedModels.push({
					name: modelKey,
					safeChanges: analysis.safe
				})
			}

			// Update stored metadata
			const updatedMetadata = SchemaMetadataManager.createUpdatedMetadata(
				model.schema,
				stored
			)
			await state.schemaMetadataManager.setModelMetadata(
				model.name,
				updatedMetadata,
				model.namespace
			)

			// Record in history
			if (state.schemaHistoryManager && analysis.safe.length > 0) {
				const historyEntry = SchemaHistoryManager.createAutoEntry(
					updatedMetadata.version,
					updatedMetadata.checksum,
					analysis.safe
				)
				await state.schemaHistoryManager.appendHistory(
					historyEntry,
					model.namespace ?? '_default'
				)
			}
		}

		state.schemasValidated = true
		state.logger.debug(
			`Schema validation complete: ${result.modelsValidated} models, ` +
			`${result.newModels.length} new, ${result.changedModels.length} changed`
		)

		return result
	},

	/**
	 * Run auto-repair based on configuration.
	 *
	 * Called after schema validation if autoRepair is enabled.
	 *
	 * @param config - Auto-repair configuration (true for defaults, or specific options)
	 */
	async runAutoRepair(config: AutoRepairConfig | true = true): Promise<{
		repaired: number
		errors: string[]
	}> {
		if (!state.initialized || !state.adapter) {
			throw new FlashcoreError(
				'Flashcore not initialized. Call Flashcore.$.init() first.',
				'NOT_INITIALIZED'
			)
		}

		const repairConfig: AutoRepairConfig = config === true
			? { ...DEFAULT_AUTO_REPAIR_CONFIG }
			: { ...DEFAULT_AUTO_REPAIR_CONFIG, ...config }

		// Never auto-repair catalog (requires explicit opt-in)
		if (repairConfig.catalog) {
			state.logger.warn(
				'Auto-repair of catalog is disabled for safety. ' +
				'Use CLI: robo db repair --rebuild=catalog'
			)
			repairConfig.catalog = false
		}

		const result = { repaired: 0, errors: [] as string[] }

		for (const model of state.models.values()) {
			const modelKey = model.namespace ? `${model.namespace}::${model.name}` : model.name

			try {
				// Quick integrity check
				const checker = new IntegrityChecker(state.adapter)
				const catalog = model._getCatalog()
				const filter = await model._getFilter()
				const sortedIndexes = await model._getSortedIndexes()

				const report = await checker.checkAll(model.name, catalog, {
					filter: filter ?? undefined,
					sortedIndexes,
					uniqueFields: model.getUniqueFields(),
					namespace: model.namespace,
					checkFilter: repairConfig.filter,
					checkSortedIndexes: repairConfig.indexes,
					checkUniqueIndexes: repairConfig.uniqueIndexes
				})

				if (!report.isValid) {
					// Repair needed
					state.logger.debug(`Auto-repairing model: ${modelKey}`)

					const engine = new RepairEngine(state.adapter)
					const chunkManager = model._getChunkManager()

					const repairResult = await engine.repairFromReport(
						model.name,
						catalog,
						chunkManager,
						report,
						{
							repairFilter: repairConfig.filter,
							repairSortedIndexes: repairConfig.indexes,
							repairUniqueIndexes: repairConfig.uniqueIndexes
						}
					)

					// Update model with repaired indexes
					if (repairResult.filter) {
						const repairedFilter = (repairResult.filter as RepairResult & { filter?: CuckooFilter }).filter
						if (repairedFilter) {
							model._setFilter(repairedFilter)
						}
					}

					for (const [field, repairData] of repairResult.sortedIndexes) {
						const repairedIndex = (repairData as RepairResult & { index?: SortedIndex }).index
						if (repairedIndex) {
							model._setSortedIndex(field, repairedIndex)
						}
					}

					result.repaired++
					state.metrics.indexRebuilds++
				}
			} catch (error) {
				result.errors.push(`${modelKey}: ${error instanceof Error ? error.message : String(error)}`)
			}
		}

		if (result.repaired > 0) {
			state.logger.debug(`Auto-repair complete: ${result.repaired} model(s) repaired`)
		}

		return result
	},

	/**
	 * Check if schemas have been validated.
	 */
	get schemasValidated(): boolean {
		return state.schemasValidated
	},

	/**
	 * Get the schema metadata manager.
	 * @internal
	 */
	get _schemaMetadataManager(): SchemaMetadataManager | null {
		return state.schemaMetadataManager
	},

	/**
	 * Get the schema history manager.
	 * @internal
	 */
	get _schemaHistoryManager(): SchemaHistoryManager | null {
		return state.schemaHistoryManager
	},

	/**
	 * Get all registered models.
	 * Returns a Map of model key to model instance.
	 */
	getRegisteredModels(): Map<string, FlashcoreModel<{ id: string }>> {
		return new Map(state.models)
	},

	/**
	 * Create a migration runner for CLI operations.
	 * @returns MigrationRunner instance or null if not initialized
	 */
	async createMigrationRunner(): Promise<import('../migration/runner.js').MigrationRunner | null> {
		if (!state.initialized || !state.adapter) {
			return null
		}
		// Dynamic import to avoid circular deps
		const { MigrationRunner } = await import('../migration/runner.js')
		return new MigrationRunner(state.adapter)
	},

	/**
	 * Apply safe schema changes to a model.
	 * @internal
	 */
	async _applySafeChanges(
		model: FlashcoreModel<{ id: string }>,
		changes: SchemaChange[]
	): Promise<void> {
		for (const change of changes) {
			switch (change.type) {
				case 'add_index':
					// Trigger index rebuild for this field
					if (change.field) {
						state.logger.debug(`Rebuilding index for field: ${change.field}`)
						// Index will be built on next access (lazy loading)
					}
					state.metrics.indexRebuilds++
					break

				case 'add_unique':
					// Validate existing records don't have duplicates
					if (change.field) {
						state.logger.debug(`Validating unique constraint on: ${change.field}`)
						// Validation happens on first access
					}
					break

				case 'remove_index':
					// No action needed - index will not be loaded
					break

				case 'remove_unique':
					// No action needed - constraint will not be enforced
					break

				// Other safe changes just update metadata
				default:
					break
			}
		}
	}
}
