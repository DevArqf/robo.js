/**
 * Prepare Hook - Discord Client Setup
 *
 * This hook runs during Robo.start() BEFORE the start hook to:
 * 1. Create the Discord.js Client instance
 * 2. Register event listeners for gateway events
 * 3. Register interaction handler for commands/autocomplete/context menus
 *
 * The client is NOT logged in yet - that happens in the start hook.
 * This allows other plugins to access the client during their start hooks.
 */
import { Client, Events } from 'discord.js'
import { portal, color } from 'robo.js'
import { setClient, setPluginState } from '../core/client.js'
import { discordLogger } from '../core/logger.js'
import { getCommandKey } from '../core/utils.js'
import { handleInteraction } from '../core/interactions.js'
import { executeEventHandler } from '../core/handlers/event.js'
import type { DiscordConfig, PluginState } from '../types/index.js'
import type { Event, HandlerRecord, PrepareContext } from 'robo.js'

/**
 * Prepare hook - Creates and configures the Discord client (without logging in)
 */
export default async function prepareHook(context: PrepareContext<DiscordConfig>): Promise<void> {
	const { pluginConfig, logger, mode } = context
	const clientOptions = pluginConfig?.clientOptions ?? { intents: [] }

	// Support mock server REST API override via environment variable
	// This allows @robojs/mock to redirect Discord.js to the mock server
	if (process.env.DISCORD_REST_API) {
		clientOptions.rest = {
			...clientOptions.rest,
			api: process.env.DISCORD_REST_API
		}
		logger.debug('Using custom REST API:', process.env.DISCORD_REST_API)
	}

	logger.debug('Preparing Discord client with options:', clientOptions)

	// Initialize plugin state
	const pluginState: PluginState = {
		serverRestrictions: new Map(),
		config: pluginConfig ?? {}
	}
	setPluginState(pluginState)

	// Register plugin state with portal for controller access
	portal.registerPluginState('discordjs', pluginState)

	// Create the Discord client
	const client = new Client(clientOptions)
	setClient(client)

	// Production: eagerly load all routes for fastest runtime
	if (mode === 'production') {
		await eagerLoadHandlers()
	}

	// Register gateway event listeners
	await registerEventListeners(client)

	// Register interaction handler for commands/autocomplete/context menus
	registerInteractionHandler(client)

	logger.debug('Discord client prepared and ready for login')
}

/**
 * Eagerly load all handlers in production mode for fastest runtime access
 */
async function eagerLoadHandlers(): Promise<void> {
	// Load all route manifests
	await Promise.all([
		portal.ensureRoute('discordjs', 'commands'),
		portal.ensureRoute('discordjs', 'context'),
		portal.ensureRoute('discordjs', 'events')
	])

	// Get all handler keys
	const commands = Object.keys(portal.getByType('discordjs:commands'))
	const contexts = Object.keys(portal.getByType('discordjs:context'))

	// Import all handlers in parallel
	await Promise.all([
		...commands.map((k) => portal.importHandler('discordjs', 'commands', k)),
		...contexts.map((k) => portal.importHandler('discordjs', 'context', k))
	])

	discordLogger.debug(`Pre-loaded ${commands.length} commands, ${contexts.length} context menus`)
}

/**
 * Register event listeners for all gateway events defined in the portal
 */
async function registerEventListeners(client: Client): Promise<void> {
	// Ensure the events route is loaded
	await portal.ensureRoute('discordjs', 'events')

	// Get events from portal
	const events = portal.getByType('discordjs:events') as Record<string, HandlerRecord<Event>[]>

	for (const [eventName, eventHandlers] of Object.entries(events)) {
		// Skip lifecycle events (they're handled separately)
		if (eventName.startsWith('_')) {
			continue
		}

		// Check if all handlers are auto-generated (for logging purposes)
		const onlyAuto = eventHandlers.every((event: HandlerRecord<Event>) => event.auto)

		// Check if any handler uses frequency: 'once'
		const useOnce = eventHandlers.some(
			(event: HandlerRecord<Event>) => event.metadata?.frequency === 'once'
		)

		// Create the event callback
		const callback = async (...args: unknown[]) => {
			if (!onlyAuto) {
				discordLogger.event(`Event received: ${color.bold(eventName)}`)
			}
			discordLogger.trace('Event args:', args)

			// Execute all event handlers
			await executeEventHandler(eventName, ...args)
		}

		// Register with .once() or .on() based on frequency config
		if (useOnce) {
			client.once(eventName, callback)
		} else {
			client.on(eventName, callback)
		}

		discordLogger.debug(
			`Registered event listener: ${eventName} (${eventHandlers.length} handler(s), ${useOnce ? 'once' : 'always'})`
		)
	}
}

/**
 * Register the interaction handler for commands, autocomplete, and context menus
 */
function registerInteractionHandler(client: Client): void {
	client.on(Events.InteractionCreate, async (interaction) => {
		if (interaction.isChatInputCommand()) {
			const commandKey = getCommandKey(interaction)
			discordLogger.event(`Received slash command: ${color.bold('/' + commandKey)}`)
			discordLogger.trace('Slash command interaction:', interaction.toJSON())
			await handleInteraction(interaction, 'command', commandKey)
		} else if (interaction.isAutocomplete()) {
			const commandKey = getCommandKey(interaction)
			discordLogger.event(`Received autocomplete for: ${color.bold(interaction.commandName)}`)
			discordLogger.trace('Autocomplete interaction:', interaction.toJSON())
			await handleInteraction(interaction, 'autocomplete', commandKey)
		} else if (interaction.isContextMenuCommand()) {
			discordLogger.event(`Received context menu: ${color.bold(interaction.commandName)}`)
			discordLogger.trace('Context menu interaction:', interaction.toJSON())
			await handleInteraction(interaction, 'context', interaction.commandName)
		}
	})

	discordLogger.debug('Registered interaction handler')
}
