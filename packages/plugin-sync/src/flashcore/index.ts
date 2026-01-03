/**
 * Flashcore Realtime Plugin
 *
 * Provides realtime subscriptions for Flashcore models.
 */

export { realtime } from './plugin.js'
export type { RealtimeConfig, SubscribeArgs } from './plugin.js'

// Subscription utilities (for plugin authors building realtime features)
export { createSubscriptionManager, SubscriptionLimitError, DEFAULT_SUBSCRIPTION_CONFIG } from './subscription-manager.js'
export type { SubscriptionCallbacks, JSONPatch, SubscriptionConfig, Subscription } from './types.js'
