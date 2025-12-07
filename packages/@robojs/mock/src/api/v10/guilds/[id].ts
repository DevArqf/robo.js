import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../core/manager.js'
import { parseMockToken } from '../../../utils/id.js'
import { buildGuildCreatePayload } from '../../../discord/payloads.js'

/**
 * GET /api/v10/guilds/:id - Fetch guild
 *
 * Returns the guild object for the given ID based on the session identified
 * by the Authorization header (mock token).
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

	// Reuse the GUILD_CREATE payload builder to return a full guild object
	const payload = buildGuildCreatePayload({
		sessionState: session.state,
		guild,
		sequence: session.state.sequence
	})

	// payload.d is the guild object
	return payload.d
}

