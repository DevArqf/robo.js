/**
 * Integration Test Constants
 *
 * Configuration values used by all integration tests.
 * These can be overridden via environment variables.
 */

export const MOCK_CONFIG = {
	/** REST API URL (without /v10 - discord.js adds it) */
	REST_URL: process.env.MOCK_REST_URL ?? 'http://localhost:3000/mock/api',

	/** WebSocket Gateway URL */
	WS_URL: process.env.MOCK_WS_URL ?? 'ws://localhost:3000',

	/** Control API URL */
	CONTROL_URL: process.env.MOCK_CONTROL_URL ?? 'http://localhost:3000/mock/api/control',

	/** Server port */
	SERVER_PORT: parseInt(process.env.MOCK_PORT ?? '3000', 10),

	/** Default timeout for test operations (ms) */
	TIMEOUT: parseInt(process.env.MOCK_TIMEOUT ?? '10000', 10),

	/** Server startup timeout (ms) */
	SERVER_STARTUP_TIMEOUT: 30000
}

/**
 * All Discord Gateway intents combined.
 * Useful for tests that need full access to events.
 */
export const ALL_INTENTS =
	(1 << 0) | // GUILDS
	(1 << 1) | // GUILD_MEMBERS (privileged)
	(1 << 2) | // GUILD_MODERATION
	(1 << 3) | // GUILD_EMOJIS_AND_STICKERS
	(1 << 4) | // GUILD_INTEGRATIONS
	(1 << 5) | // GUILD_WEBHOOKS
	(1 << 6) | // GUILD_INVITES
	(1 << 7) | // GUILD_VOICE_STATES
	(1 << 8) | // GUILD_PRESENCES (privileged)
	(1 << 9) | // GUILD_MESSAGES
	(1 << 10) | // GUILD_MESSAGE_REACTIONS
	(1 << 11) | // GUILD_MESSAGE_TYPING
	(1 << 12) | // DIRECT_MESSAGES
	(1 << 13) | // DIRECT_MESSAGE_REACTIONS
	(1 << 14) | // DIRECT_MESSAGE_TYPING
	(1 << 15) | // MESSAGE_CONTENT (privileged)
	(1 << 16) | // GUILD_SCHEDULED_EVENTS
	(1 << 20) | // AUTO_MODERATION_CONFIGURATION
	(1 << 21) | // AUTO_MODERATION_EXECUTION
	(1 << 24) | // GUILD_MESSAGE_POLLS
	(1 << 25) // DIRECT_MESSAGE_POLLS

/**
 * Privileged intents that require special approval
 */
export const PRIVILEGED_INTENTS = {
	GUILD_MEMBERS: 1 << 1,
	GUILD_PRESENCES: 1 << 8,
	MESSAGE_CONTENT: 1 << 15
}

/**
 * Common Discord Gateway close codes for testing
 */
export const GATEWAY_CLOSE_CODES = {
	NORMAL: 1000,
	GOING_AWAY: 1001,
	UNKNOWN_ERROR: 4000,
	UNKNOWN_OPCODE: 4001,
	DECODE_ERROR: 4002,
	NOT_AUTHENTICATED: 4003,
	AUTHENTICATION_FAILED: 4004,
	ALREADY_AUTHENTICATED: 4005,
	INVALID_SEQ: 4007,
	RATE_LIMITED: 4008,
	SESSION_TIMED_OUT: 4009,
	INVALID_SHARD: 4010,
	SHARDING_REQUIRED: 4011,
	INVALID_API_VERSION: 4012,
	INVALID_INTENTS: 4013,
	DISALLOWED_INTENTS: 4014
}
