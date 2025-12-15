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
interface DiscordAPIUser {
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

/**
 * Fetch bot user data from Discord API using the saved real token.
 * Returns null if no token exists or the API call fails.
 */
async function fetchDiscordBotUser(): Promise<DiscordAPIUser | null> {
	const token = process.env.ROBO_MOCK_REAL_TOKEN

	if (!token) {
		mockLogger.debug('No real Discord token available for bot user lookup')
		return null
	}

	try {
		const response = await fetch('https://discord.com/api/v10/users/@me', {
			headers: {
				Authorization: `Bot ${token}`
			}
		})

		if (!response.ok) {
			mockLogger.debug(`Discord API returned ${response.status}: ${response.statusText}`)
			return null
		}

		const user = (await response.json()) as DiscordAPIUser
		return user
	} catch (error) {
		mockLogger.debug(`Failed to fetch bot user from Discord API: ${(error as Error).message}`)
		return null
	}
}
