import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../../../core/manager.js'
import type { InteractionResponseData } from '../../../../../types/index.js'

/**
 * POST /api/v10/interactions/:id/:token/callback - Respond to an interaction
 *
 * This endpoint captures interaction responses from bots.
 * Discord uses this endpoint when a bot calls interaction.reply(), interaction.deferReply(), etc.
 *
 * Request body:
 * {
 *   type: number,     // InteractionResponseType (4=reply, 5=defer, 6=defer update, 7=update, 8=autocomplete, 9=modal)
 *   data?: {          // Response data (varies by type)
 *     content?: string,
 *     embeds?: object[],
 *     components?: object[],
 *     flags?: number,    // 64 = ephemeral
 *     tts?: boolean,
 *     allowed_mentions?: object
 *   }
 * }
 *
 * Response: 204 No Content on success
 */
export default async (request: RoboRequest) => {
	// 1. Validate POST method
	if (request.method !== 'POST') {
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// 2. Extract interaction ID and token from URL params
	const { id: interactionId, token } = request.params as { id: string; token: string }

	// 3. Find session containing this interaction (lookup by token, not session token)
	const session = sessionManager.findSessionByInteractionToken(token)
	if (!session) {
		return new Response(
			JSON.stringify({
				error: 'Unknown Interaction',
				code: 10062
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
				error: 'Unknown Interaction',
				code: 10062
			}),
			{
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			}
		)
	}

	// 5. Validate interaction ID matches (Discord includes this for verification)
	if (interaction.id !== interactionId) {
		return new Response(
			JSON.stringify({
				error: 'Unknown Interaction',
				code: 10062
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
				error: 'Interaction token expired',
				code: 10062
			}),
			{
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			}
		)
	}

	// 7. Check if already responded (can only respond once to initial callback)
	if (interaction.response) {
		return new Response(
			JSON.stringify({
				error: 'Interaction has already been acknowledged',
				code: 40060
			}),
			{
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			}
		)
	}

	// 8. Parse response body
	let body: { type: number; data?: unknown }
	try {
		body = await request.json()
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// 9. Validate response type is present
	if (typeof body.type !== 'number') {
		return new Response(JSON.stringify({ error: 'Invalid response type', code: 50035 }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// 9b. Validate autocomplete response format (type 8) - Phase 3F
	if (body.type === 8) {
		// Validate interaction was an autocomplete request (type 4)
		if (interaction.type !== 4) {
			return new Response(
				JSON.stringify({
					error: 'Autocomplete response (type 8) only valid for autocomplete interactions',
					code: 50035
				}),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			)
		}

		// Validate choices array exists
		const data = body.data as { choices?: unknown[] } | undefined
		if (!data?.choices || !Array.isArray(data.choices)) {
			return new Response(
				JSON.stringify({
					error: 'Autocomplete response requires "choices" array in data',
					code: 50035
				}),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			)
		}

		// Validate choices limit (max 25)
		if (data.choices.length > 25) {
			return new Response(
				JSON.stringify({
					error: 'Autocomplete choices limited to 25 items',
					code: 50035
				}),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			)
		}
	}

	// 10. Store response on interaction
	const now = Date.now()
	const responseData = body.data as InteractionResponseData | undefined
	interaction.response = {
		type: body.type,
		timestamp: now,
		data: responseData
	}
	interaction.respondedAt = now

	// 10b. Create message for type 4 (ChannelMessageWithSource) or type 7 (UpdateMessage) - Phase 3H
	if (body.type === 4 && responseData) {
		// Type 4: Create a new message as the response
		// Phase 3I: Get the user who triggered the interaction for interaction_metadata
		const interactionUser = session.state.getUser(interaction.userId)

		const message = session.state.createMessage({
			channelId: interaction.channelId,
			guildId: interaction.guildId,
			authorId: session.state.botUser.id,
			content: responseData.content ?? '',
			embeds: responseData.embeds,
			tts: responseData.tts ?? false,
			// Phase 3I: Add interaction metadata to the response message
			interactionMetadata: interactionUser
				? {
						id: interaction.id,
						type: interaction.type,
						user: interactionUser,
						authorizing_integration_owners: {},
						// Add target info for context menu commands (Phase 3G)
						...(interaction.targetId &&
							interaction.contextMenuType === 2 && {
								target_user: session.state.getUser(interaction.targetId)
							}),
						...(interaction.targetId &&
							interaction.contextMenuType === 3 && {
								target_message_id: interaction.targetId
							})
					}
				: undefined
		})
		interaction.responseMessageId = message.id
	} else if (body.type === 7 && responseData && interaction.messageId) {
		// Type 7: Update the original component message
		session.state.updateMessage(interaction.messageId, {
			content: responseData.content ?? '',
			embeds: responseData.embeds as unknown[]
		})
		interaction.responseMessageId = interaction.messageId
	}

	// 11. Record as 'interaction_response' action
	session.recorder.record(
		'interaction_response',
		{
			interaction_id: interaction.id,
			response_type: body.type,
			response_data: body.data,
			command_name: interaction.commandName,
			response_time_ms: now - interaction.createdAt
		},
		{
			endpoint: `POST /interactions/${interactionId}/${token}/callback`,
			method: 'POST',
			interactionId: interaction.id,
			responseType: body.type
		}
	)

	// 12. Discord returns 204 No Content on success
	return new Response(null, { status: 204 })
}
