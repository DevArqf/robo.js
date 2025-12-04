import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../core/manager.js'
import { validateMethod, notFound } from '../utils.js'

/**
 * GET /api/control/sessions/:id - Get session info
 * DELETE /api/control/sessions/:id - Delete session
 *
 * GET Response:
 * {
 *   session_id: string,
 *   token: string,
 *   name?: string,
 *   created_at: number,
 *   expires_at: number
 * }
 *
 * DELETE Response:
 * {
 *   success: true
 * }
 */
export default async (request: RoboRequest) => {
	validateMethod(request, ['GET', 'DELETE'])

	const { id } = request.params as { id: string }

	if (!id) {
		return notFound('Session ID required')
	}

	const session = sessionManager.get(id)

	if (!session) {
		return notFound('Session not found')
	}

	if (request.method === 'DELETE') {
		await sessionManager.delete(id)
		return { success: true }
	}

	// GET - return session info
	return {
		session_id: session.id,
		token: session.token,
		name: session.name,
		created_at: session.createdAt,
		expires_at: session.expiresAt
	}
}
