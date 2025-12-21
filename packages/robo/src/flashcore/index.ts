/**
 * Flashcore v4.3
 *
 * A type-safe, Prisma-like database built on key-value storage for Robo.js.
 *
 * @module robo.js/flashcore
 * @version 4.3
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
	SubscriptionLimitError,
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
	composeV4Key,
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
