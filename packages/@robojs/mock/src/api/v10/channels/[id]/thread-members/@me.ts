import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../../../core/manager.js'
import { parseMockToken } from '../../../../../utils/id.js'

/**
 * PUT /api/v10/channels/:id/thread-members/@me - Join a thread
 * DELETE /api/v10/channels/:id/thread-members/@me - Leave a thread
 *
 * Response: 204 No Content on success
 */
export default async (request: RoboRequest) => {
	// 1. Validate method (PUT or DELETE)
	if (request.method !== 'PUT' && request.method !== 'DELETE') {
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// 2. Parse Authorization header → get session
	const authHeader = request.headers.get('Authorization') || ''
	const sessionId = parseMockToken(authHeader)

	if (!sessionId) {
		return new Response(JSON.stringify({ error: 'Unauthorized', code: 0 }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	const session = sessionManager.get(sessionId)
	if (!session) {
		return new Response(JSON.stringify({ error: 'Unauthorized', code: 0 }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// 3. Extract thread ID from params
	const { id: threadId } = request.params as { id: string }

	// 4. Validate thread exists
	const thread = session.state.getThread(threadId)
	if (!thread) {
		return new Response(JSON.stringify({ error: 'Unknown Channel', code: 10003 }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	const botUserId = session.state.botUser.id

	if (request.method === 'PUT') {
		// 5a. Join thread
		const member = session.state.addThreadMember(threadId, botUserId)

		// Record action
		session.recordAction(
			'thread_member_added',
			{
				thread_id: threadId,
				user_id: botUserId
			},
			{
				endpoint: `PUT /channels/${threadId}/thread-members/@me`,
				method: 'PUT'
			}
		)

		// Return 204 No Content
		return new Response(null, { status: 204 })
	} else {
		// 5b. Leave thread
		session.state.removeThreadMember(threadId, botUserId)

		// Record action
		session.recordAction(
			'thread_member_removed',
			{
				thread_id: threadId,
				user_id: botUserId
			},
			{
				endpoint: `DELETE /channels/${threadId}/thread-members/@me`,
				method: 'DELETE'
			}
		)

		// Return 204 No Content
		return new Response(null, { status: 204 })
	}
}
