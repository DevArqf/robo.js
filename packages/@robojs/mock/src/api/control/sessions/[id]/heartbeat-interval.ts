import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../../core/manager.js'
import { validateMethod, notFound, badRequest } from '../../utils.js'
import { getGatewayServer } from '../../../../core/gateway.js'

/**
 * GET /api/control/sessions/:id/heartbeat-interval - Get heartbeat interval for this session
 * POST /api/control/sessions/:id/heartbeat-interval - Set heartbeat interval for new connections
 *
 * Request body:
 * {
 *   interval: number | null  // Heartbeat interval in ms (100-120000), or null to use global default
 * }
 *
 * Response:
 * {
 *   success: true,
 *   interval: number | null,
 *   effectiveInterval: number  // The actual interval that will be used (session or global)
 * }
 *
 * This sets the heartbeat interval for NEW connections in this session only.
 * Existing connections keep their original interval.
 * Other sessions are unaffected.
 *
 * Use shorter intervals (e.g., 1000ms) for faster testing of heartbeat behavior.
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

	const gateway = getGatewayServer()
	const globalInterval = gateway.getHeartbeatInterval()

	// GET - Check current heartbeat interval
	if (request.method === 'GET') {
		const sessionInterval = session.heartbeatInterval
		return {
			interval: sessionInterval,
			effectiveInterval: sessionInterval ?? globalInterval,
			globalDefault: globalInterval
		}
	}

	// POST - Set heartbeat interval
	let body: {
		interval?: number | null
	}

	try {
		body = await request.json()
	} catch {
		return badRequest('Invalid JSON body')
	}

	const interval = body.interval

	// Allow null to reset to global default
	if (interval !== null && interval !== undefined) {
		if (typeof interval !== 'number' || interval < 100 || interval > 120000) {
			return badRequest('interval must be a number between 100 and 120000 ms, or null to use global default')
		}
	}

	session.heartbeatInterval = interval ?? null

	return {
		success: true,
		interval: session.heartbeatInterval,
		effectiveInterval: session.heartbeatInterval ?? globalInterval,
		globalDefault: globalInterval
	}
}
