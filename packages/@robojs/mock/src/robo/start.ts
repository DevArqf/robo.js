import { execSync } from 'node:child_process'
import { getServerEngine } from '@robojs/server'
import type { StartContext, HandlerEntry, DrainHandle } from 'robo.js'
import { Manifest, getPluginOptions, logger } from 'robo.js'
import { getStageBridge } from '../core/stage-bridge.js'
import { getStageServer } from '../core/stage.js'
import { startVoiceGateway, VOICE_GATEWAY_PORT } from '../core/voice-gateway.js'
import { mockLogger } from '../core/logger.js'
import { getMockModeState } from './init.js'
import { sessionManager } from '../core/manager.js'
import { getStageUIUrl } from '../utils/server.js'
import { resolveBotUser } from '../utils/bot-user-resolver.js'
import { DEFAULT_MOCK_PLUGIN_CONFIG, type MockPluginConfig } from '../types/plugin.js'
import { registerWebSocketHandlers, areHandlersRegistered, markHandlersRegistered } from './prepare.js'
import type { Session } from '../session/session.js'
import { createSessionLogDrain } from '../session/log-drain.js'
import type { SessionLogLevel } from '../types/index.js'

/**
 * Global reference to the mock mode session.
 * Used for shutdown cleanup and summary.
 */
let mockModeSession: Session | null = null

/**
 * Global reference to the log drain handle.
 * Used for cleanup when the session ends.
 */
let mockModeLogDrainHandle: DrainHandle | null = null

/**
 * Gets the current mock mode session (if any).
 * Used by the CLI command for shutdown handling.
 */
export function getMockModeSession(): Session | null {
	return mockModeSession
}

/**
 * Clears the mock mode session reference.
 * Called during cleanup.
 */
export function clearMockModeSession(): void {
	// Clean up log drain if it exists
	if (mockModeLogDrainHandle) {
		mockModeLogDrainHandle.remove()
		mockModeLogDrainHandle = null
	}
	mockModeSession = null
}

/**
 * Lifecycle hook: Called when the Robo starts
 * Starts Voice Gateway server and creates mock mode session.
 *
 * Note: WebSocket handlers are registered in the prepare hook (prepare.ts)
 * to ensure they're ready before @robojs/discordjs tries to connect.
 */
