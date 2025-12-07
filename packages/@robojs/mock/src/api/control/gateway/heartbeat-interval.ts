import type { RoboRequest } from '@robojs/server'
import { getGatewayServer } from '../../../core/gateway.js'

/**
 * GET /api/control/gateway/heartbeat-interval - Get current heartbeat interval
 * POST /api/control/gateway/heartbeat-interval - Set heartbeat interval for new connections
 *
 * POST Request Body:
 * {
 *   "interval": number  // Heartbeat interval in milliseconds (default: 41250)
 * }
 *
 * Response:
 * {
 *   "interval": number,
 *   "success": boolean
 * }
 *
 * Use shorter intervals (e.g., 1000ms) for faster testing of heartbeat behavior.
 * This only affects NEW connections - existing connections keep their original interval.
 */
export default async (request: RoboRequest) => {
	const gateway = getGatewayServer()

	if (request.method === 'GET') {
		return {
			interval: gateway.getHeartbeatInterval(),
			success: true
		}
	}

	if (request.method === 'POST') {
		const body = (await request.json().catch(() => ({}))) as { interval?: number }

		// Validate interval
		const interval = body.interval
		if (typeof interval !== 'number' || interval < 100 || interval > 120000) {
			return new Response(
				JSON.stringify({
					error: 'Invalid interval. Must be a number between 100 and 120000 ms.',
					success: false
				}),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			)
		}

		gateway.setHeartbeatInterval(interval)

		return {
			interval: gateway.getHeartbeatInterval(),
			success: true
		}
	}

	return new Response(JSON.stringify({ error: 'Method not allowed' }), {
		status: 405,
		headers: { 'Content-Type': 'application/json' }
	})
}
