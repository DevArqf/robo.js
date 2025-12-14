import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../../../core/manager.js'
import { parseMockToken } from '../../../../../utils/id.js'

export default async (request: RoboRequest) => {
	const authHeader = request.headers.get('Authorization') || ''
	const sessionId = parseMockToken(authHeader)

	if (!sessionId) {
		return new Response(JSON.stringify({ message: 'Unauthorized', code: 0 }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	const session = sessionManager.get(sessionId)
	if (!session) {
		return new Response(JSON.stringify({ message: 'Unauthorized', code: 0 }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	const { app_id, emoji_id } = request.params as { app_id: string; emoji_id: string }

	// Validate app_id matches session
	if (app_id !== session.state.applicationId && app_id !== '@me') {
		return new Response(JSON.stringify({ message: 'Forbidden', code: 50001 }), {
			status: 403,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	const emoji = session.state.applicationEmojis.get(emoji_id)

	// GET - Fetch specific emoji
	if (request.method === 'GET') {
		if (!emoji) {
			return new Response(JSON.stringify({ message: 'Unknown Emoji', code: 10014 }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			})
		}

		return {
			id: emoji.id,
			name: emoji.name,
			animated: emoji.animated ?? false
		}
	}

	// DELETE - Delete emoji
	if (request.method === 'DELETE') {
		if (!emoji) {
			return new Response(JSON.stringify({ message: 'Unknown Emoji', code: 10014 }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			})
		}

		session.state.applicationEmojis.delete(emoji_id)

		return new Response(null, { status: 204 })
	}

	return new Response(JSON.stringify({ message: 'Method not allowed', code: 0 }), {
		status: 405,
		headers: { 'Content-Type': 'application/json' }
	})
}
