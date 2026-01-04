/**
 * Flashcore v1 (spec rev 4.3)
 *
 * A type-safe, Prisma-like database built on key-value storage for Robo.js.
 *
 * @module robo.js/flashcore
 * @version 1
 *
 * @example
 * ```typescript
 * import { Flashcore } from 'robo.js/flashcore'
 *
 * // Initialize with an adapter
 * await Flashcore.$.init({ adapter: new MemoryAdapter() })
 *
 * // KV operations
 * await Flashcore.set('key', 'value')
 * const value = await Flashcore.get('key')
 *
 * // With namespace
 * await Flashcore.set('user:123', data, { namespace: 'cache' })
 * ```
 */

// ─────────────────────────────────────────────────────────────
// Core Client
// ─────────────────────────────────────────────────────────────

export { Flashcore } from './core/client.js'
export type { FlashcoreClient } from './core/client.js'

// ─────────────────────────────────────────────────────────────
// Adapters
// ─────────────────────────────────────────────────────────────

export { MemoryAdapter, createMemoryAdapter } from './adapter/builtins/memory.js'
export { LegacyFileAdapter, createLegacyFileAdapter } from './adapter/builtins/legacy-file.js'
export { KeyvAdapter, createKeyvAdapter, createKeyvAdapterFromOptions } from './adapter/builtins/keyv.js'
export { FileAdapter, createFileAdapter } from './adapter/builtins/file.js'
export type { KeyvLike, KeyvAdapterOptions } from './adapter/builtins/keyv.js'
export type { LegacyFileAdapterOptions } from './adapter/builtins/legacy-file.js'
export type { FileAdapterOptions } from './adapter/builtins/file.js'

// ─────────────────────────────────────────────────────────────
// Adapter Utilities
// ─────────────────────────────────────────────────────────────

export { normalizeCapabilities, requireCapability, warnMissingCapabilities } from './adapter/capabilities.js'
export { scanKeys, scanKeysToArray, hasScanCapability } from './adapter/scan.js'

// ─────────────────────────────────────────────────────────────
// Adapter Types
// ─────────────────────────────────────────────────────────────

export type {
	FlashcoreAdapter,
	AdapterTransaction,
	BatchOperation,
	AdapterCapabilitiesReport,
	AdapterCapabilities,
	FlashcoreConfig,
	FlashcorePlugin,
	InitOptions,
	FlashcoreKVOptions,
	FlashcoreGetOptions,
	WatcherCallback
} from './adapter/types.js'

// ─────────────────────────────────────────────────────────────
// System API
// ─────────────────────────────────────────────────────────────

export { FlashcoreSystem } from './core/system.js'
export type { FlashcoreIntrospection, FlashcoreMetrics, FlashcoreSchema } from './core/system.js'

// ─────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────

export {
	FlashcoreError,
	ValidationError,
	NotFoundError,
	UniqueConstraintError,
	FeatureNotSupportedError,
	AdapterError,
	DataCorruptionError,
	StorageExhaustedError,
	TransactionConflictError,
	ConnectionError,
	FlashcoreSchemaError,
	MigrationError,
	SafetyError
} from './core/errors.js'

// ─────────────────────────────────────────────────────────────
// Encoding
// ─────────────────────────────────────────────────────────────

export {
	SafeKeyEncoder,
	safeKeyEncoder,
	encodeKey,
	decodeKey,
	encodeUniqueValue,
	decodeUniqueValue,
	needsEncoding
} from './core/encoding.js'
export type { EncodedKeyData } from './core/encoding.js'

// ─────────────────────────────────────────────────────────────
// Key Utilities
// ─────────────────────────────────────────────────────────────

