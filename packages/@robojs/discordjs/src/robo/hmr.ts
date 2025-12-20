/**
 * HMR Hook for @robojs/discordjs
 *
 * Automatically re-registers Discord commands when their definitions change
 * during development. This enables instant command updates without restart.
 *
 * Since HMR is opt-in (via `robo dev --hmr`), this hook always runs when
 * HMR is enabled - users who enable HMR want instant updates.
 */
import crypto from 'node:crypto'
import { Env, getPluginOptions, portal } from 'robo.js'
import { REST } from 'discord.js'
import { discordLogger } from '../core/logger.js'
import { buildSlashCommands, buildContextCommands, registerCommandsToDiscord } from '../core/commands.js'
import type { HmrContext, HmrHookConfig } from 'robo.js'
import type { CommandEntry, ContextEntry, DiscordConfig } from '../types/index.js'

/**
 * Config export to filter HMR events.
 * Only triggers for discordjs namespace, commands and context routes.
 */
export const config: HmrHookConfig = {
	namespaces: ['discordjs'],
	routes: ['commands', 'context']
}

/**
 * Cache of previous command hashes to detect definition changes.
 * Key format: "{namespace}:{route}:{key}" -> hash
 */
const previousHashes = new Map<string, string>()

/**
 * Compute a hash of command metadata for change detection.
 */
function computeMetadataHash(metadata: Record<string, unknown>): string {
	// Sort keys for deterministic output
	const sorted = JSON.stringify(sortObjectKeys(metadata))
	return crypto.createHash('sha256').update(sorted).digest('hex').slice(0, 16)
}

/**
 * Recursively sorts object keys for deterministic JSON output.
 */
function sortObjectKeys(obj: unknown): unknown {
	if (obj === null || typeof obj !== 'object') {
		return obj
	}
	if (Array.isArray(obj)) {
		return obj.map(sortObjectKeys)
	}
	const sorted: Record<string, unknown> = {}
	for (const key of Object.keys(obj).sort()) {
		sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key])
	}
	return sorted
}

/**
 * HMR hook - detects command definition changes and re-registers with Discord.
 */
export default async function (context: HmrContext): Promise<void> {
	const changedKeys: string[] = []

	// Check each affected route for definition changes
	for (const route of context.routes) {
		for (const handler of route.handlers) {
			const cacheKey = `${route.namespace}:${route.route}:${handler.key}`

			// Get the current handler record from portal
			const record = portal.getRecord(route.namespace, route.route, handler.key)
			if (!record) continue

			// Ensure handler is imported
			await portal.importHandler(route.namespace, route.route, handler.key)

			// Get metadata from handler's config export
			const metadata = (record.metadata ?? {}) as Record<string, unknown>
			const currentHash = computeMetadataHash(metadata)
			const previousHash = previousHashes.get(cacheKey)

			// Check if definition changed (not just handler code)
			// On first HMR for this command, previousHash is undefined - treat as change
			// since the user explicitly modified this file
			if (!previousHash || previousHash !== currentHash) {
				changedKeys.push(handler.key)
				discordLogger.debug(`[HMR] Command definition changed: ${handler.key}`)
			}

			// Update cache
			previousHashes.set(cacheKey, currentHash)
		}
	}

	// If no definition changes, nothing to do
	if (changedKeys.length === 0) {
		discordLogger.debug('[HMR] No command definition changes detected')
		return
	}

	// Re-register commands in the background
	const pluginConfig = getPluginOptions('@robojs/discordjs') as DiscordConfig | undefined
	registerCommandsBackground(changedKeys, pluginConfig).catch((error) => {
		discordLogger.warn('[HMR] Failed to update commands on Discord:', error)
	})
}

/**
 * Re-register all commands with Discord in the background.
 * Does not block HMR completion.
 */
