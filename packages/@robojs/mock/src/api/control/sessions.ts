import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../core/manager.js'
import type { CreateSessionOptions, SessionConfig } from '../../types/index.js'
import { validateMethod, badRequest } from './utils.js'

/**
 * POST /api/control/sessions - Create a new session
 *
 * Request body:
 * {
 *   name?: string,      // Optional friendly name for debugging
 *   ttl?: number,       // Time-to-live in milliseconds (default: 1 hour)
 *   config?: {
 *     guilds?: [...],   // Pre-configured guilds
 *     users?: [...],    // Pre-configured users
 *     botUser?: {...},  // Bot user configuration
 *     applicationId?: string
 *   }
 * }
 *
 * Response:
 * {
 *   session_id: string,
 *   token: string,      // Format: "mock:<session_id>"
 *   expires_at: number  // Unix timestamp
 * }
 */

interface CreateSessionBody {
	name?: string
	ttl?: number
	config?: SessionConfig
}

export default async (request: RoboRequest) => {
	validateMethod(request, ['POST'])

	let body: CreateSessionBody = {}

	// Parse body if present
	try {
		const text = await request.text()
		if (text) {
			body = JSON.parse(text)
		}
	} catch {
		return badRequest('Invalid JSON body')
	}

	const options: CreateSessionOptions = {
		name: body.name,
		ttl: body.ttl,
		config: body.config
	}

	const session = await sessionManager.create(options)

	return {
		session_id: session.id,
		token: session.token,
		expires_at: session.expiresAt
	}
}
