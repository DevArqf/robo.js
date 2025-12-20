/**
 * Bot User Resolver
 *
 * Resolves the bot user configuration for mock sessions using a priority chain:
 * 1. Explicit config from defaultSessionConfig.botUser
 * 2. Fetch from Discord API using the real token
 * 3. Default "MockBot" fallback
 */
import { mockLogger } from '../core/logger.js'
import type { MockUserConfig } from '../types/index.js'

/**
 * Result of bot user resolution with source information.
 */
export interface ResolvedBotUser {
	config: MockUserConfig
	source: 'explicit' | 'discord-api' | 'default'
}

/**
 * Discord API user response shape (partial).
 */
export interface DiscordAPIUser {
	id: string
	username: string
	discriminator: string
	global_name: string | null
	avatar: string | null
	bot?: boolean
}

/**
 * Resolve the bot user configuration using the fallback chain:
 * 1. Explicit config from defaultSessionConfig.botUser
 * 2. Fetch from Discord API using real token (ROBO_MOCK_REAL_TOKEN)
 * 3. Default "MockBot"
 *
 * @param explicitConfig - Explicit bot user config from plugin options
 * @returns Resolved bot user config with source indicator
 */
export async function resolveBotUser(explicitConfig?: MockUserConfig): Promise<ResolvedBotUser> {
	// Priority 1: Explicit configuration
	if (explicitConfig && Object.keys(explicitConfig).length > 0) {
		mockLogger.debug('Using explicit bot user config')
		return { config: explicitConfig, source: 'explicit' }
	}

	// Priority 2: Fetch from Discord API using real token
	const discordUser = await fetchDiscordBotUser()
	if (discordUser) {
		mockLogger.debug(`Using Discord API bot user: ${discordUser.username}`)
		return {
			config: {
				id: discordUser.id,
				username: discordUser.username,
				discriminator: discordUser.discriminator,
				globalName: discordUser.global_name,
				avatar: discordUser.avatar,
				bot: discordUser.bot ?? true
			},
			source: 'discord-api'
		}
	}

	// Priority 3: Default fallback
	mockLogger.debug('Using default bot user: MockBot')
	return {
		config: {
			username: 'MockBot',
			bot: true
		},
		source: 'default'
	}
}

/** Timeout for Discord API calls (3 seconds) */
const API_TIMEOUT_MS = 3000

/**
 * Fetch bot user data from Discord API using a specific token.
 * Returns null if no token provided, the API call fails, or times out.
 * Never blocks - gracefully falls back on any failure.
 *
 * @param token - The Discord bot token to use for authentication
 * @returns The Discord API user data, or null on failure
 */
export async function fetchBotFromDiscord(token: string): Promise<DiscordAPIUser | null> {
	if (!token) {
		return null
	}

	try {
		// Use AbortController for timeout to avoid blocking
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

		const response = await fetch('https://discord.com/api/v10/users/@me', {
			headers: {
				Authorization: `Bot ${token}`
			},
			signal: controller.signal
		})

		clearTimeout(timeoutId)

		if (!response.ok) {
			mockLogger.debug(`Discord API returned ${response.status}`)
			return null
		}

		const user = (await response.json()) as DiscordAPIUser
		return user
	} catch (error) {
		// Network error, timeout, or other failure
		const message = (error as Error).name === 'AbortError'
			? 'Discord API timed out'
			: (error as Error).message
		mockLogger.debug(`${message}`)
		return null
	}
}

/**
 * Fetch bot user data from Discord API using the saved real token.
 * Returns null if no token exists, the API call fails, or times out.
 * Never blocks startup - gracefully falls back on any failure.
 */
async function fetchDiscordBotUser(): Promise<DiscordAPIUser | null> {
	const token = process.env.ROBO_MOCK_REAL_TOKEN

	if (!token) {
		mockLogger.debug('No Discord token - using default bot identity')
		return null
	}

	const user = await fetchBotFromDiscord(token)
	if (!user) {
		mockLogger.debug('Failed to fetch from Discord API - using default bot identity')
	}
	return user
}