export {
	composeLegacyKey,
	parseLegacyKey,
	composeV1Key,
	normalizeNamespace,
	validateNotReserved,
	buildModelKey,
	buildUniqueKey,
	buildIndexKey,
	buildWalEntryKey,
	buildWalSegmentKey,
	buildSchemaKey,
	buildSchemaHistoryKey,
	buildPluginKey,
	WAL_ENTRY_PREFIX
} from './core/keys.js'

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export {
	RESERVED_PREFIXES,
	isReservedPrefix,
	DEFAULT_NAMESPACE_SEPARATOR,
	LEGACY_KEY_SEPARATOR,
	ENCODED_KEY_PREFIX,
	DEFAULT_MAX_CHUNK_SIZE,
	DEFAULT_MAX_RECORDS_PER_CHUNK,
	DEFAULT_SAFETY_LIMITS,
	DEFAULT_CONNECTION_SETTINGS,
	DEFAULT_TRANSACTION_SETTINGS,
	DEFAULT_INDEX_PERSISTENCE_SETTINGS,
	MAX_LENGTHS,
	SAFE_ID_PATTERN,
	SAFE_KEY_CHARS
} from './core/constants.js'

// ─────────────────────────────────────────────────────────────
// Schema Field Builders (Phase 1)
// ─────────────────────────────────────────────────────────────

export { f, Field, RelationField, compoundUnique } from './schema/field.js'
export type { FieldDef, RelationDef, FieldType, RelationType, OnDeleteAction } from './schema/field.js'

// ─────────────────────────────────────────────────────────────
// Schema Types (Phase 1)
// ─────────────────────────────────────────────────────────────

export type {
	SchemaFields,
	SchemaField,
	NormalizedSchema,
	NormalizedField,
	ModelOptions,
	ModelHooks,
	CompoundUniqueConstraint,
	CreateInput,
	UpdateInput,
	UniqueWhere,
	FindUniqueArgs,
	UpdateArgs,
	DeleteArgs,
	ValidationResult,
	ValidationError as SchemaValidationError,
	CatalogData,
	ChunkData,
	InferFieldType,
	InferModelType
} from './schema/types.js'

// ─────────────────────────────────────────────────────────────
// Schema Utilities (Phase 1)
// ─────────────────────────────────────────────────────────────

export { normalizeSchema, applyDefaults, normalizeRecordShape, getUnknownFields, getMissingRequiredFields } from './schema/normalize.js'
export { RecordValidator, throwIfInvalid, ID_CONSTRAINTS } from './schema/validate.js'
export { TypeSerializer, isSerializedDate, isSerializedBigInt } from './schema/serialize.js'
export { computeSchemaChecksum, compareChecksums } from './schema/checksum.js'

// ─────────────────────────────────────────────────────────────
// Model (Phase 1)
// ─────────────────────────────────────────────────────────────

export { FlashcoreModel, createModel } from './model/model.js'
export type { FlashcoreModelOptions } from './model/model.js'

// ─────────────────────────────────────────────────────────────
// Storage Primitives (Phase 1)
// ─────────────────────────────────────────────────────────────

export { Catalog, CATALOG_VERSION } from './model/catalog.js'
export type { CatalogEntry, ChunkStats } from './model/catalog.js'
export { ChunkManager, createChunkManager, DEFAULT_RECORDS_PER_CHUNK } from './model/chunk.js'

// ─────────────────────────────────────────────────────────────
// Locks (Phase 1)
// ─────────────────────────────────────────────────────────────

export { AsyncMutex, CatalogLockManager, ChunkLockManager, catalogLockManager, chunkLockManager } from './model/locks.js'

// ─────────────────────────────────────────────────────────────
// ID Generation (Phase 1)
// ─────────────────────────────────────────────────────────────

export { generateId, generateRandomId, isValidId, extractTimestamp } from './model/id.js'

// ─────────────────────────────────────────────────────────────
// Hooks (Phase 1)
// ─────────────────────────────────────────────────────────────

export {
	executeBeforeCreate,
	executeAfterCreate,
	executeBeforeUpdate,
	executeAfterUpdate,
	executeBeforeDelete,
	executeAfterDelete,
	validateHooks,
	mergeHooks
} from './model/hooks.js'
export type { HookContext } from './model/hooks.js'

// ─────────────────────────────────────────────────────────────
// Query Types (Phase 2)
// ─────────────────────────────────────────────────────────────

export type {
	WhereOperators,
	WhereClause,
	OrderDirection,
	OrderBy,
	SelectClause,
	IncludeClause,
	FindManyArgs,
	FindFirstArgs,
	CountArgs
} from './schema/types.js'

