/**
 * Middleware for all sync operations under the 'activity' scope.
 *
 * Demonstrates:
 * - before() hook - runs before handler validation
 * - after() hook - runs after successful update
 * - Logging for debugging
 */
import type { SyncMiddlewareContext, MiddlewareResult } from '@robojs/sync/server'

/**
 * Runs before any handler processes a message.
 * Can reject the request or allow it to continue.
 */
export function before(ctx: SyncMiddlewareContext): MiddlewareResult {
	const clientName = ctx.client.data?.username ?? ctx.client.id.slice(0, 8)

	console.log(`[Sync Middleware] ${ctx.messageType.toUpperCase()} on "${ctx.cleanKey}" by ${clientName}`)

	// Example: Could implement rate limiting here
	// if (isRateLimited(ctx.client.id)) {
	//   return { reject: true, reason: 'rate_limited' }
	// }

	// Allow the request to continue
	return { continue: true }
}

/**
 * Runs after a successful update is broadcast.
 * Useful for logging, analytics, or side effects.
 */
export function after(ctx: SyncMiddlewareContext): void {
	const clientName = ctx.client.data?.username ?? ctx.client.id.slice(0, 8)

	console.log(`[Sync Middleware] Completed ${ctx.messageType} on "${ctx.cleanKey}" by ${clientName}`)
}
