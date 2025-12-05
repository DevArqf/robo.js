import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../../core/manager.js'
import { parseMockToken } from '../../../../utils/id.js'
import { mockThreadToAPIChannel } from '../../../../discord/payloads.js'

/**
 * POST /api/v10/channels/:id/threads - Create a thread in a channel
 *
 * Request body:
 * {
 *   name: string,                          // Thread name (1-100 chars)
 *   auto_archive_duration?: 60|1440|4320|10080,  // Minutes until auto-archive
 *   type?: 10|11|12,                       // Thread type (default 11 for public)
 *   invitable?: boolean,                   // For private threads only
 *   rate_limit_per_user?: number           // Slowmode in seconds
 * }
 *
 * Response: APIChannel (thread) object
 */
export default async (request: RoboRequest) => {
	// 1. Validate POST method
	if (request.method !== 'POST') {
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

	// 3. Extract channel ID from params
	const { id: channelId } = request.params as { id: string }

	// 4. Validate parent channel exists
	const channel = session.state.getChannel(channelId)
	if (!channel) {
		return new Response(JSON.stringify({ error: 'Unknown Channel', code: 10003 }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// 5. Validate channel type (must be text or announcement)
	if (channel.type !== 0 && channel.type !== 5) {
		return new Response(
			JSON.stringify({
				error: 'Cannot create thread in this channel type',
				code: 50024
			}),
			{
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			}
		)
	}

	// 6. Parse thread creation payload
	let body: {
		name: string
		auto_archive_duration?: 60 | 1440 | 4320 | 10080
		type?: 10 | 11 | 12
		invitable?: boolean
		rate_limit_per_user?: number
	}

	try {
		body = await request.json()
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// 7. Validate required fields
	if (!body.name || typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 100) {
		return new Response(
			JSON.stringify({
				error: 'Thread name must be between 1 and 100 characters',
				code: 50035
			}),
			{
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			}
		)
	}

	// 8. Determine thread type (default to public thread, or announcement thread if parent is announcement)
	const threadType = body.type ?? (channel.type === 5 ? 10 : 11)

	// 9. Create thread in state
	const thread = session.state.createThread({
		name: body.name,
		type: threadType,
		parentId: channelId,
		ownerId: session.state.botUser.id,
		autoArchiveDuration: body.auto_archive_duration,
		invitable: body.invitable,
		rateLimitPerUser: body.rate_limit_per_user
	})

	// 10. Record as 'thread_created' action
	session.recordAction(
		'thread_created',
		{
			thread_id: thread.id,
			parent_id: channelId,
			name: thread.name,
			type: thread.type
		},
		{
			endpoint: `POST /channels/${channelId}/threads`,
			method: 'POST'
		}
	)

	// 11. Return thread as APIChannel
	return mockThreadToAPIChannel(thread)
}
