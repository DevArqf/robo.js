import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../../core/manager.js'
import { validateMethod, notFound, badRequest } from '../../utils.js'

/**
 * POST /api/control/sessions/:id/rate-limit - Enable rate limit simulation
 *
 * Request body:
 * {
 *   enabled: boolean      // Whether to enable rate limit simulation
 *   retry_after?: number  // Retry-After value in seconds (default: 1)
 * }
 *
 * Response:
 * {
 *   success: true,
 *   enabled: boolean,
 *   retry_after: number
 * }
 *
 * When enabled, the next API request will return a 429 Too Many Requests
 * response with the specified Retry-After header. The simulation is one-shot
 * and automatically disables after returning the 429 response.
 */
export default async (request: RoboRequest) => {
	validateMethod(request, ['POST', 'GET'])

	const { id } = request.params as { id: string }

	if (!id) {
		return notFound('Session ID required')
	}

	const session = sessionManager.get(id)

	if (!session) {
		return notFound('Session not found')
	}

	// GET - Check current rate limit simulation status
	if (request.method === 'GET') {
		return {
			enabled: session.isRateLimitSimulationActive
		}
	}

	// POST - Set rate limit simulation
	let body: {
		enabled?: boolean
		retry_after?: number
	}

	try {
		body = await request.json()
	} catch {
		return badRequest('Invalid JSON body')
	}

	const enabled = body.enabled ?? true
	const retryAfter = body.retry_after ?? 1

	if (typeof retryAfter !== 'number' || retryAfter < 0) {
		return badRequest('retry_after must be a non-negative number')
	}

	session.setRateLimitSimulation(enabled, retryAfter)

	return {
		success: true,
		enabled,
		retry_after: retryAfter
	}
}