export default async (context: StartContext<MockPluginConfig>) => {
	const { pluginConfig } = context
	const config = { ...DEFAULT_MOCK_PLUGIN_CONFIG, ...pluginConfig }

	// In standalone mode, skip all start hook logic.
	// The CLI command (robo mock start) manages server lifecycle directly.
	if (process.env.__ROBO_MOCK_STANDALONE === 'true') {
		mockLogger.debug('Standalone mode - start hook deferred to CLI command')
		return
	}

	// Check mock mode state
	const mockModeState = getMockModeState()

	// If not in mock mode at all, skip everything
	if (!mockModeState.enabled) {
		mockLogger.debug('Not in mock mode, skipping start hook')
		return
	}

	// If connecting to existing external mock server, skip local server setup.
	// The bot will connect to the external server via DISCORD_REST_API env var.
	if (mockModeState.connectingToExisting) {
		mockLogger.info(`Connecting to external mock server on port ${mockModeState.externalServerPort}`)
		// Bot connects to external server - no local infrastructure needed
		return
	}

	// WebSocket handlers should already be registered in prepare hook.
	// If not (e.g., server engine wasn't ready), register them now as fallback.
	if (!areHandlersRegistered()) {
		const engine = getServerEngine()
		if (!engine) {
			mockLogger.error('Server engine not available - @robojs/server may not be installed')
			return
		}
		mockLogger.debug('Registering WebSocket handlers in start hook (fallback)')
		registerWebSocketHandlers(engine)
		markHandlersRegistered()
	}

	// Initialize the stage bridge (connects session events to stage server)
	getStageBridge()

	// Start Voice Gateway server on separate port
	// @discordjs/voice connects to: ws://host:50001/?v=4
	try {
		await startVoiceGateway(VOICE_GATEWAY_PORT)
	} catch (error) {
		// Voice gateway is optional - log warning but don't fail startup
		mockLogger.warn(`Failed to start Voice Gateway: ${(error as Error).message}`)
	}

	mockLogger.info('Gateway WebSocket server ready')
	mockLogger.info('Stage WebSocket server ready')

	// Handle mock mode session creation
	if (mockModeState.enabled && mockModeState.sessionId) {
		mockLogger.debug('Creating mock mode session...')

		// Resolve bot user using fallback chain:
		// 1. Explicit config from defaultSessionConfig.botUser
		// 2. Fetch from Discord API using real token
		// 3. Default "MockBot"
		const resolvedBotUser = await resolveBotUser(config.defaultSessionConfig?.botUser)
		mockLogger.info(`Bot identity: ${resolvedBotUser.config.username} (${resolvedBotUser.source})`)

		// Merge resolved bot user with session config
		const sessionConfig = {
			...config.defaultSessionConfig,
			botUser: resolvedBotUser.config
		}

		// Create the session with the pre-generated ID
		mockModeSession = await sessionManager.create({
			id: mockModeState.sessionId,
			name: mockModeState.sessionName ?? undefined,
			config: sessionConfig
		})

		// Wire log drain to capture logs from the Robo process
		// This enables the Stage UI to display logs in real-time
		const sessionForDrain = mockModeSession
		const logDrain = createSessionLogDrain({
			sessionId: sessionForDrain.id,
			connectionId: 'dev-mode', // Single connection in dev mode
			botInfo: {
				userId: resolvedBotUser.config.id,
				username: resolvedBotUser.config.username
			},
			onLog: (entry) => {
				// Record to session's log recorder which forwards to Stage UI
				sessionForDrain.recordLog(entry)
			}
		})

		// Capture cutoff time before drain processes new logs
		const drainCutoff = Date.now()

		// Add drain to the main logger and store handle for cleanup
		mockModeLogDrainHandle = logger().addDrain(logDrain, `mock-session-${sessionForDrain.id}`)

		// Replay buffered historical logs (from before drain was installed)
		replayHistoricalLogs(sessionForDrain, drainCutoff, {
			id: resolvedBotUser.config.id ?? '',
			username: resolvedBotUser.config.username ?? 'MockBot'
		})

		mockLogger.debug('Log drain installed for dev mode')

		// Register commands to mock server via HTTP
		await registerCommandsToMockServer(mockModeSession)

		// Refresh Stage UI state after commands are registered
		// This ensures connected clients see the real commands, not stale seed data
		const stageServer = getStageServer()
		stageServer.refreshSessionState(mockModeSession.id)

		// Log the Stage UI URL for easy access
		const stageUrl = getStageUIUrl(mockModeSession.token)
		mockLogger.info(`Stage UI: ${stageUrl}`)

		// Open browser if flagged by CLI extension (--mock flag)
		if (mockModeState.shouldOpenBrowser) {
			// Small delay to ensure server is fully ready
			await new Promise((resolve) => setTimeout(resolve, 500))

			try {
				openBrowser(stageUrl)
				mockLogger.debug('Opened Stage UI in browser')
			} catch (error) {
				mockLogger.warn(`Could not open browser: ${(error as Error).message}`)
			}
		}
	}
}

/**
 * Opens a URL in the default browser.
 * Cross-platform implementation.
 */
function openBrowser(url: string): void {
	const platform = process.platform

	let command: string
	if (platform === 'win32') {
		command = `start "" "${url}"`
	} else if (platform === 'darwin') {
		command = `open "${url}"`
	} else {
		command = `xdg-open "${url}"`
	}

	execSync(command, { stdio: 'ignore', windowsHide: true })
}

/**
 * Register commands to the mock server via HTTP.
 * Uses the same Discord.js REST client but pointed at the mock server.
 * This ensures the mock server's REST API is properly tested.
 */
