import type { RoboRequest } from '@robojs/server'
import { ChannelType } from 'discord-api-types/v10'
import { sessionManager } from '../../../../core/manager.js'
import { parseMockToken } from '../../../../utils/id.js'

/**
 * GET /api/v10/guilds/:id/channels - Fetch guild channels
 *
 * Returns an array of channel objects for the guild.
 */
export default async (request: RoboRequest) => {
	// Only GET is supported
	if (request.method !== 'GET') {
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// Extract session from Authorization header
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

	const { id: guildId } = request.params as { id: string }
	const guild = session.state.guilds.get(guildId)

	if (!guild) {
		return new Response(JSON.stringify({ error: 'Unknown Guild', code: 10004 }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// Get all channels for this guild
	const channels = []
	for (const channelId of guild.channels) {
		const channel = session.state.channels.get(channelId)
		if (channel) {
			channels.push({
				id: channel.id,
				type: channel.type,
				guild_id: channel.guildId,
				name: channel.name,
				position: 0,
				permission_overwrites: channel.permissionOverwrites || [],
				nsfw: false,
				parent_id: channel.parentId || null,
				...(channel.type === ChannelType.GuildText && {
					topic: null,
					last_message_id: null,
					rate_limit_per_user: 0
				})
			})
		}
	}

	return channels
}
