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
 * Legacy token format for mock sessions: mock:<session_id>
 * Kept for backwards compatibility with direct API usage
 */
export const TOKEN_PREFIX = 'mock:'

/**
 * Marker used in Discord-like tokens to identify them as mock tokens
 * This is the base64 encoding of 'MOCK' without padding (exactly 6 chars)
 */
const MOCK_TOKEN_MARKER_B64 = 'TU9DSw'

/**
 * Create a mock token from a session ID
 *
 * Generates a token that looks like a valid Discord bot token to pass
 * client-side validation, but can still be parsed to extract the session ID.
 *
 * Format: <24 chars>.<6 chars>.<27+ chars>
 * - Part 1: Base64 of fake bot ID (24 chars)
 * - Part 2: Base64 of 'MOCK' marker (6 chars)
 * - Part 3: Base64url of session ID, padded to 27 chars minimum
 *
 * Discord token format: <base64(bot_id)>.<timestamp>.<hmac>
 */
export function createMockToken(sessionId: string): string {
	// Part 1: Fake bot ID - 18 digit snowflake produces 24 base64 chars
	const fakeBotId = '000000000000000000'
	const part1 = Buffer.from(fakeBotId).toString('base64').replace(/=+$/, '')

	// Part 2: MOCK marker - exactly 6 base64 chars
	const part2 = MOCK_TOKEN_MARKER_B64

	// Part 3: Session ID encoded as base64url, padded to at least 27 chars
	const sessionEncoded = Buffer.from(sessionId).toString('base64url')
	const part3 = sessionEncoded.padEnd(27, '_')

	return `${part1}.${part2}.${part3}`
}

/**
 * Parse a mock token to extract the session ID
 * Returns null if the token doesn't match the expected format
 *
 * Supports both:
 * - Legacy format: mock:<session_id>
 * - Discord-like format: <24 chars>.<6 chars MOCK marker>.<27+ chars session>
 */
export function parseMockToken(token: string): string | null {
	// Handle "Bot <token>" prefix (Discord.js adds this to Authorization header)
	const normalized = token.replace(/^Bot\s+/i, '')

	// Check for legacy format: mock:<session_id>
	if (normalized.startsWith(TOKEN_PREFIX)) {
		return normalized.slice(TOKEN_PREFIX.length)
	}

	// Check for Discord-like format: <part1>.<part2>.<part3>
	const parts = normalized.split('.')
	if (parts.length !== 3) {
		return null
	}

	// Verify part 2 is the MOCK marker
	if (parts[1] !== MOCK_TOKEN_MARKER_B64) {
		return null
	}

	// Decode session ID from part 3 (base64url with '_' padding)
	try {
		const sessionPart = parts[2].replace(/_+$/, '')
		return Buffer.from(sessionPart, 'base64url').toString('utf-8')
	} catch {
		// Invalid base64
		return null
	}
}
