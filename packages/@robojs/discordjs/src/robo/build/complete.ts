/**
 * Build complete hook for @robojs/discordjs
 *
 * Runs after manifest generation. Handles:
 * - Metadata aggregation for permissions, intents, scopes
 * - Command/context menu registration with Discord API
 * - Intent inference and validation
 */
import type { BuildCompleteContext, HandlerEntry, ProcessedEntry } from 'robo.js'
import { Env } from 'robo.js'
import { GatewayIntentBits } from 'discord.js'
import { discordLogger } from '../../core/logger.js'
import { inferIntents, getIntentNames, REQUIRED_INTENTS } from '../../core/intents.js'
import { buildSlashCommands, buildContextCommands, registerCommandsToDiscord } from '../../core/commands.js'
import { REST } from 'discord.js'
import type { DiscordConfig, DiscordjsAggregatedMetadata } from '../../types/index.js'

/**
 * Privileged intents that require special approval from Discord.
 */
const PRIVILEGED_INTENTS = new Set([
	GatewayIntentBits.GuildMembers,
	GatewayIntentBits.GuildPresences,
	GatewayIntentBits.MessageContent
])

/**
 * Reverse mapping from intent bits to their names.
 */
const intentBitToName = Object.fromEntries(
	Object.entries(GatewayIntentBits)
		.filter(([key]) => isNaN(Number(key)))
		.map(([key, value]) => [value, key])
) as Record<number, string>

export default async function (context: BuildCompleteContext) {
	const { entries, mode, store, registerMetadataAggregator } = context
	const discordConfig = context.config as unknown as DiscordConfig | undefined
	const envData = Env.data()

	// Register metadata aggregator for discordjs namespace
	registerMetadataAggregator<DiscordjsAggregatedMetadata>('discordjs', (handlerEntries, pluginDefaults) => {
		return aggregateDiscordMetadata(handlerEntries, pluginDefaults as DiscordConfig | undefined)
	})

	// Get command and context menu entries from the manifest
	const commandEntries = entries.get('discordjs', 'commands') ?? []
	const contextEntries = entries.get('discordjs', 'context') ?? []
	const eventEntries = entries.get('discordjs', 'events') ?? []

	discordLogger.debug(`Found ${commandEntries.length} commands, ${contextEntries.length} context menus, ${eventEntries.length} events`)

	// Analyze and validate intents
	const eventNames = eventEntries.map((e: ProcessedEntry) => e.key)
	const inferredIntents = inferIntents(eventNames)

	if (inferredIntents.size > 0) {
		const intentNames = getIntentNames(inferredIntents)
		discordLogger.debug(`Inferred intents from events: ${intentNames.join(', ')}`)

		// Store inferred intents for runtime use
		store.set('discord:inferredIntents', Array.from(inferredIntents))
	}

	// Determine if we should register commands
	const shouldRegister = mode === 'production' || discordConfig?.registerOnDev === true
	const hasToken = store.get<boolean>('discord:hasToken')
	const hasClientId = store.get<boolean>('discord:hasClientId')

	if (!shouldRegister) {
		discordLogger.debug('Skipping command registration (dev mode)')
		return
	}

	if (!hasClientId || !hasToken) {
		discordLogger.warn('Cannot register commands: missing DISCORD_CLIENT_ID or DISCORD_TOKEN')
		return
	}

	// Build command structures
	const clientId = envData.DISCORD_CLIENT_ID!
	const token = envData.DISCORD_TOKEN!
	const guildId = envData.DISCORD_GUILD_ID ?? discordConfig?.testServers?.[0]

	try {
		// Convert entries to command format
		const commands = entriesToCommands(commandEntries)
		const userContext = entriesToContext(contextEntries, 'user')
		const messageContext = entriesToContext(contextEntries, 'message')

		// Build Discord API command structures
		const slashCommands = buildSlashCommands(commands, discordConfig)
		const userContextCommands = buildContextCommands(userContext, 'user', discordConfig)
		const messageContextCommands = buildContextCommands(messageContext, 'message', discordConfig)

		const commandData = [
			...slashCommands.map((cmd) => cmd.toJSON()),
			...userContextCommands.map((cmd) => cmd.toJSON()),
			...messageContextCommands.map((cmd) => cmd.toJSON())
		]

		if (commandData.length === 0) {
			discordLogger.debug('No commands to register')
			return
		}

		// Register with Discord API
		const rest = new REST({ version: '10' }).setToken(token)
		await registerCommandsToDiscord(rest, clientId, guildId, commandData, false)

		const scope = guildId ? `guild ${guildId}` : 'global'
		discordLogger.info(`Registered ${commandData.length} ${scope} commands`)
	} catch (error) {
		discordLogger.error('Failed to register Discord commands:', error)
	}
}

