import { logger } from 'robo.js'

/**
 * Shared logger for @robojs/mock plugin
 * Following plugin standards: one forked logger per plugin
 */
export const mockLogger = logger.fork('mock')

// ============================================================================
// Token Redaction
// ============================================================================

/**
 * Pattern to match session IDs (sess_xxx format)
 * Captures: sess_ + 16+ base64url characters
 */
const SESSION_ID_PATTERN = /sess_[A-Za-z0-9_-]{12,}/g

/**
 * Pattern to match mock tokens (mock:sess_xxx or Discord-like format)
 */
const MOCK_TOKEN_PATTERN = /mock:sess_[A-Za-z0-9_-]{12,}/g

/**
 * Pattern to match Discord-like tokens (base64.MOCK.base64)
 */
const DISCORD_TOKEN_PATTERN = /[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{4,8}\.[A-Za-z0-9_-]{20,}/g

/**
 * Redact session tokens from a string
 *
 * @param input - String that may contain session tokens
 * @returns String with tokens redacted
 */
export function redactTokens(input: string): string {
	return input
		.replace(DISCORD_TOKEN_PATTERN, (match) => {
			// Keep first 10 chars, redact rest
			return match.slice(0, 10) + '...[REDACTED]'
		})
		.replace(MOCK_TOKEN_PATTERN, (match) => {
			// Keep mock:sess_ prefix + first 8 chars
			return match.slice(0, 16) + '...'
		})
		.replace(SESSION_ID_PATTERN, (match) => {
			// Keep sess_ prefix + first 8 chars
			return match.slice(0, 13) + '...'
		})
}

/**
 * Redact session tokens from an object (for safe logging)
 *
 * @param obj - Object that may contain session tokens
 * @returns Object with tokens redacted (shallow)
 */
export function redactObject<T extends Record<string, unknown>>(obj: T): T {
	const result = { ...obj }

	for (const key in result) {
		const value = result[key]
		if (typeof value === 'string') {
			result[key] = redactTokens(value) as T[typeof key]
		}
	}

	return result
}

/**
 * Check if a token looks like a mock token
 */
export function isMockToken(token: string): boolean {
	return token.startsWith('mock:') || token.includes('.TU9DSw.')
}
