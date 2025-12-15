export default {
	cors: true,
	/**
	 * Plugin-declared default prefix for @robojs/mock routes.
	 *
	 * Routes are registered at /mock/* (exclusive mode):
	 * - /mock/api/v10/channels/:id/messages - Discord REST API emulation
	 * - /mock/stage/ - Stage UI
	 *
	 * The CLI extensions (dev.ts) configure DISCORD_REST_API to point to the
	 * prefixed path so Discord.js correctly hits /mock/api/v10/*.
	 */
	prefix: 'mock'
}