async function registerCommandsBackground(
	changedKeys: string[],
	config?: DiscordConfig
): Promise<void> {
	const envData = Env.data()
	const clientId = envData.DISCORD_CLIENT_ID
	const token = envData.DISCORD_TOKEN
	const guildId = envData.DISCORD_GUILD_ID ?? config?.testServers?.[0]

	if (!token || !clientId) {
		discordLogger.warn('[HMR] Cannot update commands: missing DISCORD_CLIENT_ID or DISCORD_TOKEN')
		return
	}

	discordLogger.info(`[HMR] Re-registering ${changedKeys.length} changed command(s)...`)

	try {
		// Ensure routes are loaded
		await portal.ensureRoute('discordjs', 'commands')
		await portal.ensureRoute('discordjs', 'context')

		// Get all commands from portal
		const commandRecords = portal.getByType('discordjs:commands') as Record<string, { metadata: Record<string, unknown> }>
		const contextRecords = portal.getByType('discordjs:context') as Record<string, { metadata: Record<string, unknown> }>

		// Convert records to command format
		const commands = recordsToCommands(commandRecords)
		const userContext = recordsToContext(contextRecords, 'user')
		const messageContext = recordsToContext(contextRecords, 'message')

		// Build Discord API command structures
		const slashCommands = buildSlashCommands(commands, config, true)
		const userContextCommands = buildContextCommands(userContext, 'user', config, true)
		const messageContextCommands = buildContextCommands(messageContext, 'message', config, true)

		const commandData = [
			...slashCommands.map((cmd) => cmd.toJSON()),
			...userContextCommands.map((cmd) => cmd.toJSON()),
			...messageContextCommands.map((cmd) => cmd.toJSON())
		]

		if (commandData.length === 0) {
			discordLogger.debug('[HMR] No commands to register')
			return
		}

		// Register with Discord API
		const rest = new REST({ version: '10' }).setToken(token)
		await registerCommandsToDiscord(rest, clientId, guildId, commandData, false, {
			timeout: 10000 // Short timeout for HMR
		})

		const scope = guildId ? 'guild' : 'global'
		discordLogger.info(`[HMR] Updated ${changedKeys.length} ${scope} command(s) on Discord`)
	} catch (error) {
		throw error
	}
}

/**
 * Convert portal records to command entry format.
 */
function recordsToCommands(records: Record<string, { metadata: Record<string, unknown> }>): Record<string, CommandEntry> {
	const commands: Record<string, CommandEntry> = {}

	for (const [key, record] of Object.entries(records)) {
		const keyParts = key.split(' ')
		const rootName = keyParts[0]

		if (keyParts.length === 1) {
			// Top-level command
			commands[rootName] = record.metadata as CommandEntry
		} else if (keyParts.length === 2) {
			// Subcommand
			if (!commands[rootName]) {
				commands[rootName] = { subcommands: {} } as CommandEntry
			}
			if (!commands[rootName].subcommands) {
				commands[rootName].subcommands = {}
			}
			commands[rootName].subcommands![keyParts[1]] = record.metadata as CommandEntry
		} else if (keyParts.length === 3) {
			// Subcommand group
			if (!commands[rootName]) {
				commands[rootName] = { subcommands: {} } as CommandEntry
			}
			if (!commands[rootName].subcommands) {
				commands[rootName].subcommands = {}
			}
			if (!commands[rootName].subcommands![keyParts[1]]) {
				commands[rootName].subcommands![keyParts[1]] = { subcommands: {} } as CommandEntry
			}
			if (!commands[rootName].subcommands![keyParts[1]].subcommands) {
				commands[rootName].subcommands![keyParts[1]].subcommands = {}
			}
			commands[rootName].subcommands![keyParts[1]].subcommands![keyParts[2]] = record.metadata as CommandEntry
		}
	}

	return commands
}

/**
 * Convert portal records to context menu format.
 */
function recordsToContext(
	records: Record<string, { metadata: Record<string, unknown> }>,
	type: 'user' | 'message'
): Record<string, ContextEntry> {
	const contextType = type === 'user' ? 2 : 3
	const result: Record<string, ContextEntry> = {}

	for (const [key, record] of Object.entries(records)) {
		if (record.metadata.contextType === contextType) {
			result[key] = record.metadata as ContextEntry
		}
	}

	return result
}
