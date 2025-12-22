/**
 * Flashcore Realtime Subscription Manager
 *
 * Manages subscriptions for realtime updates.
 * Tracks record IDs and notifies callbacks on changes.
 */

import { evaluatePluginWhere } from 'robo.js/flashcore.js'
import type { JSONPatch, SubscriptionCallbacks, SubscriptionConfig } from './types.js'

// ============================================================================
// Constants
// ============================================================================

/**
 * Default subscription configuration.
 */
export const DEFAULT_SUBSCRIPTION_CONFIG: Required<SubscriptionConfig> = {
	maxSubscriptionsPerModel: 1000,
	maxTotalSubscriptions: 10000,
	idleTimeout: 3600000, // 1 hour
	maxRecordsPerSubscription: 10000
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Subscription limit error.
 */
export class SubscriptionLimitError extends Error {
	constructor(
		message: string,
		public readonly type: 'per-model' | 'total' | 'records'
	) {
		super(message)
		this.name = 'SubscriptionLimitError'
	}
}

// ============================================================================
// Subscription Manager
// ============================================================================

/**
 * Internal subscription state.
 */
interface InternalSubscription<T> {
	id: string
	model: string
	where: Record<string, unknown>
	callbacks: SubscriptionCallbacks<T>
	currentIds: Set<string>
	lastActivity: number
}

/**
 * Create a subscription manager for use in plugins.
 *
 * This is a helper for building realtime plugins.
 */
export function createSubscriptionManager<
	T extends { id: string; [key: string]: unknown } = { id: string; [key: string]: unknown }
>(config?: SubscriptionConfig) {
	const cfg = { ...DEFAULT_SUBSCRIPTION_CONFIG, ...config }

	// Model → Set of subscriptions
	const subscriptions = new Map<string, Set<InternalSubscription<T>>>()

	// Total count
	let totalCount = 0

	// Cleanup timer
	let cleanupTimer: ReturnType<typeof setInterval> | null = null

	function startCleanupTimer(): void {
		if (cleanupTimer) return

		cleanupTimer = setInterval(() => {
			const now = Date.now()
			const expiry = cfg.idleTimeout

			for (const [model, subs] of subscriptions) {
				for (const sub of subs) {
					if (now - sub.lastActivity > expiry) {
						// Subscription is idle - remove it
						subs.delete(sub)
						totalCount--
						sub.callbacks.onComplete?.()
					}
				}

				// Clean up empty model sets
				if (subs.size === 0) {
					subscriptions.delete(model)
				}
			}
		}, 60000) // Check every minute

		// Don't keep process alive
		if (cleanupTimer.unref) {
			cleanupTimer.unref()
		}
	}

	return {
		/**
		 * Register a subscription.
		 *
		 * @param model - Model name
		 * @param where - Filter criteria
		 * @param callbacks - Subscription callbacks
		 * @param initialIds - Initial set of matching record IDs
		 * @returns Unsubscribe function
		 */
		register(
			model: string,
			where: Record<string, unknown>,
			callbacks: SubscriptionCallbacks<T>,
			initialIds: string[] = []
		): () => void {
			// Check total limit
			if (totalCount >= cfg.maxTotalSubscriptions) {
				throw new SubscriptionLimitError(
					`Maximum total subscriptions (${cfg.maxTotalSubscriptions}) exceeded`,
					'total'
				)
			}

			// Check per-model limit
			const modelSubs = subscriptions.get(model)
			if (modelSubs && modelSubs.size >= cfg.maxSubscriptionsPerModel) {
				throw new SubscriptionLimitError(
					`Maximum subscriptions per model (${cfg.maxSubscriptionsPerModel}) exceeded for ${model}`,
					'per-model'
				)
			}

			// Check initial record count
			if (initialIds.length > cfg.maxRecordsPerSubscription) {
				throw new SubscriptionLimitError(
					`Subscription would track ${initialIds.length} records, exceeding limit of ${cfg.maxRecordsPerSubscription}`,
					'records'
				)
			}

			// Create subscription
			const subscription: InternalSubscription<T> = {
				id: crypto.randomUUID(),
				model,
				where,
				callbacks,
				currentIds: new Set(initialIds),
				lastActivity: Date.now()
			}

			// Register
			if (!subscriptions.has(model)) {
				subscriptions.set(model, new Set())
			}
			subscriptions.get(model)!.add(subscription)
			totalCount++

			// Start cleanup timer if first subscription
			if (totalCount === 1) {
				startCleanupTimer()
			}

			// Return unsubscribe function
			return () => {
				const subs = subscriptions.get(model)
				if (subs) {
					subs.delete(subscription)
					totalCount--
					if (subs.size === 0) {
						subscriptions.delete(model)
					}
				}
			}
		},

		/**
		 * Notify subscriptions of a create event.
		 */
		notifyCreate(model: string, record: T): void {
			const subs = subscriptions.get(model)
			if (!subs) return

			for (const sub of subs) {
				if (evaluatePluginWhere(record as Record<string, unknown>, sub.where)) {
					sub.currentIds.add(record.id)
					sub.lastActivity = Date.now()
					sub.callbacks.onAdd?.(record)
				}
			}
		},

		/**
		 * Notify subscriptions of an update event.
		 */
		notifyUpdate(model: string, before: T, after: T, patches: JSONPatch[]): void {
			const subs = subscriptions.get(model)
			if (!subs) return

			for (const sub of subs) {
				const wasMatch = sub.currentIds.has(before.id)
				const isMatch = evaluatePluginWhere(after as Record<string, unknown>, sub.where)

				sub.lastActivity = Date.now()

				if (!wasMatch && isMatch) {
					// Entered the subscription
					sub.currentIds.add(after.id)
					sub.callbacks.onAdd?.(after)
				} else if (wasMatch && !isMatch) {
					// Left the subscription
					sub.currentIds.delete(after.id)
					sub.callbacks.onRemove?.(before)
				} else if (wasMatch && isMatch) {
					// Still matches - notify of change
					sub.callbacks.onChange?.(after, patches)
				}
			}
		},

		/**
		 * Notify subscriptions of a delete event.
		 */
		notifyDelete(model: string, record: T): void {
			const subs = subscriptions.get(model)
			if (!subs) return

			for (const sub of subs) {
				if (sub.currentIds.has(record.id)) {
					sub.currentIds.delete(record.id)
					sub.lastActivity = Date.now()
					sub.callbacks.onRemove?.(record)
				}
			}
		},

		/**
		 * Shutdown the subscription manager.
		 * Calls onComplete for all subscriptions.
		 */
		shutdown(): void {
			if (cleanupTimer) {
				clearInterval(cleanupTimer)
				cleanupTimer = null
			}

			for (const subs of subscriptions.values()) {
				for (const sub of subs) {
					sub.callbacks.onComplete?.()
				}
			}

			subscriptions.clear()
			totalCount = 0
		},

		/**
		 * Get current subscription count.
		 */
		get count(): number {
			return totalCount
		},

		/**
		 * Get subscription count for a model.
		 */
		getModelCount(model: string): number {
			return subscriptions.get(model)?.size ?? 0
		}
	}
}
