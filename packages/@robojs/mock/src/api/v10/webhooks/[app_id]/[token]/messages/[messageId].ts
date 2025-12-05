import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../../../../core/manager.js'
import { mockMessageToAPIMessage } from '../../../../../../discord/payloads.js'
import { getGatewayServer } from '../../../../../../core/gateway.js'
import type { MockInteraction, MockMessage } from '../../../../../../types/index.js'
import type { Session } from '../../../../../../session/session.js'

/**
 * GET/PATCH/DELETE /api/v10/webhooks/:app_id/:token/messages/:messageId
 *
 * GET - Get a followup message
 * PATCH - Edit a followup message
 * DELETE - Delete a followup message
 *
 * Request body (PATCH):
 * {
 *   content?: string,      // New message content
 *   embeds?: object[],     // New embed objects
 *   components?: object[]  // New message components
 * }
 *
 * Response (GET/PATCH): APIMessage object
 * Response (DELETE): 204 No Content
 */
export default async (request: RoboRequest) => {
	// 1. Validate method
	if (request.method !== 'GET' && request.method !== 'PATCH' && request.method !== 'DELETE') {
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// 2. Extract params from URL
	const { app_id: appId, token, messageId } = request.params as { app_id: string; token: string; messageId: string }

	// 3. Find session containing this interaction (lookup by token)
	const session = sessionManager.findSessionByInteractionToken(token)
	if (!session) {
		return new Response(
			JSON.stringify({
				error: 'Unknown Webhook',
				code: 10015
			}),
			{
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			}
		)
	}

	// 4. Get the interaction from state
	const interaction = session.state.getInteractionByToken(token)
	if (!interaction) {
		return new Response(
			JSON.stringify({
				error: 'Unknown Webhook',
				code: 10015
			}),
			{
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			}
		)
	}

	// 5. Validate app_id matches interaction's applicationId
	if (interaction.applicationId !== appId) {
		return new Response(
			JSON.stringify({
				error: 'Unknown Webhook',
				code: 10015
			}),
			{
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			}
		)
	}

	// 6. Check expiration (interactions expire after 15 minutes)
	if (Date.now() > interaction.expiresAt) {
		return new Response(
			JSON.stringify({
				error: 'Unknown Webhook',
				code: 10015
			}),
			{
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			}
		)
	}

	// 7. Validate messageId is a followup message for this interaction
	const isFollowup = interaction.followupMessageIds?.includes(messageId) ?? false
	if (!isFollowup) {
		return new Response(
			JSON.stringify({
				error: 'Unknown Message',
				code: 10008
			}),
			{
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			}
		)
	}

	// 8. Get the message
	const message = session.state.getMessage(messageId)
	if (!message) {
		return new Response(
			JSON.stringify({
				error: 'Unknown Message',
				code: 10008
			}),
			{
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			}
		)
	}

	// 9. Handle based on method
	if (request.method === 'GET') {
		return handleGet(session, message)
	} else if (request.method === 'PATCH') {
		return handlePatch(request, session, interaction, message, appId, token, messageId)
	} else {
		return handleDelete(session, interaction, message, appId, token, messageId)
	}
}

function handleGet(session: Session, message: MockMessage) {
	const author = session.state.getUser(message.authorId) || session.state.botUser
	return mockMessageToAPIMessage(message, author)
}

async function handlePatch(
	request: RoboRequest,
	session: Session,
	interaction: MockInteraction,
	message: MockMessage,
	appId: string,
	token: string,
	messageId: string
) {
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
	const updatedMessage = session.state.updateMessage(message.id, {
		content: body.content ?? message.content,
		embeds: body.embeds ?? message.embeds
	})

	if (!updatedMessage) {
		return new Response(JSON.stringify({ error: 'Failed to update message' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// Get channel for guild ID
	const channel = session.state.getChannel(message.channelId)

	// Record action
	session.recorder.record(
		'interaction_edit',
		{
			interaction_id: interaction.id,
			message_id: messageId,
			channel_id: message.channelId,
			guild_id: message.guildId,
			content: updatedMessage.content,
			embeds: updatedMessage.embeds,
			edited_timestamp: updatedMessage.editedTimestamp,
			is_original: false,
			command_name: interaction.commandName
		},
		{
			endpoint: `PATCH /webhooks/${appId}/${token}/messages/${messageId}`,
			method: 'PATCH',
			interactionId: interaction.id
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

	getGatewayServer().dispatchToSession(session.id, 'MESSAGE_UPDATE', dispatchData, channel?.guildId)

	// Return updated message
	return mockMessageToAPIMessage(updatedMessage, author)
}

function handleDelete(
	session: Session,
	interaction: MockInteraction,
	message: MockMessage,
	appId: string,
	token: string,
	messageId: string
) {
	// Get channel before deleting for dispatch
	const channel = session.state.getChannel(message.channelId)

	// Delete message from state
	const deleted = session.state.deleteMessage(message.id)
	if (!deleted) {
		return new Response(JSON.stringify({ error: 'Failed to delete message' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// Remove from followupMessageIds on interaction
	if (interaction.followupMessageIds) {
		const index = interaction.followupMessageIds.indexOf(messageId)
		if (index !== -1) {
			interaction.followupMessageIds.splice(index, 1)
		}
	}

	// Record action
	session.recorder.record(
		'interaction_edit',
		{
			interaction_id: interaction.id,
			message_id: messageId,
			channel_id: message.channelId,
			guild_id: message.guildId,
			deleted: true,
			is_original: false,
			command_name: interaction.commandName
		},
		{
			endpoint: `DELETE /webhooks/${appId}/${token}/messages/${messageId}`,
			method: 'DELETE',
			interactionId: interaction.id
		}
	)

	// Dispatch MESSAGE_DELETE event via Gateway
	const dispatchData: { id: string; channel_id: string; guild_id?: string } = {
		id: messageId,
		channel_id: message.channelId
	}

	if (message.guildId) {
		dispatchData.guild_id = message.guildId
	}

	getGatewayServer().dispatchToSession(session.id, 'MESSAGE_DELETE', dispatchData, channel?.guildId)

	// Return 204 No Content (Discord API behavior)
	return new Response(null, { status: 204 })
}
