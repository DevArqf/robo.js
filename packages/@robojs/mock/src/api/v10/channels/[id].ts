import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../core/manager.js'
import { parseMockToken } from '../../../utils/id.js'
import { mockThreadToAPIChannel, mockChannelToAPIChannel } from '../../../discord/payloads.js'
import { enforcePermissions } from '../../../utils/permission-check.js'

/**
 * Channel endpoint - handles GET, PATCH and DELETE for channels (including threads)
 *
 * GET    /api/v10/channels/:id    - Fetch a channel
 * PATCH  /api/v10/channels/:id    - Modify a channel/thread
 * DELETE /api/v10/channels/:id    - Delete a channel/thread
 *
 * For threads (types 10, 11, 12), this endpoint supports:
 * - PATCH: name, archived, auto_archive_duration, locked, invitable, rate_limit_per_user
 * - DELETE: Remove the thread entirely
 */
export default async (request: RoboRequest) => {
	// 1. Validate method
	if (request.method !== 'GET' && request.method !== 'PATCH' && request.method !== 'DELETE') {
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

	// 4. Validate channel exists
	const channel = session.state.getChannel(channelId)
	if (!channel) {
		return new Response(JSON.stringify({ error: 'Unknown Channel', code: 10003 }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// 4b. Check permissions (Phase 4L-Extended)
	const permError = enforcePermissions(
		session,
		request.method,
		`/channels/${channelId}`,
		channelId
	)
	if (permError) return permError

	// Check if this is a thread
	const isThread = channel.type === 10 || channel.type === 11 || channel.type === 12

	// GET - return channel representation
	if (request.method === 'GET') {
		if (isThread) {
			const botMember = session.state.getThreadMember(channelId, session.state.botUser.id)
			return mockThreadToAPIChannel(channel as any, botMember ?? undefined)
		}
		return mockChannelToAPIChannel(channel)
	}

	if (request.method === 'DELETE') {
		// 5a. DELETE - Remove channel/thread
		if (isThread) {
			const deleted = session.state.deleteThread(channelId)
			if (!deleted) {
				return new Response(JSON.stringify({ error: 'Failed to delete thread', code: 50001 }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				})
			}

			// Record action
			session.recordAction(
				'thread_deleted',
				{
					thread_id: channelId,
					parent_id: channel.parentId,
					type: channel.type
				},
				{
					endpoint: `DELETE /channels/${channelId}`,
					method: 'DELETE'
				}
			)
		} else {
			// Regular channel deletion
			const deleted = session.state.removeChannel(channelId)
			if (!deleted) {
				return new Response(JSON.stringify({ error: 'Failed to delete channel', code: 50001 }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				})
			}

			// Record action
			session.recordAction(
				'channel_deleted',
				{
					channel_id: channelId,
					guild_id: channel.guildId,
					type: channel.type
				},
				{
					endpoint: `DELETE /channels/${channelId}`,
					method: 'DELETE'
				}
			)
		}

		// Return the deleted channel object (no member field on delete since thread is gone)
		if (isThread) {
			return mockThreadToAPIChannel(channel as any)
		}
		return mockChannelToAPIChannel(channel)
	}

	// 5b. PATCH - Modify channel/thread
	let body: {
		name?: string
		archived?: boolean
		auto_archive_duration?: 60 | 1440 | 4320 | 10080
		locked?: boolean
		invitable?: boolean
		rate_limit_per_user?: number
		// Regular channel fields
		topic?: string
		nsfw?: boolean
		position?: number
		parent_id?: string | null
	}

	try {
		body = await request.json()
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	if (isThread) {
		// Update thread
		const thread = session.state.updateThread(channelId, {
			name: body.name,
			archived: body.archived,
			auto_archive_duration: body.auto_archive_duration,
			locked: body.locked,
			invitable: body.invitable,
			rateLimitPerUser: body.rate_limit_per_user
		})

		if (!thread) {
			return new Response(JSON.stringify({ error: 'Failed to update thread', code: 50001 }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			})
		}

		// Record action
		session.recordAction(
			'thread_updated',
			{
				thread_id: channelId,
				updates: body
			},
			{
				endpoint: `PATCH /channels/${channelId}`,
				method: 'PATCH'
			}
		)

		// Include member field if bot is a member of the thread
		const botMember = session.state.getThreadMember(channelId, session.state.botUser.id)
		return mockThreadToAPIChannel(thread, botMember ?? undefined)
	} else {
		// Update regular channel (basic implementation)
		if (body.name !== undefined) {
			channel.name = body.name
		}

		// Record action
		session.recordAction(
			'channel_updated',
			{
				channel_id: channelId,
				updates: body
			},
			{
				endpoint: `PATCH /channels/${channelId}`,
				method: 'PATCH'
			}
		)

		return mockChannelToAPIChannel(channel)
	}
}
