import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../../../core/manager.js'
import { parseMockToken } from '../../../../../utils/id.js'
import { mockMessageToAPIMessage } from '../../../../../discord/payloads.js'
import { getGatewayServer } from '../../../../../core/gateway.js'
import type { MockChannel, MockMessage } from '../../../../../types/index.js'
import type { Session } from '../../../../../session/session.js'

/**
 * PATCH/DELETE /api/v10/channels/:id/messages/:messageId
 *
 * PATCH - Edit a message (bot can only edit its own messages)
 * DELETE - Delete a message
 *
 * Request body (PATCH):
 * {
 *   content?: string,      // New message content
 *   embeds?: object[],     // New embed objects
 *   components?: object[]  // New message components
 * }
 *
 * Response (PATCH): APIMessage object
 * Response (DELETE): 204 No Content
 */
export default async (request: RoboRequest) => {
	// 1. Validate method
	if (request.method !== 'PATCH' && request.method !== 'DELETE') {
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

	// 3. Extract IDs from params
	const { id: channelId, messageId } = request.params as { id: string; messageId: string }

	// 4. Validate channel exists
	const channel = session.state.getChannel(channelId)
	if (!channel) {
		return new Response(JSON.stringify({ error: 'Unknown Channel', code: 10003 }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// 5. Validate message exists
	const message = session.state.getMessage(messageId)
	if (!message) {
		return new Response(JSON.stringify({ error: 'Unknown Message', code: 10008 }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// 6. Verify message is in the specified channel
	if (message.channelId !== channelId) {
		return new Response(JSON.stringify({ error: 'Unknown Message', code: 10008 }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// 7. Handle based on method
	if (request.method === 'PATCH') {
		return handlePatch(request, session, channel, message, channelId, messageId)
	} else {
		return handleDelete(session, channel, channelId, messageId)
	}
}

async function handlePatch(
	request: RoboRequest,
	session: Session,
	channel: MockChannel,
	message: MockMessage,
	channelId: string,
	messageId: string
) {
	// Verify message belongs to bot (Discord only allows editing your own messages)
	if (message.authorId !== session.state.botUser.id) {
		return new Response(JSON.stringify({ error: 'Cannot edit a message authored by another user', code: 50005 }), {
			status: 403,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// Parse body
	let body: { content?: string; embeds?: unknown[]; components?: unknown[] }
	try {
		body = await request.json()
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// Update message in state
	const updatedMessage = session.state.updateMessage(messageId, {
		content: body.content ?? message.content,
		embeds: body.embeds ?? message.embeds
	})

	if (!updatedMessage) {
		return new Response(JSON.stringify({ error: 'Failed to update message' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// Record action
	session.recorder.record(
		'message_edited',
		{
			message_id: messageId,
			channel_id: channelId,
			guild_id: channel.guildId,
			content: updatedMessage.content,
			embeds: updatedMessage.embeds,
			edited_timestamp: updatedMessage.editedTimestamp
		},
		{
			endpoint: `PATCH /channels/${channelId}/messages/${messageId}`,
			method: 'PATCH'
		}
	)

	// Dispatch MESSAGE_UPDATE event via Gateway
	const author = session.state.getUser(message.authorId) || session.state.botUser
	const apiMessage = mockMessageToAPIMessage(updatedMessage, author)

	// Build dispatch data with guild-specific fields
	const dispatchData: Record<string, unknown> = { ...apiMessage }
	if (updatedMessage.guildId) {
		dispatchData.guild_id = updatedMessage.guildId
	}

	getGatewayServer().dispatchToSession(session.id, 'MESSAGE_UPDATE', dispatchData, channel.guildId)

	// Return updated message
	return mockMessageToAPIMessage(updatedMessage, author)
}

function handleDelete(session: Session, channel: MockChannel, channelId: string, messageId: string) {
	// Delete message from state
	const deleted = session.state.deleteMessage(messageId)
	if (!deleted) {
		return new Response(JSON.stringify({ error: 'Failed to delete message' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// Record action
	session.recorder.record(
		'message_deleted',
		{
			message_id: messageId,
			channel_id: channelId,
			guild_id: channel.guildId
		},
		{
			endpoint: `DELETE /channels/${channelId}/messages/${messageId}`,
			method: 'DELETE'
		}
	)

	// Dispatch MESSAGE_DELETE event via Gateway
	const dispatchData: { id: string; channel_id: string; guild_id?: string } = {
		id: messageId,
		channel_id: channelId
	}

	if (channel.guildId) {
		dispatchData.guild_id = channel.guildId
	}

	getGatewayServer().dispatchToSession(session.id, 'MESSAGE_DELETE', dispatchData, channel.guildId)

	// Return 204 No Content (Discord API behavior)
	return new Response(null, { status: 204 })
}
