import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../../core/manager.js'
import { validateMethod, notFound } from '../../utils.js'
import { serializeSessionState } from '../../../../session/state.js'

/**
 * GET /api/control/sessions/:id/state - Get full session state
 *
 * Response:
 * {
 *   guilds: [...],
 *   channels: [...],
 *   users: [...],
 *   botUser: {...},
 *   applicationId: string,
 *   sequence: number
 * }
 */
export default async (request: RoboRequest) => {
	validateMethod(request, ['GET'])

	const { id } = request.params as { id: string }

	if (!id) {
		return notFound('Session ID required')
	}

	const session = sessionManager.get(id)

	if (!session) {
		return notFound('Session not found')
	}

	return serializeSessionState(session.state)
}
