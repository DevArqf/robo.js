/**
 * Flashcore Realtime Plugin
 *
 * Provides realtime subscriptions for Flashcore models.
 * Notifies subscribers when records matching their filters are
 * created, updated, or deleted.
 */

import type { FlashcoreModel, PluginContext } from 'robo.js/flashcore.js'
import { definePlugin, computePatches } from 'robo.js/flashcore.js'
import { createSubscriptionManager } from './subscription-manager.js'
import type { SubscriptionCallbacks, JSONPatch, SubscriptionConfig } from './types.js'

/**
 * Realtime plugin configuration.
 */
export interface RealtimeConfig {
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
	 * Idle timeout in milliseconds. Subscriptions without activity
	 * for this duration will be automatically cleaned up.
	 * @default 3600000 (1 hour)
	 */
	idleTimeout?: number

	/**
	 * Maximum records tracked per subscription.
	 * @default 10000
	 */
	maxRecordsPerSubscription?: number
}

/**
 * Subscription arguments for model.subscribe().
 */
export interface SubscribeArgs<T> {
	where?: Record<string, unknown>
	callbacks: SubscriptionCallbacks<T>
}

/**
 * Realtime plugin state.
 */
interface RealtimeState {
	manager: ReturnType<typeof createSubscriptionManager>
}

/**
 * Realtime plugin model extensions.
 */
interface RealtimeModelExtensions {
	/**
	 * Subscribe to changes matching the given filter.
	 *
	 * @param args - Subscription arguments with where clause and callbacks
	 * @returns Unsubscribe function
	 *
	 * @example
	 * ```typescript
	 * const unsubscribe = User.subscribe({
	 *   where: { status: 'active' },
	 *   callbacks: {
	 *     onAdd: (user) => console.log('New active user:', user),
	 *     onChange: (user, patches) => console.log('User changed:', patches),
	 *     onRemove: (user) => console.log('User removed:', user),
	 *   }
	 * })
	 *
	 * // Later: stop receiving updates
	 * unsubscribe()
	 * ```
	 */
	subscribe<T extends { id: string }>(
		this: FlashcoreModel<T>,
		args: SubscribeArgs<T>
	): () => void
}

/**
 * Realtime plugin client extensions.
 */
interface RealtimeClientExtensions {
	/**
	 * Get current subscription count.
	 */
	getSubscriptionCount(): number

	/**
	 * Get subscription count for a specific model.
	 */
	getModelSubscriptionCount(model: string): number
}

/**
 * Create the realtime plugin.
 *
 * @example
 * ```typescript
 * import { Flashcore } from 'robo.js'
 * import { realtime } from '@robojs/sync/flashcore'
 *
 * await Flashcore.init({
 *   plugins: [realtime()]
 * })
 *
 * // Now models have .subscribe() method
 * const unsubscribe = User.subscribe({
 *   where: { status: 'active' },
 *   callbacks: {
 *     onAdd: (user) => console.log('New active user:', user),
 *     onChange: (user, patches) => console.log('User changed:', user, patches),
 *     onRemove: (user) => console.log('User removed:', user),
 *   }
 * })
 * ```
 */
export function realtime(config?: RealtimeConfig) {
	// Create subscription manager outside definePlugin to use via closure
	let manager: ReturnType<typeof createSubscriptionManager> | null = null

	return definePlugin<RealtimeClientExtensions, RealtimeModelExtensions, RealtimeState>({
		name: 'realtime',

		setup(ctx) {
			// Create subscription manager with config
			manager = createSubscriptionManager<{ id: string }>({
				maxSubscriptionsPerModel: config?.maxSubscriptionsPerModel,
				maxTotalSubscriptions: config?.maxTotalSubscriptions,
				idleTimeout: config?.idleTimeout,
				maxRecordsPerSubscription: config?.maxRecordsPerSubscription
			})
			// Also store in state for model extensions to access via pluginContext
			ctx.state.manager = manager
		},

		shutdown() {
			// Clean up all subscriptions
			manager?.shutdown()
		},

		middleware: {
			// Notify on create
			async create(params, next) {
				const result = await next()
				if (result && manager) {
					manager.notifyCreate(params.model.name, result as { id: string })
				}
				return result
			},

			// Notify on update with JSON patches
			async update(params, next) {
				// Get the record before update
				const args = params.args as unknown as { where: { id: string } }
				const before = await params.model.findUnique({ where: args.where })

				const result = await next()

				if (before && result && manager) {
					const patches = computePatches(
						before as Record<string, unknown>,
						result as Record<string, unknown>
					)
					manager.notifyUpdate(
						params.model.name,
						before as { id: string },
						result as { id: string },
						patches
					)
				}

				return result
			},

			// Notify on delete
			async delete(params, next) {
				// Get the record before delete
				const args = params.args as unknown as { where: { id: string } }
				const before = await params.model.findUnique({ where: args.where })

				const result = await next()

				if (before && manager) {
					manager.notifyDelete(params.model.name, before as { id: string })
				}

				return result
			}
		},

		modelExtensions: {
			subscribe<T extends { id: string }>(
				this: FlashcoreModel<T> & { pluginContext: (name: string) => PluginContext },
				args: SubscribeArgs<T>
			): () => void {
				const ctx = this.pluginContext('realtime') as PluginContext & { state: RealtimeState }

				// Get initial matching IDs by querying the model
				// We need to do this synchronously for the subscription setup
				// so we'll start with an empty set and populate it on first notification
				const initialIds: string[] = []

				return ctx.state.manager.register(
					this.name,
					args.where ?? {},
					args.callbacks as SubscriptionCallbacks<{ id: string }>,
					initialIds
				)
			}
		},

		clientExtensions: {
			getSubscriptionCount(): number {
				return manager?.count ?? 0
			},

			getModelSubscriptionCount(model: string): number {
				return manager?.getModelCount(model) ?? 0
			}
		}
	})
}

// Re-export types from core for convenience
export type { SubscriptionCallbacks, JSONPatch, SubscriptionConfig }