// ─────────────────────────────────────────────────────────────
// Query Utilities (Phase 2)
// ─────────────────────────────────────────────────────────────

export { evaluateWhere } from './query/evaluate.js'
export { sortRecords } from './query/order.js'

// ─────────────────────────────────────────────────────────────
// Index Managers (Phase 2)
// ─────────────────────────────────────────────────────────────

export {
	UniqueIndexManager,
	acquireUniqueConstraints,
	releaseUniqueConstraints
} from './index/unique.js'
export type {
	UniqueIndexEntry,
	UniqueConstraintOptions
} from './index/unique.js'

// ─────────────────────────────────────────────────────────────
// Safety Config (Phase 2)
// ─────────────────────────────────────────────────────────────

export { DEFAULT_SAFETY_CONFIG } from './core/constants.js'

// ─────────────────────────────────────────────────────────────
// Adapter Wrappers (Phase 3)
// ─────────────────────────────────────────────────────────────

export { AdapterWrapper } from './adapter/wrappers/base.js'
export { CacheAdapter, createCacheAdapter } from './adapter/wrappers/cache.js'
export { CompressionAdapter, createCompressionAdapter } from './adapter/wrappers/compression.js'
export { EncryptionAdapter, createEncryptionAdapter } from './adapter/wrappers/encryption.js'
export { ResilienceAdapter, createResilienceAdapter } from './adapter/wrappers/resilience.js'
export type { CacheOptions, CacheStats } from './adapter/wrappers/cache.js'
export type { CompressionOptions } from './adapter/wrappers/compression.js'
export type { EncryptionOptions } from './adapter/wrappers/encryption.js'
export type { ResilienceOptions } from './adapter/wrappers/resilience.js'

// ─────────────────────────────────────────────────────────────
// Adapter Builder (Phase 3)
// ─────────────────────────────────────────────────────────────

export { AdapterBuilder, buildAdapter, AdapterPresets } from './adapter/builder.js'

// ─────────────────────────────────────────────────────────────
// WAL (Write-Ahead Log) - Phase 4
// ─────────────────────────────────────────────────────────────

export {
	WriteAheadLog,
	setWALManager,
	getWALManager,
	isWALEnabled,
	buildCreateDeltas,
	buildCreateSegmentedDeltas,
	buildUpdateDeltas,
	buildUpdateSegmentedDeltas,
	buildUpdateChunkToSegmentsDeltas,
	buildUpdateSegmentsToChunkDeltas,
	buildDeleteDeltas,
	buildDeleteSegmentedDeltas,
	computePatch,
	applyPatch,
	recoverWAL,
	applyCatalogSetDelta,
	applyCatalogSetSegmentsDelta,
	applyCatalogDeleteDelta,
	replayEntryWithContext,
	rollbackEntryWithContext
} from './wal/index.js'

export type {
	WalOp,
	WalPhase,
	WalAuthoritativeDelta,
	WalInverseDelta,
	WalDerivedDelta,
	ChunkPutDelta,
	ChunkPatchDelta,
	ChunkDeleteDelta,
	CatalogSetDelta,
	CatalogDeleteDelta,
	CatalogSetSegmentsDelta,
	UniqueAcquireDelta,
	UniqueReleaseDelta,
	SegmentPutDelta,
	SegmentDeleteDelta,
	SegmentWrite,
	FilterAddDelta,
	FilterRemoveDelta,
	IndexUpsertDelta,
	IndexRemoveDelta,
	WalSegmentInfo,
	WALEntry,
	WALEntryHeader,
	WALEntryInput,
	RecoveryResult,
	WALConfig,
	DeltaBuildResult,
	UniqueChange,
	UniqueUpdate,
	RecoveryContext
} from './wal/index.js'

// WAL constants
export {
	WAL_ENTRY_PREFIX as WAL_ENTRY_KEY_PREFIX,
	WAL_SEGMENT_PREFIX,
	WAL_STALE_THRESHOLD_MS,
	WAL_CLOCK_SKEW_TOLERANCE_MS,
	WAL_DEFAULT_SEGMENT_SIZE
} from './core/constants.js'

// ─────────────────────────────────────────────────────────────
// Integrity (Phase 6)
// ─────────────────────────────────────────────────────────────

