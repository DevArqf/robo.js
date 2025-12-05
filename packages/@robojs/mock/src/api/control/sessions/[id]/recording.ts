import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../../core/manager.js'
import { validateMethod, notFound } from '../../utils.js'

/**
 * GET /api/control/sessions/:id/recording - Export session recording
 *
 * Response: SessionRecording JSON containing:
 * {
 *   version: 1,
 *   metadata: {
 *     sessionId: string,
 *     sessionName?: string,
 *     startTime: number,
 *     endTime: number,
 *     duration: number,
 *     actionCount: number,
 *     botUser: { id: string, username: string },
 *     applicationId: string,
 *     recordedAt: string (ISO 8601)
 *   },
 *   initialConfig: SessionConfig,
 *   actions: RecordedAction[]
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

	return session.exportRecording()
}
