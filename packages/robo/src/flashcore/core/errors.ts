/**
 * Flashcore v4.3 Error Types
 *
 * All user-facing operations throw consistent error types (not raw adapter errors).
 */

/**
 * Base error class for all Flashcore errors.
 */
export class FlashcoreError extends Error {
	readonly code: string

	constructor(message: string, code: string = 'FLASHCORE_ERROR', options?: ErrorOptions) {
		super(message, options)
		this.name = 'FlashcoreError'
		this.code = code
		// Maintains proper stack trace in V8 environments
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor)
		}
	}
}

/**
 * Thrown when input validation fails (schema validation, type checking, required fields).
 */
export class ValidationError extends FlashcoreError {
	readonly field?: string
	readonly value?: unknown

	constructor(message: string, options?: { field?: string; value?: unknown; cause?: Error }) {
		super(message, 'VALIDATION_ERROR', { cause: options?.cause })
		this.name = 'ValidationError'
		this.field = options?.field
		this.value = options?.value
	}
}

/**
 * Thrown when a record is not found (e.g., update/delete on non-existent record).
 */
export class NotFoundError extends FlashcoreError {
	readonly model?: string
	readonly id?: string

	constructor(message: string, options?: { model?: string; id?: string; cause?: Error }) {
		super(message, 'NOT_FOUND', { cause: options?.cause })
		this.name = 'NotFoundError'
		this.model = options?.model
		this.id = options?.id
	}
}

/**
 * Thrown when a unique constraint is violated.
 */
export class UniqueConstraintError extends FlashcoreError {
	readonly model?: string
	readonly field?: string
	readonly value?: unknown

	constructor(message: string, options?: { model?: string; field?: string; value?: unknown; cause?: Error }) {
		super(message, 'UNIQUE_CONSTRAINT', { cause: options?.cause })
		this.name = 'UniqueConstraintError'
		this.model = options?.model
		this.field = options?.field
		this.value = options?.value
	}
}

/**
 * Thrown when a feature is not supported by the current adapter configuration.
 */
export class FeatureNotSupportedError extends FlashcoreError {
	readonly feature: string
	readonly requiredCapability?: string

	constructor(message: string, options?: { feature: string; requiredCapability?: string; cause?: Error }) {
		super(message, 'FEATURE_NOT_SUPPORTED', { cause: options?.cause })
		this.name = 'FeatureNotSupportedError'
		this.feature = options?.feature ?? 'unknown'
		this.requiredCapability = options?.requiredCapability
	}
}

/**
 * Thrown when an adapter operation fails.
 */
export class AdapterError extends FlashcoreError {
	readonly operation: string
	readonly key?: string

	constructor(message: string, options?: { operation: string; key?: string; cause?: Error }) {
		super(message, 'ADAPTER_ERROR', { cause: options?.cause })
		this.name = 'AdapterError'
		this.operation = options?.operation ?? 'unknown'
		this.key = options?.key
	}
}

/**
 * Thrown when data corruption is detected (malformed chunk, catalog mismatch).
 */
export class DataCorruptionError extends FlashcoreError {
	readonly model?: string
	readonly structure?: 'chunk' | 'catalog' | 'index' | 'filter' | 'wal'
	readonly repairGuidance?: string

	constructor(
		message: string,
		options?: { model?: string; structure?: 'chunk' | 'catalog' | 'index' | 'filter' | 'wal'; repairGuidance?: string; cause?: Error }
	) {
		super(message, 'DATA_CORRUPTION', { cause: options?.cause })
		this.name = 'DataCorruptionError'
		this.model = options?.model
		this.structure = options?.structure
		this.repairGuidance = options?.repairGuidance
	}
}

/**
 * Thrown when storage is exhausted (ENOSPC, quota exceeded).
 */
export class StorageExhaustedError extends FlashcoreError {
	constructor(message: string, options?: ErrorOptions) {
		super(message, 'STORAGE_EXHAUSTED', options)
		this.name = 'StorageExhaustedError'
	}
}

/**
 * Thrown when a transaction conflict is detected (optimistic locking failure).
 */
export class TransactionConflictError extends FlashcoreError {
	readonly model?: string
	readonly id?: string
	readonly expectedVersion?: number
	readonly actualVersion?: number

	constructor(
		message: string,
		options?: { model?: string; id?: string; expectedVersion?: number; actualVersion?: number; cause?: Error }
	) {
		super(message, 'TRANSACTION_CONFLICT', { cause: options?.cause })
		this.name = 'TransactionConflictError'
		this.model = options?.model
		this.id = options?.id
		this.expectedVersion = options?.expectedVersion
		this.actualVersion = options?.actualVersion
	}
}

/**
 * Thrown when connection to the storage backend fails after retries are exhausted.
 */
export class ConnectionError extends FlashcoreError {
	readonly retriesAttempted?: number

	constructor(message: string, options?: { retriesAttempted?: number; cause?: Error }) {
		super(message, 'CONNECTION_ERROR', { cause: options?.cause })
		this.name = 'ConnectionError'
		this.retriesAttempted = options?.retriesAttempted
	}
}

/**
 * Thrown when subscription limits are exceeded.
 */
export class SubscriptionLimitError extends FlashcoreError {
	readonly limit: number
	readonly current: number
	readonly limitType: 'perModel' | 'total' | 'recordsPerSubscription'

	constructor(message: string, options: { limit: number; current: number; limitType: 'perModel' | 'total' | 'recordsPerSubscription'; cause?: Error }) {
		super(message, 'SUBSCRIPTION_LIMIT', { cause: options?.cause })
		this.name = 'SubscriptionLimitError'
		this.limit = options.limit
		this.current = options.current
		this.limitType = options.limitType
	}
}

/**
 * Thrown when schema validation fails on startup (breaking schema drift).
 */
export class FlashcoreSchemaError extends FlashcoreError {
	readonly model?: string
	readonly schemaChange?: string
	readonly cliInstructions?: string

	constructor(message: string, options?: { model?: string; schemaChange?: string; cliInstructions?: string; cause?: Error }) {
		super(message, 'SCHEMA_ERROR', { cause: options?.cause })
		this.name = 'FlashcoreSchemaError'
		this.model = options?.model
		this.schemaChange = options?.schemaChange
		this.cliInstructions = options?.cliInstructions
	}
}

/**
 * Thrown when a migration fails.
 */
export class MigrationError extends FlashcoreError {
	readonly migrationName?: string
	readonly phase?: 'up' | 'down' | 'lock'

	constructor(message: string, options?: { migrationName?: string; phase?: 'up' | 'down' | 'lock'; cause?: Error }) {
		super(message, 'MIGRATION_ERROR', { cause: options?.cause })
		this.name = 'MigrationError'
		this.migrationName = options?.migrationName
		this.phase = options?.phase
	}
}

/**
 * Thrown when a safety limit is violated (reserved prefixes, result size limits).
 */
export class SafetyError extends FlashcoreError {
	readonly reason: string
	readonly limit?: number
	readonly actual?: number

	constructor(message: string, options: { reason: string; limit?: number; actual?: number; cause?: Error }) {
		super(message, 'SAFETY_ERROR', { cause: options?.cause })
		this.name = 'SafetyError'
		this.reason = options.reason
		this.limit = options?.limit
		this.actual = options?.actual
	}
}