export {
	IntegrityChecker,
	RepairEngine,
	rebuildCatalogFromChunks,
	verifyCatalogIntegrity
} from './integrity/index.js'
export type {
	FilterIntegrityResult,
	IndexIntegrityResult,
	UniqueIntegrityResult,
	IntegrityReport,
	IntegrityCheckOptions,
	IntegrityCheckProgress,
	RepairResult,
	FullRepairResult,
	RepairOptions,
	RepairProgress,
	CatalogRebuildResult,
	CatalogRebuildOptions,
	CatalogRebuildProgress,
	CatalogVerificationResult
} from './integrity/index.js'

// ─────────────────────────────────────────────────────────────
// Index (Phase 6)
// ─────────────────────────────────────────────────────────────

export { CuckooFilter, SortedIndex, IndexPersistenceManager, setIndexPersistenceManager, getIndexPersistenceManager, QueryPlanner, executeIndexPlan, filterMightContain } from './index/index.js'
export type {
	CuckooFilterData,
	CuckooFilterOptions,
	SortedIndexData,
	RangeOptions,
	IndexPersistenceOptions,
	EpochData,
	FlushResult,
	AvailableIndexes,
	QueryArgs,
	WhereInput,
	OrderByInput,
	QueryPlan
} from './index/index.js'

// ─────────────────────────────────────────────────────────────
// Migration (Phase 7)
// ─────────────────────────────────────────────────────────────

// User-facing API
export { defineMigration, generateMigrationFilename, generateMigrationContent, MIGRATION_TEMPLATE } from './migration/define.js'

// Migration runner and registry
export { MigrationRunner, createMigrationRunner, MigrationRegistry, migrationRegistry } from './migration/index.js'
export type { MigrationRunnerOptions } from './migration/runner.js'

// Schema diff and analysis
export { analyzeSchemaChanges, analyzeNamespaceChanges, formatSchemaChanges, hasSchemaChanged, summarizeChanges } from './migration/diff.js'

// Schema metadata manager
export { SchemaMetadataManager } from './migration/metadata.js'

// Schema history manager
export { SchemaHistoryManager } from './migration/history.js'

// Migration lock
export { MigrationLockManager } from './migration/lock.js'
export type { LockAcquisitionResult, LockStatus, MigrationLockOptions } from './migration/lock.js'

// Migration types
export type {
	FieldMetadata,
	RelationMetadata,
	SchemaMetadata,
	SchemaSnapshot,
	SchemaHistoryEntry,
	SchemaChangeType,
	SchemaChange,
	ChangeAnalysisResult,
	MigrationDefinition,
	RegisteredMigration,
	MigrationMetadata,
	MigrationLock,
	MigrationStatus,
	MigrationResult,
	MigrationRunOptions,
	MigrationStatusReport,
	MigrationContext,
	MigrationModelAccessor,
	AutoRepairConfig,
	VersionDiff,
	ModelDiff,
	FieldDiffEntry
} from './migration/types.js'

// Type conversion helpers
export { normalizedFieldToMetadata, metadataToNormalizedField } from './migration/types.js'

// Migration constants
export {
	MIGRATION_LOCK_KEY,
	MIGRATION_STATUS_PREFIX,
	MIGRATION_LOCK_TIMEOUT_MS,
	MAX_SCHEMA_HISTORY_ENTRIES,
	DEFAULT_AUTO_REPAIR_CONFIG,
	SCHEMA_META_SUFFIX
} from './core/constants.js'

// ─────────────────────────────────────────────────────────────
// Transactions (Phase 8)
// ─────────────────────────────────────────────────────────────

export {
	TransactionContext,
	SerialTransactionQueue,
	getSerialQueue,
	clearSerialQueue
} from './transaction/context.js'

export {
	resolveAutoMode,
	validateMode,
	hasAcidSupport,
	requiresAcid,
	buildTransactionOptions,
	getModeName,
	requiresVersionTracking,
	delay,
	calculateRetryDelay
} from './transaction/modes.js'

