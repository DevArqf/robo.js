import type { RoboRequest } from '@robojs/server'
import { loadRecording, deleteRecording } from '../../../../session/recording-storage.js'
import { validateMethod, notFound } from '../../utils.js'

/**
 * GET /api/control/tests/recordings/:sessionId - Get a specific recording
 * DELETE /api/control/tests/recordings/:sessionId - Delete a specific recording
 *
 * Response (GET):
 * SessionRecording
 *
 * Response (DELETE):
 * { deleted: boolean }
 */
export default async (request: RoboRequest) => {
	validateMethod(request, ['GET', 'DELETE'])

	const sessionId = request.params.sessionId
	if (!sessionId) {
		return notFound('Session ID required')
	}

	if (request.method === 'DELETE') {
		const deleted = deleteRecording(sessionId)
		return { deleted }
	}

	// GET request
	const recording = loadRecording(sessionId)
	if (!recording) {
		return notFound(`Recording not found for session: ${sessionId}`)
	}

	return recording
}