/**
 * Convert processed entries to command entry format.
 */
function entriesToCommands(entries: ProcessedEntry[]) {
	const commands: Record<string, Record<string, unknown>> = {}

	for (const entry of entries) {
		const keyParts = entry.key.split(' ')
		const rootName = keyParts[0]

		if (keyParts.length === 1) {
			// Top-level command
			commands[rootName] = {
				...entry.metadata
			}
		} else if (keyParts.length === 2) {
			// Subcommand
			if (!commands[rootName]) {
				commands[rootName] = { subcommands: {} }
			}
			if (!commands[rootName].subcommands) {
				commands[rootName].subcommands = {}
			}
			(commands[rootName].subcommands as Record<string, unknown>)[keyParts[1]] = entry.metadata
		} else if (keyParts.length === 3) {
			// Subcommand group
			if (!commands[rootName]) {
				commands[rootName] = { subcommands: {} }
			}
			if (!commands[rootName].subcommands) {
				commands[rootName].subcommands = {}
			}
			const subcommands = commands[rootName].subcommands as Record<string, Record<string, unknown>>
			if (!subcommands[keyParts[1]]) {
				subcommands[keyParts[1]] = { subcommands: {} }
			}
			if (!subcommands[keyParts[1]].subcommands) {
				subcommands[keyParts[1]].subcommands = {}
			}
			(subcommands[keyParts[1]].subcommands as Record<string, unknown>)[keyParts[2]] = entry.metadata
		}
	}

	return commands
}

/**
 * Convert processed entries to context menu format.
 */
function entriesToContext(entries: ProcessedEntry[], type: 'user' | 'message') {
	const contextType = type === 'user' ? 2 : 3
	const result: Record<string, Record<string, unknown>> = {}

	for (const entry of entries) {
		if (entry.metadata.contextType === contextType) {
			result[entry.key] = entry.metadata
		}
	}

	return result
}

/**
 * Aggregate Discord metadata from all handler entries.
 * Creates the structure for metadata/discordjs.json per the architecture spec.
 */
