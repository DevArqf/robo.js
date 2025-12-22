/**
 * Flashcore v1 Constants (spec rev 4.3)
 *
 * Reserved prefixes, default values, and limits.
 */

/**
 * Reserved key prefixes for internal Flashcore data.
 * User KV set/delete operations must reject keys starting with these prefixes.
 * User get/has operations are allowed (for debugging/introspection).
 */
export const RESERVED_PREFIXES = ['_model:', '_flashcore:', '_wal:', '_junction_'] as const

/**
 * Check if a key starts with a reserved prefix.
 */
export function isReservedPrefix(key: string): boolean {
	return RESERVED_PREFIXES.some((prefix) => key.startsWith(prefix))
}

/**
 * Default namespace separator for joining array namespaces.
 * Used when namespace is provided as string[].
 */
export const DEFAULT_NAMESPACE_SEPARATOR = '/'

/**
 * Separator between namespace and key in the legacy composed key format.
 */
export const LEGACY_KEY_SEPARATOR = '__'

/**
 * Prefix for encoded keys that contain special characters.
 * When a key contains characters that need encoding, it's stored as `_e:{base64url}`.
 */
export const ENCODED_KEY_PREFIX = '_e:'

/**
 * Default chunk size limits.
 */
export const DEFAULT_MAX_CHUNK_SIZE = 100_000 // 100KB

/**
 * Default maximum records per chunk.
 */
export const DEFAULT_MAX_RECORDS_PER_CHUNK = 50

/**
 * Default LRU cache size for chunks (number of chunks to cache per model).
 */
export const DEFAULT_CHUNK_CACHE_SIZE = 20

/**
 * Prefix for record segments (large records split across multiple keys).
 * Full key format: _model:{ns}::{model}:seg:{recordId}:{n}
 */
export const RECORD_SEGMENT_PREFIX = 'seg:'

/**
 * Storage exhaustion error patterns to detect.
 */
export const STORAGE_EXHAUSTION_PATTERNS = [
	/ENOSPC/i,
	/no space left/i,
	/quota exceeded/i,
	/disk full/i,
	/storage limit/i
] as const

/**
 * Default safety limits for queries.
 */
export const DEFAULT_SAFETY_LIMITS = {
	/**
	 * Maximum records returned by findMany without explicit take.
	 */
	maxDefaultResults: 1_000,

	/**
	 * Threshold at which to warn about large result sets.
	 */
	warnResultsThreshold: 1_000,

	/**
	 * Maximum bulk operations allowed without a where clause.
	 */
	maxBulkOperationWithoutWhere: 100
} as const

/**
 * Alias for safety config (used by query operations).
 */
export const DEFAULT_SAFETY_CONFIG = DEFAULT_SAFETY_LIMITS

/**
 * Default connection/retry settings.
 */
export const DEFAULT_CONNECTION_SETTINGS = {
	/**
	 * Maximum retry attempts for transient errors.
	 */
	maxRetries: 3,

	/**
	 * Base delay for exponential backoff (ms).
	 */
	retryBaseDelay: 100,

	/**
	 * Maximum delay between retries (ms).
	 */
	retryMaxDelay: 5_000
} as const

/**
 * Default transaction settings.
 */
export const DEFAULT_TRANSACTION_SETTINGS = {
	/**
	 * Default transaction timeout (ms).
	 */
	timeout: 30_000,

	/**
	 * Maximum retries for optimistic transactions.
	 */
	maxRetries: 3,

	/**
	 * Delay between optimistic transaction retries (ms).
	 */
	retryDelay: 100
} as const

/**
 * Default index persistence settings.
 */
export const DEFAULT_INDEX_PERSISTENCE_SETTINGS = {
	/**
	 * Whether to flush indexes on process shutdown.
	 */
	flushOnShutdown: true,

	/**
	 * Maximum time to wait for index flush on shutdown (ms).
	 */
	shutdownTimeout: 5_000,

	/**
	 * Interval for periodic index persistence (ms). 0 = disabled.
	 */
	intervalMs: 0
} as const

/**
 * Maximum lengths for validation.
 */
export const MAX_LENGTHS = {
	/**
	 * Maximum length for record IDs.
	 */
	recordId: 200,

	/**
	 * Maximum length for unique field values before encoding.
	 */
	uniqueFieldValue: 500,

	/**
	 * Maximum length for composed storage keys.
	 */
	composedKey: 1_000
} as const

/**
 * Valid characters for record IDs (no encoding needed).
 */
export const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]+$/

/**
 * Characters that are safe in storage keys (no encoding needed).
 */
export const SAFE_KEY_CHARS = /^[A-Za-z0-9_:\-./]+$/

// ─────────────────────────────────────────────────────────────
// WAL (Write-Ahead Log) Constants
// ─────────────────────────────────────────────────────────────

/**
 * Key prefix for WAL entry headers.
 * Full key format: _flashcore:wal:entry:{id}
 */
export const WAL_ENTRY_PREFIX = '_flashcore:wal:entry:'

/**
 * Key prefix for WAL entry segments (for large entries).
 * Full key format: _flashcore:wal:seg:{id}:{n}
 */
export const WAL_SEGMENT_PREFIX = '_flashcore:wal:seg:'

/**
 * Default threshold for considering a WAL entry "stale" (5 minutes).
 * Stale entries in 'pending' phase are rolled back instead of replayed.
 */
