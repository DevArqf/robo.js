import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../../core/manager.js'
import { getStageServer } from '../../../../core/stage.js'
import { validateMethod, notFound, badRequest } from '../../utils.js'
import type { StageEventType } from '../../../../types/stage.js'

/**
 * Stage WebSocket Control API
 *
 * GET /api/control/sessions/:id/stage - Get stage connection info
 * POST /api/control/sessions/:id/stage - Broadcast custom event to stage clients
 *
 * GET Response:
 * {
 *   session_id: string,
 *   stage_connections: number,
 *   buffer_stats: {
 *     size: number,
 *     oldest_seq: number | null,
 *     newest_seq: number | null
 *   }
 * }
 *
 * POST Body:
 * {
 *   type: StageEventType,  // Event type to broadcast
 *   data: unknown          // Event data payload
 * }
 *
 * POST Response:
 * {
 *   success: true,
 *   broadcast_count: number
 * }
 */
export default async (request: RoboRequest) => {
	validateMethod(request, ['GET', 'POST'])

	const { id } = request.params as { id: string }

	if (!id) {
		return notFound('Session ID required')
	}

	const session = sessionManager.get(id)

	if (!session) {
		return notFound('Session not found')
	}

	const stageServer = getStageServer()

	if (request.method === 'GET') {
		// Return stage connection info
		const connectionCount = stageServer.getSessionConnectionCount(session.id)
		const bufferStats = stageServer.getBufferStats(session.id)

		return {
			session_id: session.id,
			stage_connections: connectionCount,
			buffer_stats: {
				size: bufferStats.size,
				oldest_seq: bufferStats.oldestSeq,
				newest_seq: bufferStats.newestSeq
			}
		}
	}

	// POST - Broadcast custom event
	const body = await request.json() as { type?: StageEventType; data?: unknown }

	if (!body.type) {
		return badRequest('Event type is required')
	}

	// Validate event type
	const validEventTypes: StageEventType[] = [
		'connected', 'state_sync', 'command_response',
		'message_create', 'message_update', 'message_delete',
		'interaction_create', 'interaction_response', 'interaction_followup',
		'typing_start', 'presence_update',
		'bot_ready', 'bot_disconnected', 'bot_error',
		'heartbeat', 'error'
	]

	if (!validEventTypes.includes(body.type)) {
		return badRequest(`Invalid event type: ${body.type}`)
	}

	// Broadcast to all stage clients for this session
	stageServer.broadcastToSession(session.id, {
		type: body.type,
		data: body.data
	})

	const connectionCount = stageServer.getSessionConnectionCount(session.id)

	return {
		success: true,
		broadcast_count: connectionCount
	}
}
