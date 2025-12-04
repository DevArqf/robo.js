import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../core/manager.js'
import { parseMockToken } from '../../../utils/id.js'

/**
 * GET /api/v10/users/@me - Discord User endpoint mock
 *
 * Returns the authenticated bot user's information.
 * Parses the Authorization header to identify the session and return its bot user.
 *
 * Response matches Discord's format:
 * {
 *   id: string,
 *   username: string,
 *   discriminator: string,
 *   avatar: string | null,
 *   bot: boolean,
 *   ...
 * }
 */
export default async (request: RoboRequest) => {
	if (request.method !== 'GET') {
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// Get token from Authorization header
	const authHeader = request.headers.get('Authorization') || ''
	const sessionId = parseMockToken(authHeader)

	if (!sessionId) {
		return new Response(JSON.stringify({ error: 'Unauthorized', code: 0 }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// Get session
	const session = sessionManager.get(sessionId)
	if (!session) {
		return new Response(JSON.stringify({ error: 'Unauthorized', code: 0 }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	const botUser = session.state.botUser

	return {
		id: botUser.id,
		username: botUser.username,
		discriminator: botUser.discriminator,
		global_name: botUser.globalName,
		avatar: botUser.avatar,
		bot: botUser.bot,
		system: false,
		mfa_enabled: false,
		banner: null,
		accent_color: null,
		locale: 'en-US',
		verified: true,
		flags: 0,
		premium_type: 0,
		public_flags: 0
	}
}
