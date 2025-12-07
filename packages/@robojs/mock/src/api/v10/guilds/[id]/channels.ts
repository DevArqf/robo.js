import type { RoboRequest } from '@robojs/server'
import { ChannelType } from 'discord-api-types/v10'
import { sessionManager } from '../../../../core/manager.js'
import { parseMockToken } from '../../../../utils/id.js'
import { createMockChannel } from '../../../../session/state.js'
import { mockChannelToAPIChannel } from '../../../../discord/payloads.js'
import { getGatewayServer } from '../../../../core/gateway.js'
import { enforcePermissions } from '../../../../utils/permission-check.js'

/**
 * GET /api/v10/guilds/:id/channels - Fetch guild channels
 * POST /api/v10/guilds/:id/channels - Create a channel in the guild
 *
 * Returns an array of channel objects for the guild (GET)
 * or a single channel object (POST).
 */
export default async (request: RoboRequest) => {
	// Validate method
	if (request.method !== 'GET' && request.method !== 'POST') {
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

	// POST - Create a new channel
	if (request.method === 'POST') {
		// Check permissions
		const permError = enforcePermissions(session, 'POST', `/guilds/${guildId}/channels`, undefined, guildId)
		if (permError) return permError

		let body: {
			name: string
			type?: number
			topic?: string
			bitrate?: number
			user_limit?: number
			rate_limit_per_user?: number
			position?: number
			permission_overwrites?: Array<{ id: string; type: number; allow?: string; deny?: string }>
			parent_id?: string | null
			nsfw?: boolean
		}

		try {
			body = await request.json()
		} catch {
			return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			})
		}

		// Validate name
		if (!body.name || typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 100) {
			return new Response(
				JSON.stringify({ error: 'Channel name must be between 1 and 100 characters', code: 50035 }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			)
		}

		// Create channel
		const channelType = body.type ?? ChannelType.GuildText
		const channel = createMockChannel({
			guildId,
			name: body.name,
			type: channelType,
			parentId: body.parent_id ?? null
		})

		// Set additional properties
		if (body.topic !== undefined && channelType === ChannelType.GuildText) {
			channel.topic = body.topic
		}
		if (body.bitrate !== undefined && channelType === ChannelType.GuildVoice) {
			channel.bitrate = body.bitrate
		}
		if (body.user_limit !== undefined && channelType === ChannelType.GuildVoice) {
			channel.userLimit = body.user_limit
		}
		if (body.rate_limit_per_user !== undefined) {
			channel.rateLimitPerUser = body.rate_limit_per_user
		}
		if (body.nsfw !== undefined) {
			channel.nsfw = body.nsfw
		}
		if (body.permission_overwrites) {
			channel.permissionOverwrites = body.permission_overwrites.map((ow) => ({
				id: ow.id,
				type: ow.type,
				allow: ow.allow ?? '0',
				deny: ow.deny ?? '0'
			}))
		}

		// Add to state
		session.state.addChannelToGuild(guildId, channel)

		// Record action
		session.recordAction(
			'channel_created',
			{
				channel_id: channel.id,
				guild_id: guildId,
				name: channel.name,
				type: channel.type
			},
			{
				endpoint: `POST /guilds/${guildId}/channels`,
				method: 'POST'
			}
		)

		// Dispatch CHANNEL_CREATE event
		const apiChannel = mockChannelToAPIChannel(channel)
		getGatewayServer().dispatchToSession(session.id, 'CHANNEL_CREATE', apiChannel, guildId)

		// Return the channel object directly (Robo.js server will serialize it)
		return apiChannel
	}

	// GET - Get all channels for this guild
	const channels = []
	for (const channelId of guild.channels) {
		const channel = session.state.channels.get(channelId)
		if (channel) {
			channels.push(mockChannelToAPIChannel(channel))
		}
	}

	return channels
}
