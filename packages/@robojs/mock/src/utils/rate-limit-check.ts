import type { Session } from '../session/session.js'

/**
 * Check if rate limit simulation should trigger for a given endpoint
 * Returns a 429 Response if rate limited, null otherwise
 *
 * @param session - The session to check rate limit for
 * @param endpoint - The endpoint path (e.g., '/channels/123/messages')
 * @returns Response if rate limited, null if not
 */
export function checkRateLimitForEndpoint(session: Session, endpoint: string): Response | null {
	const rateLimit = session.checkRateLimit(endpoint)

	if (!rateLimit) {
		return null
	}

	return new Response(
		JSON.stringify({
			message: 'You are being rate limited.',
			retry_after: rateLimit.retryAfter,
			global: false
		}),
		{
			status: 429,
			headers: {
				'Content-Type': 'application/json',
				'Retry-After': String(rateLimit.retryAfter),
				'X-RateLimit-Global': 'false',
				'X-RateLimit-Limit': '5',
				'X-RateLimit-Remaining': '0',
				'X-RateLimit-Reset-After': String(rateLimit.retryAfter),
				'X-RateLimit-Bucket': 'mock-rate-limit-bucket'
			}
		}
	)
}