export const WAL_STALE_THRESHOLD_MS = 5 * 60 * 1000

/**
 * Clock skew tolerance for WAL staleness detection (5 seconds).
 * Entries with timestamps slightly in the future are still considered valid.
 */
export const WAL_CLOCK_SKEW_TOLERANCE_MS = 5 * 1000

/**
 * Default maximum size for a single WAL entry value (100KB).
 * Entries exceeding this are segmented across multiple keys.
 */
export const WAL_DEFAULT_SEGMENT_SIZE = 100_000

// ─────────────────────────────────────────────────────────────
// Phase 6: Index/Filter Constants
// ─────────────────────────────────────────────────────────────

/**
 * Default number of entries per bucket in the Cuckoo filter.
 */
export const DEFAULT_FILTER_BUCKET_SIZE = 4

/**
 * Fingerprint size in bits for Cuckoo filter.
 * 16-bit fingerprints support deletion and provide ~0.003% false positive rate at 95% load.
 */
export const DEFAULT_FILTER_FP_SIZE = 16

/**
 * Load factor threshold at which to resize the Cuckoo filter.
 */
export const DEFAULT_FILTER_LOAD_FACTOR = 0.95

/**
 * Maximum kick attempts before declaring insert failure (triggers resize).
 */
export const DEFAULT_FILTER_MAX_KICKS = 500

/**
 * Default initial capacity for Cuckoo filter (number of buckets).
 */
export const DEFAULT_FILTER_INITIAL_CAPACITY = 256

/**
 * Default index memory limit in bytes (50MB).
 */
export const DEFAULT_INDEX_MEMORY_LIMIT = 50 * 1024 * 1024

/**
 * Default maximum records to hold in memory for operations.
 */
export const DEFAULT_MAX_IN_MEMORY_RECORDS = 100_000

/**
 * Key suffix for filter storage.
 * Full key: _model:{ns}::{model}:filter
 */
export const FILTER_KEY_SUFFIX = 'filter'

/**
 * Key prefix for sorted index storage.
 * Full key: _model:{ns}::{model}:idx:{field} or _model:{ns}::{model}:idx:{field}:{indexType}
 */
export const INDEX_KEY_PREFIX = 'idx:'

/**
 * B+Tree default order (max children per node).
 */
export const DEFAULT_BTREE_ORDER = 32

/**
 * Default minimum entries for B+Tree leaf nodes before merging.
 */
export const DEFAULT_BTREE_MIN_LEAF_ENTRIES = 16

// ─────────────────────────────────────────────────────────────
// Phase 7: Migration Constants
// ─────────────────────────────────────────────────────────────

/**
 * Key for the migration lock.
 * Only one migration can run at a time across all processes.
 */
export const MIGRATION_LOCK_KEY = '_flashcore:migrations:lock'

/**
 * Key prefix for migration metadata.
 * Full key: _flashcore:migrations:{name}
 */
export const MIGRATION_STATUS_PREFIX = '_flashcore:migrations:'

/**
 * Default migration lock timeout (5 minutes).
 * Locks older than this are considered stale and can be overridden.
 */
export const MIGRATION_LOCK_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Maximum number of schema history entries to keep.
 */
export const MAX_SCHEMA_HISTORY_ENTRIES = 100

/**
 * Default auto-repair configuration.
 * Catalog is never auto-repaired by default (requires explicit opt-in).
 */
export const DEFAULT_AUTO_REPAIR_CONFIG = {
	filter: true,
	indexes: true,
	uniqueIndexes: true,
	catalog: false // Never by default - too dangerous
} as const

/**
 * Key suffix for model schema metadata.
 * Full key: _model:{ns}::{model}:_meta
 */
export const SCHEMA_META_SUFFIX = '_meta'

// ─────────────────────────────────────────────────────────────
// Phase 8: Transaction Constants
// ─────────────────────────────────────────────────────────────

/**
 * Name of the auto-injected version field for optimistic locking.
 */
export const VERSION_FIELD_NAME = '_version'

/**
 * Maximum safe version value (2^53 - 1).
 * JavaScript's safe integer limit. When exceeded, version resets to 1.
 */
export const MAX_VERSION_VALUE = Number.MAX_SAFE_INTEGER

/**
 * Threshold for version overflow warning.
 * Warn when version exceeds 90% of MAX_VERSION_VALUE.
 */
export const VERSION_OVERFLOW_WARN_THRESHOLD = Math.floor(MAX_VERSION_VALUE * 0.9)

// ─────────────────────────────────────────────────────────────
// Phase 9: Relation Constants
// ─────────────────────────────────────────────────────────────

/**
 * Maximum cascade depth to prevent infinite recursion.
 * If cascade operations exceed this depth, an error is thrown.
 */
export const MAX_CASCADE_DEPTH = 50

/**
 * Maximum include depth for relation loading.
 * Prevents infinite recursion in nested includes.
 */
export const MAX_INCLUDE_DEPTH = 10

/**
 * Prefix for junction table model names.
 * Junction tables are named: _junction_{modelA}_{modelB} (alphabetical order)
 */
export const JUNCTION_PREFIX = '_junction_'

/**
 * Default onDelete action for relations.
 */
export const DEFAULT_ON_DELETE = 'restrict' as const
