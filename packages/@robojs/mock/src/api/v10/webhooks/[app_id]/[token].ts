import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../../core/manager.js'
import { mockMessageToAPIMessage } from '../../../../discord/payloads.js'

/**
 * POST /api/v10/webhooks/:app_id/:token - Send followup message for interaction
 *
 * This endpoint allows bots to send followup messages after the initial interaction response.
 * Discord.js uses this when calling interaction.followUp()
 *
 * Request body:
 * {
 *   content?: string,      // Message content
 *   embeds?: object[],     // Embed objects
 *   components?: object[], // Message components
 *   tts?: boolean,         // Text-to-speech
 *   flags?: number         // 64 = ephemeral
 * }
 *
 * Response: APIMessage object
 */
export default async (request: RoboRequest) => {
	// 1. Validate POST method
	if (request.method !== 'POST') {
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// 2. Extract app_id and token from URL params
	const { app_id: appId, token } = request.params as { app_id: string; token: string }

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

	// 7. Validate interaction has been responded to (deferred or replied)
	if (!interaction.response) {
		return new Response(
			JSON.stringify({
				error: 'Interaction has not been acknowledged',
				code: 40060
			}),
			{
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			}
		)
	}

	// 8. Parse message payload from body
	let body: {
		content?: string
		embeds?: unknown[]
		components?: unknown[]
		tts?: boolean
		flags?: number
	}

	try {
		body = await request.json()
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// 9. Create followup message in state
	const message = session.state.createMessage({
		channelId: interaction.channelId,
		guildId: interaction.guildId,
		authorId: session.state.botUser.id,
		content: body.content ?? '',
		embeds: body.embeds ?? [],
		tts: body.tts ?? false
	})

	// 10. Track followup message ID on interaction
	if (!interaction.followupMessageIds) {
		interaction.followupMessageIds = []
	}
	interaction.followupMessageIds.push(message.id)

	// 11. Record as 'interaction_followup' action
	session.recorder.record(
		'interaction_followup',
		{
			interaction_id: interaction.id,
			message_id: message.id,
			channel_id: interaction.channelId,
			guild_id: interaction.guildId,
			content: message.content,
			embeds: message.embeds,
			command_name: interaction.commandName
		},
		{
			endpoint: `POST /webhooks/${appId}/${token}`,
			method: 'POST',
			interactionId: interaction.id
		}
	)

	// 12. Return APIMessage response
	return mockMessageToAPIMessage(message, session.state.botUser)
}
