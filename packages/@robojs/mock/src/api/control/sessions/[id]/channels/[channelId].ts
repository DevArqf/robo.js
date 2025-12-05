import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../../../core/manager.js'
import { validateMethod, notFound } from '../../../utils.js'
import { serializeMockMessage } from '../../../../../session/state.js'

/**
 * GET /api/control/sessions/:id/channels/:channelId - Get channel details
 *
 * Query Parameters:
 * - include_messages: Include recent messages (default: false)
 * - message_limit: Max messages to include (default: 50, max: 100)
 *
 * Response:
 * {
 *   id: string,
 *   guild_id?: string,
 *   name: string,
 *   type: number,
 *   parent_id?: string,
 *   message_count: number,
 *   messages?: SerializedMockMessage[]
 * }
 */
export default async (request: RoboRequest) => {
	validateMethod(request, ['GET'])

	const { id, channelId } = request.params as { id: string; channelId: string }
	const url = new URL(request.url, 'http://localhost')
	const includeMessages = url.searchParams.get('include_messages') === 'true'
	const messageLimit = Math.min(parseInt(url.searchParams.get('message_limit') ?? '50', 10), 100)

	if (!id) {
		return notFound('Session ID required')
	}

	if (!channelId) {
		return notFound('Channel ID required')
	}

	const session = sessionManager.get(id)

	if (!session) {
		return notFound('Session not found')
	}

	const channel = session.state.getChannel(channelId)

	if (!channel) {
		return notFound('Channel not found')
	}

	// Count messages in this channel
	const channelMessages = session.state.getMessagesForChannel(channelId)
	const messageCount = channelMessages.length

	// Build response
	const result: Record<string, unknown> = {
		id: channel.id,
		guild_id: channel.guildId,
		name: channel.name,
		type: channel.type,
		parent_id: channel.parentId,
		message_count: messageCount
	}

	// Include messages if requested
	if (includeMessages) {
		const messages = channelMessages.slice(0, messageLimit)
		result.messages = messages.map(serializeMockMessage)
	}

	return result
}
