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
 * Supports:
 * - Discord-like format: <24 chars>.<6 chars MOCK marker>.<27+ chars session>
 * - With optional "mock:" prefix: mock:<discord-like-token>
 * - Plain session ID format: mock:<session_id> (for simple session IDs without dots)
 */
export function parseMockToken(token: string): string | null {
	// Handle "Bot <token>" prefix (Discord.js adds this to Authorization header)
	let normalized = token.replace(/^Bot\s+/i, '').trim()

	// Strip trailing slashes that might come from URL parsing
	normalized = normalized.replace(/\/+$/, '')

	// Strip "mock:" prefix if present, then continue parsing
	if (normalized.startsWith(TOKEN_PREFIX)) {
		normalized = normalized.slice(TOKEN_PREFIX.length)
	}

	// Check for Discord-like format: <part1>.<part2>.<part3>
	const parts = normalized.split('.')
	if (parts.length === 3 && parts[1] === MOCK_TOKEN_MARKER_B64) {
		// Decode session ID from part 3 (base64url with '_' padding)
		try {
			// Strip trailing underscores (padding) and any trailing slashes (from URL issues)
			const sessionPart = parts[2].replace(/[_/]+$/, '')
			return Buffer.from(sessionPart, 'base64url').toString('utf-8')
		} catch {
			// Invalid base64
			return null
		}
	}

	// If not Discord-like format, treat the normalized string as a plain session ID
	// This handles cases like "mock:sess_xxx" → "sess_xxx"
	if (normalized.startsWith('sess_')) {
		return normalized
	}

	return null
}
