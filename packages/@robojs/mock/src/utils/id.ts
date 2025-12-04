import { randomBytes } from 'crypto'

/**
 * Generate a unique session ID
 * Format: sess_<random_string>
 */
export function generateSessionId(): string {
	const random = randomBytes(12).toString('base64url')
	return `sess_${random}`
}

/**
 * Generate an interaction token
 * Used for Discord interaction responses
 */
export function generateInteractionToken(): string {
	return randomBytes(32).toString('base64url')
}

/**
 * Generate a Discord-style session ID for Gateway connections
 */
export function generateGatewaySessionId(): string {
	return randomBytes(16).toString('hex')
}

/**
 * Token format for mock sessions: mock:<session_id>
 */
export const TOKEN_PREFIX = 'mock:'

/**
 * Create a mock token from a session ID
 */
export function createMockToken(sessionId: string): string {
	return `${TOKEN_PREFIX}${sessionId}`
}

/**
 * Parse a mock token to extract the session ID
 * Returns null if the token doesn't match the expected format
 */
export function parseMockToken(token: string): string | null {
	// Handle "Bot mock:sess_xxx" format (Discord.js style)
	const normalized = token.replace(/^Bot\s+/i, '')

	if (!normalized.startsWith(TOKEN_PREFIX)) {
		return null
	}

	return normalized.slice(TOKEN_PREFIX.length)
}