function aggregateDiscordMetadata(
	entries: HandlerEntry[],
	pluginDefaults?: DiscordConfig
): DiscordjsAggregatedMetadata {
	const intents = new Set<number>()
	const permissions = new Set<string>()
	const scopes = new Set<string>(['bot', 'applications.commands'])

	const intentsByHandler: Record<string, string[]> = {}
	const permissionsByHandler: Record<string, string[]> = {}
	const intentsBySource: Record<string, { inferred: string[]; explicit: string[] }> = {}
	const permissionsBySource: Record<string, string[]> = {}
	const scopesBySource: Record<string, string[]> = {}
	const commandsBySource: Record<string, number> = {}
	const contextMenusBySource: Record<string, number> = {}

	// Track sources
	const sources = new Set<string>()

	for (const entry of entries) {
		const source = entry.plugin ?? 'project'
		sources.add(source)

		// Initialize source tracking
		if (!intentsBySource[source]) {
			intentsBySource[source] = { inferred: [], explicit: [] }
		}
		if (!permissionsBySource[source]) {
			permissionsBySource[source] = []
		}
		if (!scopesBySource[source]) {
			scopesBySource[source] = []
		}
		if (!commandsBySource[source]) {
			commandsBySource[source] = 0
		}
		if (!contextMenusBySource[source]) {
			contextMenusBySource[source] = 0
		}

		// Count commands and context menus
		const routeType = entry.path?.includes('/commands/') ? 'commands' : entry.path?.includes('/context/') ? 'context' : null
		if (routeType === 'commands') {
			commandsBySource[source]++
		} else if (routeType === 'context') {
			contextMenusBySource[source]++
		}

		// Extract permissions from defaultMemberPermissions
		const metadata = entry.metadata as Record<string, unknown>
		if (metadata?.defaultMemberPermissions) {
			const perms = parsePermissions(metadata.defaultMemberPermissions)
			perms.forEach((p) => {
				permissions.add(p)
				permissionsBySource[source].push(p)
				if (!permissionsByHandler[p]) {
					permissionsByHandler[p] = []
				}
				permissionsByHandler[p].push(entry.path)
			})
		}

		// Infer intents from event handlers
		if (entry.path?.includes('/events/')) {
			const eventName = entry.key
			const requiredBits = REQUIRED_INTENTS[eventName]
			if (requiredBits) {
				const bits = Array.isArray(requiredBits) ? requiredBits : [requiredBits]
				bits.forEach((bit) => {
					intents.add(bit)
					const intentName = intentBitToName[bit]
					if (intentName) {
						intentsBySource[source].inferred.push(intentName)
						if (!intentsByHandler[intentName]) {
							intentsByHandler[intentName] = []
						}
						intentsByHandler[intentName].push(entry.path)
					}
				})
			}
		}
	}

	// Add explicit intents from plugin config (intents are in clientOptions)
	const configuredIntents = pluginDefaults?.clientOptions?.intents
	if (configuredIntents) {
		// Discord.js intents can be a number (bitfield), array, or GatewayIntentBits enum values
		const intentValues: number[] = []

		if (typeof configuredIntents === 'number') {
			// Single bitfield value - extract individual intent bits
			for (const [name, bit] of Object.entries(GatewayIntentBits)) {
				if (!isNaN(Number(name))) continue // Skip numeric keys
				if ((configuredIntents & (bit as number)) === bit) {
					intentValues.push(bit as number)
				}
			}
		} else if (Array.isArray(configuredIntents)) {
			for (const intent of configuredIntents) {
				if (typeof intent === 'number') {
					intentValues.push(intent)
				} else if (typeof intent === 'string' && intent in GatewayIntentBits) {
					intentValues.push(GatewayIntentBits[intent as keyof typeof GatewayIntentBits] as number)
				}
			}
		}

		intentValues.forEach((bit) => {
			intents.add(bit)
			const intentName = intentBitToName[bit]
			if (intentName) {
				const pluginSource = '@robojs/discordjs'
				if (!intentsBySource[pluginSource]) {
					intentsBySource[pluginSource] = { inferred: [], explicit: [] }
				}
				intentsBySource[pluginSource].explicit.push(intentName)
			}
		})
	}

	// Convert intent bits to names for output
	const intentNames = Array.from(intents).map((bit) => intentBitToName[bit]).filter(Boolean)
	const requiredIntents = intentNames.filter((name) => {
		const bit = Object.entries(intentBitToName).find(([, n]) => n === name)?.[0]
		return bit && PRIVILEGED_INTENTS.has(Number(bit))
	})
	const optionalIntents = intentNames.filter((name) => !requiredIntents.includes(name))

	return {
		namespace: 'discordjs',
		sources: Array.from(sources),
		intents: {
			required: requiredIntents,
			optional: optionalIntents,
			bySource: intentsBySource,
			byHandler: intentsByHandler
		},
		permissions: {
			bot: Array.from(permissions),
			bySource: permissionsBySource,
			byHandler: permissionsByHandler
		},
		scopes: {
			required: Array.from(scopes),
			optional: [],
			bySource: scopesBySource
		},
		registration: {
			commands: {
				total: Object.values(commandsBySource).reduce((a, b) => a + b, 0),
				bySource: commandsBySource
			},
			contextMenus: {
				total: Object.values(contextMenusBySource).reduce((a, b) => a + b, 0),
				bySource: contextMenusBySource
			}
		}
	}
}

/**
 * Parse permissions from various formats (string, number, bigint).
 */
function parsePermissions(value: unknown): string[] {
	if (typeof value === 'string') {
		// Could be a single permission name or comma-separated
		return value.split(',').map((s) => s.trim()).filter(Boolean)
	}
	if (typeof value === 'number' || typeof value === 'bigint') {
		// Permission bitfield - would need Discord.js PermissionFlagsBits mapping
		// For now, return empty as parsing bitfields is complex
		return []
	}
	if (Array.isArray(value)) {
		return value.filter((v) => typeof v === 'string')
	}
	return []
}
