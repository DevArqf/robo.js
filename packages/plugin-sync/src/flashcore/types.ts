/**
 * Flashcore Realtime Subscription Types
 *
 * Types for the realtime subscription system.
 */

// ============================================================================
// Subscription Callbacks
// ============================================================================

/**
 * JSON Patch operation (RFC 6902).
 */
export interface JSONPatch {
	op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test'
	path: string
	value?: unknown
	from?: string
}

/**
 * Subscription callback interface.
 */
export interface SubscriptionCallbacks<T = { id: string }> {
	/**
	 * Called when a new record matches the subscription filter.
	 */
	onAdd?(record: T): void

	/**
	 * Called when a record no longer matches the subscription filter.
	 */
	onRemove?(record: T): void

	/**
	 * Called when a matching record is updated.
	 * Includes JSON Patch of changes.
	 */
	onChange?(record: T, patches: JSONPatch[]): void

	/**
	 * Called when subscription is completed (idle timeout or shutdown).
	 */
	onComplete?(): void
}

// ============================================================================
// Subscription Configuration
// ============================================================================

/**
 * Subscription configuration.
 */
export interface SubscriptionConfig {
	/**
	 * Maximum subscriptions per model.
	 * @default 1000
	 */
	maxSubscriptionsPerModel?: number

	/**
	 * Maximum total subscriptions across all models.
	 * @default 10000
	 */
	maxTotalSubscriptions?: number

	/**
	 * Time in ms before idle subscriptions are cleaned up.
	 * @default 3600000 (1 hour)
	 */
	idleTimeout?: number

	/**
	 * Maximum records per subscription (prevents overly-broad queries).
	 * @default 10000
	 */
	maxRecordsPerSubscription?: number
}

// ============================================================================
// Internal Subscription State
// ============================================================================

/**
 * Internal subscription state.
 */
export interface Subscription<T = { id: string }> {
	/**
	 * Unique subscription ID.
	 */
	id: string

	/**
	 * Model name subscribed to.
	 */
	model: string

	/**
	 * Where clause for the subscription query.
	 */
	where: Record<string, unknown>

	/**
	 * Subscription callbacks.
	 */
	callbacks: SubscriptionCallbacks<T>

	/**
	 * Current set of matching record IDs.
	 */
	currentIds: Set<string>

	/**
	 * Last activity timestamp.
	 */
	lastActivity: number
}
