import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../core/manager.js'
import { parseMockToken } from '../../../utils/id.js'
import { buildGuildCreatePayload } from '../../../discord/payloads.js'

/**
 * GET /api/v10/guilds/:id - Fetch guild
 * PATCH /api/v10/guilds/:id - Modify guild
 *
 * Returns the guild object for the given ID based on the session identified
 * by the Authorization header (mock token).
 *
 * @see https://discord.com/developers/docs/resources/guild#get-guild
 * @see https://discord.com/developers/docs/resources/guild#modify-guild
 */
export default async (request: RoboRequest) => {
	// Validate method
	if (request.method !== 'GET' && request.method !== 'PATCH') {
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

	// Handle PATCH - Modify guild
	if (request.method === 'PATCH') {
		let body: Record<string, unknown>
		try {
			body = await request.json()
		} catch {
			return new Response(JSON.stringify({ error: 'Invalid JSON body', code: 50035 }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			})
		}

		// Store old guild state for GUILD_UPDATE event
		const oldGuild = { ...guild }

		// Update guild fields
		if (body.name !== undefined) {
			guild.name = String(body.name)
		}
		if (body.description !== undefined) {
			guild.description = body.description === null ? null : String(body.description)
		}
		if (body.afk_channel_id !== undefined) {
			guild.afkChannelId = body.afk_channel_id as string | null
		}
		if (body.afk_timeout !== undefined) {
			guild.afkTimeout = Number(body.afk_timeout)
		}
		if (body.system_channel_id !== undefined) {
			guild.systemChannelId = body.system_channel_id as string | null
		}
		if (body.system_channel_flags !== undefined) {
			guild.systemChannelFlags = Number(body.system_channel_flags)
		}
		if (body.verification_level !== undefined) {
			guild.verificationLevel = Number(body.verification_level)
		}
		if (body.default_message_notifications !== undefined) {
			guild.defaultMessageNotifications = Number(body.default_message_notifications)
		}
		if (body.explicit_content_filter !== undefined) {
			guild.explicitContentFilter = Number(body.explicit_content_filter)
		}
		if (body.mfa_level !== undefined) {
			guild.mfaLevel = Number(body.mfa_level)
		}
		if (body.icon !== undefined) {
			guild.icon = body.icon as string | null
		}
		if (body.splash !== undefined) {
			guild.splash = body.splash as string | null
		}
		if (body.banner !== undefined) {
			guild.banner = body.banner as string | null
		}

		// Dispatch GUILD_UPDATE event
		session.state.sequence++
		const payload = buildGuildCreatePayload({
			sessionState: session.state,
			guild,
			sequence: session.state.sequence
		})

		// Change the event type to GUILD_UPDATE
		const updatePayload = {
			op: payload.op,
			s: payload.s,
			t: 'GUILD_UPDATE',
			d: payload.d
		}

		// Dispatch to connected clients
		session.dispatchToAllConnections(updatePayload)

		// Record the action
		session.recordAction('GUILD_UPDATE', {
			guild_id: guildId,
			changes: body
		})
	}

	// Build and return the guild payload
	const payload = buildGuildCreatePayload({
		sessionState: session.state,
		guild,
		sequence: session.state.sequence
	})

	// payload.d is the guild object
	return payload.d
}
