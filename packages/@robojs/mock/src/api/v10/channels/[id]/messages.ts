import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../../core/manager.js'
import { parseMockToken } from '../../../../utils/id.js'
import { mockMessageToAPIMessage } from '../../../../discord/payloads.js'

/**
 * POST /api/v10/channels/:id/messages - Create a message in a channel
 *
 * This endpoint captures messages sent by the bot via REST API.
 * It creates the message in session state, records it as an action,
 * and returns the created message in Discord's APIMessage format.
 *
 * Request body:
 * {
 *   content?: string,      // Message content
 *   embeds?: object[],     // Embed objects
 *   components?: object[], // Message components
 *   tts?: boolean,         // Text-to-speech
 *   message_reference?: {  // Reply reference
 *     message_id: string
 *   }
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

	// 4. Validate channel exists in session state
	const channel = session.state.getChannel(channelId)
	if (!channel) {
		return new Response(JSON.stringify({ error: 'Unknown Channel', code: 10003 }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// 5. Parse message payload from body
	let body: {
		content?: string
		embeds?: unknown[]
		components?: unknown[]
		tts?: boolean
		message_reference?: { message_id: string }
	}

	try {
		body = await request.json()
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// 6. Create message in state (author is bot user)
	const message = session.state.createMessage({
		channelId,
		guildId: channel.guildId,
		authorId: session.state.botUser.id,
		content: body.content ?? '',
		embeds: body.embeds ?? [],
		attachments: [],
		tts: body.tts ?? false
	})

	// 7. Record as 'message_sent' action
	session.recorder.record(
		'message_sent',
		{
			message_id: message.id,
			channel_id: channelId,
			guild_id: channel.guildId,
			content: message.content,
			embeds: message.embeds
		},
		{
			endpoint: `POST /channels/${channelId}/messages`,
			method: 'POST'
		}
	)

	// 8. Return APIMessage response
	return mockMessageToAPIMessage(message, session.state.botUser)
}
