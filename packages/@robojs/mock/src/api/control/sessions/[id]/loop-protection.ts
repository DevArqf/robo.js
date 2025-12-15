import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../../core/manager.js'
import { validateMethod, notFound, badRequest } from '../../utils.js'

/**
 * POST /api/control/sessions/:id/loop-protection - Enable/disable loop protection
 *
 * Request body:
 * {
 *   enabled: boolean  // Whether to enable loop protection
 * }
 *
 * Response:
 * {
 *   success: true,
 *   enabled: boolean
 * }
 *
 * Loop protection detects when a bot triggers an infinite loop by responding
 * to its own MESSAGE_CREATE events. When enabled (default), the server will
 * detect 10 MESSAGE_CREATE events within 1 second and circuit-break, dropping
 * further events for 5 seconds.
 *
 * Disable this protection if:
 * - You're intentionally testing high-frequency message scenarios
 * - You believe the detection is producing false positives
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

	// GET - Check current loop protection status
	if (request.method === 'GET') {
		return {
			enabled: session.loopProtectionEnabled,
			isLoopDetected: session.isLoopDetected
		}
	}

	// POST - Set loop protection
	let body: {
		enabled?: boolean
	}

	try {
		body = await request.json()
	} catch {
		return badRequest('Invalid JSON body')
	}

	const enabled = body.enabled ?? true

	if (typeof enabled !== 'boolean') {
		return badRequest('enabled must be a boolean')
	}

	session.loopProtectionEnabled = enabled

	return {
		success: true,
		enabled
	}
}
