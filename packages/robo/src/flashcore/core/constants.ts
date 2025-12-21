/**
 * Flashcore v4.3 Constants
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
 * Prefix for v4 encoded keys that contain special characters.
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