async function registerCommandsToMockServer(session: Session): Promise<void> {
	try {
		// Dynamically import @robojs/discordjs (it's optional but expected in mock mode)
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const discordjs: any = await import('@robojs/discordjs' as string).catch(() => null)
		if (!discordjs) {
			mockLogger.debug('Skipping command registration - @robojs/discordjs not installed')
			return
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { REST, Routes } = await import('discord.js') as any

		// Load command entries from manifest
		const commandEntries = await Manifest.routes('discordjs', 'commands')
		const contextEntries = await Manifest.routes('discordjs', 'context')

		if (commandEntries.length === 0 && contextEntries.length === 0) {
			mockLogger.debug('No commands to register to mock server')
			return
		}

		// Convert entries to command format
		const commands = entriesToCommands(commandEntries)
		const userContext = entriesToContext(contextEntries, 'user')
		const messageContext = entriesToContext(contextEntries, 'message')

		// Get Discord config for defaults
		const discordConfig = getPluginOptions('@robojs/discordjs') as Record<string, unknown> | undefined

		// Build command structures using @robojs/discordjs utilities
		const slashCommands = discordjs.buildSlashCommands(commands, discordConfig)
		const userContextCommands = discordjs.buildContextCommands(userContext, 'user', discordConfig)
		const messageContextCommands = discordjs.buildContextCommands(messageContext, 'message', discordConfig)

		const commandData = [
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			...slashCommands.map((cmd: any) => cmd.toJSON()),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			...userContextCommands.map((cmd: any) => cmd.toJSON()),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			...messageContextCommands.map((cmd: any) => cmd.toJSON())
		]

		if (commandData.length === 0) {
			mockLogger.debug('No commands to register')
			return
		}

		// Create REST client pointed at mock server
		const mockApiUrl = process.env.DISCORD_REST_API
		if (!mockApiUrl) {
			mockLogger.warn('DISCORD_REST_API not set - cannot register commands to mock server')
			return
		}

		const rest = new REST({ version: '10' }).setToken(session.token)

		// Override the API URL to point to mock server
		rest.options.api = mockApiUrl

		// Register commands using bulk PUT (same as Discord API)
		const clientId = session.state.applicationId
		await rest.put(Routes.applicationCommands(clientId), { body: commandData })

		mockLogger.info(`Registered ${commandData.length} commands to mock server`)
	} catch (error) {
		mockLogger.warn(`Failed to register commands to mock server: ${(error as Error).message}`)
		mockLogger.debug('Command registration error:', error)
	}
}

/**
 * Convert handler entries to command format.
 * Copied from @robojs/discordjs build/complete.ts to avoid tight coupling.
 */
function entriesToCommands(entries: HandlerEntry[]): Record<string, Record<string, unknown>> {
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
			;(commands[rootName].subcommands as Record<string, unknown>)[keyParts[1]] = entry.metadata
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
			;(subcommands[keyParts[1]].subcommands as Record<string, unknown>)[keyParts[2]] = entry.metadata
		}
	}

	return commands
}

/**
 * Convert handler entries to context menu format.
 * Copied from @robojs/discordjs build/complete.ts to avoid tight coupling.
 */
function entriesToContext(entries: HandlerEntry[], type: 'user' | 'message'): Record<string, Record<string, unknown>> {
	const contextType = type === 'user' ? 2 : 3
	const result: Record<string, Record<string, unknown>> = {}

	for (const entry of entries) {
		if ((entry.metadata as Record<string, unknown>)?.contextType === contextType) {
			result[entry.key] = entry.metadata as Record<string, unknown>
		}
	}

	return result
}

/**
 * Replays buffered historical logs to the session.
 * These are logs that occurred before the drain was installed.
 */
function replayHistoricalLogs(
	session: Session,
	cutoffTime: number,
	botUser: { id: string; username: string }
): void {
	// Get buffered logs (returns newest-first, may contain undefined slots)
	const bufferedLogs = logger().getRecentLogs(100)

	// Filter and reverse to get chronological order
	const historicalLogs = bufferedLogs
		.filter((entry) => entry && entry.timestamp.getTime() < cutoffTime)
		.reverse()

	if (historicalLogs.length === 0) {
		return
	}

	mockLogger.debug(`Replaying ${historicalLogs.length} historical logs`)

	for (const entry of historicalLogs) {
		// Build message from data array (same as log-drain.ts)
		const message = entry.data
			.map((item) => {
				if (item instanceof Error) {
					return `${item.message}${item.stack ? '\n' + item.stack : ''}`
				}
				if (typeof item === 'string') {
					return item
				}
				try {
					return JSON.stringify(item)
				} catch {
					return '[unserializable]'
				}
			})
			.join(' ')

		// Record to session (id will be assigned by LogRecorder)
		session.recordLog({
			timestamp: entry.timestamp.getTime(),
			level: entry.level as SessionLogLevel,
			message,
			source: {
				connectionId: 'dev-mode',
				sessionId: session.id,
				botUserId: botUser.id,
				botUsername: botUser.username
			}
		})
	}
}
