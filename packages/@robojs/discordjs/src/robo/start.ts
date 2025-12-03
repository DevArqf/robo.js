/**
 * Start Hook - Discord Client Login
 *
 * This hook runs during Robo.start() AFTER the prepare hook to:
 * 1. Validate the Discord token
 * 2. Login to Discord
 *
 * The client instance is created in the prepare hook, allowing other plugins
 * to access it during their start hooks before the bot goes online.
 */
import { getClient } from '../core/client.js'
import { discordLogger } from '../core/logger.js'

/**
 * Start hook - Logs the Discord client into Discord
 */
export default async function startHook(): Promise<void> {
	// Get the bot token from environment
	const token = process.env.DISCORD_TOKEN
	if (!token) {
		throw new Error('Missing DISCORD_TOKEN environment variable. Set it in your .env file.')
	}

	// Get the client (created in prepare hook)
	const client = getClient()

	// Login to Discord
	discordLogger.debug('Logging in to Discord...')
	await client.login(token)
	discordLogger.debug('Successfully logged in to Discord')
}