export type {
	TransactionMode,
	ResolvedTransactionMode,
	TransactionOptions,
	ITransactionContext,
	TransactionContextState,
	TransactionResult,
	TransactionExecutionOptions,
	StagedOperation,
	ReadSetEntry,
	SerialQueueItem,
	TransactionCommitHandler,
	ModelTransactionContext
} from './transaction/types.js'

// Transaction constants
export {
	VERSION_FIELD_NAME,
	MAX_VERSION_VALUE,
	VERSION_OVERFLOW_WARN_THRESHOLD
} from './core/constants.js'

// ─────────────────────────────────────────────────────────────
// Bulk Operations (Phase 8)
// ─────────────────────────────────────────────────────────────

export type {
	CreateManyArgs,
	UpdateManyArgs,
	DeleteManyArgs,
	UpsertArgs,
	BatchResult
} from './schema/types.js'

// ─────────────────────────────────────────────────────────────
// Relations (Phase 9)
// ─────────────────────────────────────────────────────────────

export {
	JunctionTableManager,
	getJunctionModelName,
	getJunctionTableDef,
	createJunctionSchema,
	isJunctionModel,
	parseJunctionModelName,
	validateForeignKey,
	validateForeignKeys,
	validateRelationsSchema,
	collectCascadeOperations,
	executeCascadeOperations,
	checkRestrictConstraints,
	resolveInclude,
	resolveIncludesBatched,
	hasIncludes
} from './relation/index.js'

export type {
	CascadeOp,
	IncludeOptions,
	JunctionTableDef,
	ParsedIncludeEntry,
	RelationInfo,
	RelationValidationError,
	BatchedIncludeResult,
	ManyToManyConnect,
	RelationFieldValue,
	IncludeContext,
	CascadeContext
} from './relation/index.js'

// Relation constants
export {
	MAX_CASCADE_DEPTH,
	MAX_INCLUDE_DEPTH,
	JUNCTION_PREFIX,
	DEFAULT_ON_DELETE
} from './core/constants.js'

// ─────────────────────────────────────────────────────────────
// Plugin System (Phase 10)
// ─────────────────────────────────────────────────────────────

// Plugin definition and utilities
export {
	definePlugin,
	defineIndex,
	createSimpleIndex,
	createTrieIndex,
	createFullTextIndex,
	trieIndexProvider,
	fullTextIndexProvider
} from './plugin/define.js'

// Middleware utilities
export {
	executeWithMiddleware,
	createLoggingMiddleware,
	createValidationMiddleware,
	createErrorHandlerMiddleware,
	createConditionalMiddleware,
	composeMiddleware,
	forModels,
	forOperations
} from './plugin/middleware.js'

// Plugin context
export {
	getPluginContext,
	hasPlugin,
	getPluginNames,
	createBoundContext,
	applyModelExtensions,
	createClientExtensions,
	wrapModelWithPluginAccess
} from './plugin/context.js'

export type {
	WithPluginExtensions,
	WithClientExtensions
} from './plugin/context.js'

// Plugin manager
export {
	PluginManager,
	getPluginManager,
	setPluginManager,
	createPluginManager
} from './plugin/manager.js'

// Plugin utilities for plugin authors
export {
	evaluateWhere as evaluatePluginWhere,
	computePatches,
	applyPatches
} from './plugin/utils.js'

// Plugin types
export type {
	FlashcorePlugin as FlashcorePluginDefinition,
	PluginSetupContext,
	ModelInfo,
	PluginMiddleware,
	OperationType,
	MiddlewareFn,
	OperationParams,
	OperationResult,
	PluginContext,
	OperationArgs,
	CreateArgs,
	UpdateArgs as PluginUpdateArgs,
	DeleteArgs as PluginDeleteArgs,
	FindUniqueArgs as PluginFindUniqueArgs,
	CountArgs as PluginCountArgs,
	CreateManyArgs as PluginCreateManyArgs,
	UpdateManyArgs as PluginUpdateManyArgs,
	DeleteManyArgs as PluginDeleteManyArgs,
	UpsertArgs as PluginUpsertArgs,
	IndexProvider,
	IndexOptions,
	Index,
	QueryContext,
	QueryOperatorFn,
	ModelQueryResolver,
	FieldQueryResolver,
	JSONPatch
} from './plugin/types.js'
