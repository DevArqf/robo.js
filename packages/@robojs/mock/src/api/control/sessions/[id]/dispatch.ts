import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../../core/manager.js'
import { validateMethod, notFound, badRequest } from '../../utils.js'

/**
 * POST /api/control/sessions/:id/dispatch - Dispatch an event to session connections
 *
 * Request body:
 * {
 *   event: string          // Event name (e.g., "MESSAGE_CREATE")
 *   data: {                // Event-specific data
 *     channel_id: string   // Required for MESSAGE_CREATE
 *     content?: string     // Message content
 *     author?: {           // Optional author info
 *       id?: string
 *       username?: string
 *       bot?: boolean
 *     }
 *     embeds?: unknown[]
 *     attachments?: unknown[]
 *   }
 * }
 *
 * Response:
 * {
 *   success: true,
 *   dispatched: number,    // Number of connections event was sent to
 *   message_id?: string    // For MESSAGE_CREATE, the generated message ID
 * }
 */
export default async (request: RoboRequest) => {
	validateMethod(request, ['POST'])

	const { id } = request.params as { id: string }

	if (!id) {
		return notFound('Session ID required')
	}

	const session = sessionManager.get(id)

	if (!session) {
		return notFound('Session not found')
	}

	// Parse request body
	let body: {
		event: string
		data: Record<string, unknown>
	}

	try {
		body = await request.json()
	} catch {
		return badRequest('Invalid JSON body')
	}

	// Validate required fields
	if (!body.event || typeof body.event !== 'string') {
		return badRequest('Missing or invalid "event" field')
	}

	if (!body.data || typeof body.data !== 'object') {
		return badRequest('Missing or invalid "data" field')
	}

	// Handle MESSAGE_CREATE specially
	if (body.event === 'MESSAGE_CREATE') {
		const data = body.data as {
			channel_id?: string
			content?: string
			author?: {
				id?: string
				username?: string
				bot?: boolean
			}
			embeds?: unknown[]
			attachments?: unknown[]
		}

		if (!data.channel_id) {
			return badRequest('MESSAGE_CREATE requires "channel_id" in data')
		}

		try {
			const message = await session.dispatchMessage({
				channelId: data.channel_id,
				content: data.content,
				author: data.author,
				embeds: data.embeds,
				attachments: data.attachments
			})

			return {
				success: true,
				dispatched: session.connections.size,
				message_id: message.id
			}
		} catch (error) {
			return badRequest((error as Error).message)
		}
	}

	// For other events, dispatch raw data
	await session.dispatch(body.event, body.data)

	return {
		success: true,
		dispatched: session.connections.size
	}
}
