/**
 * Mock CLI Command
 *
 * Starts a Discord bot connected to the mock server for testing.
 * This command:
 * 1. Auto-builds the project if necessary
 * 2. Creates a mock session with good defaults
 * 3. Starts the bot connected to the mock server
 * 4. Opens Stage UI in browser (unless --no-browser)
 * 5. Prints session summary on shutdown
 */
import path from 'node:path'
import { execSync } from 'node:child_process'
import { createCliCommandConfig, color, Env, getPluginOptions, setHookPriority } from 'robo.js'
import { generateSessionId, createMockToken } from '../../../utils/id.js'
import { getMockRestApiUrl, getStageUIUrl, getServerPort } from '../../../utils/server.js'
import { printSessionSummary } from '../../../core/summary.js'
import { persistSession, cleanupOldSessions } from '../../../core/persistence.js'
import { getMockModeSession, clearMockModeSession } from '../../start.js'
import { resetMockModeState } from '../../init.js'
import { DEFAULT_MOCK_PLUGIN_CONFIG, type MockPluginConfig } from '../../../types/plugin.js'
import type { CliContext } from 'robo.js'

export const config = createCliCommandConfig({
	description: 'Start bot with mock Discord server for testing',
	options: [
		{
			alias: '-m',
			name: '--mode',
			description: 'Mode to run in (dev, prod, etc.)',
			type: 'string'
		},
		{
			alias: '-s',
			name: '--silent',
			description: 'Suppress output',
			type: 'boolean',
			default: false
		},
		{
			alias: '-v',
			name: '--verbose',
			description: 'Verbose debug output',
			type: 'boolean',
			default: false
		},
		{
			name: '--no-browser',
			description: 'Skip opening Stage UI in browser',
			type: 'boolean',
			default: false
		}
	]
} as const)

export default async function mockCommand({ options, logger }: CliContext<typeof config>) {
	const { mode, silent, verbose } = options
	const noBrowser = options['no-browser']

	// Configure logger
	if (verbose) {
		logger.setup({ level: 'debug' })
	}

	// Set NODE_ENV if not already set
	if (!process.env.NODE_ENV) {
		process.env.NODE_ENV = 'development'
	}

	// Load environment variables with mode support
	const envMode = mode ?? process.env.NODE_ENV
	await Env.load({ mode: envMode })

	// Get project name for session naming
	const projectName = path.basename(process.cwd())

	if (!silent) {
		logger.log('')
		logger.log(color.bold(`  Starting ${color.cyan(projectName)} in mock mode`))
		logger.log('')
	}

	// Always rebuild to ensure manifest is fresh (like robo dev)
	// This prevents stale manifest issues where project routes are missing
	if (!silent) {
		logger.info('Building project...')
	}

	try {
		const { Robo } = await import('robo.js')
		await Robo.build({
			dev: envMode !== 'production',
			verbose
		})
	} catch (error) {
		logger.error('Build failed:', error)
		process.exit(1)
	}

	// Generate session ID and token
	const sessionId = generateSessionId()
	const sessionToken = createMockToken(sessionId)
	const sessionName = `${projectName}-mock`

	// Set environment variables for mock mode
	process.env.ROBO_MOCK_MODE = 'true'
	process.env.ROBO_MOCK_SESSION_ID = sessionId
	process.env.ROBO_MOCK_SESSION_NAME = sessionName
	process.env.DISCORD_TOKEN = sessionToken

	// Set REST API URL to point to mock server
	const port = getServerPort()
	process.env.DISCORD_REST_API = `http://localhost:${port}/api`

	if (verbose) {
		logger.debug('Mock mode environment:')
		logger.debug(`  ROBO_MOCK_MODE: true`)
		logger.debug(`  ROBO_MOCK_SESSION_ID: ${sessionId}`)
		logger.debug(`  ROBO_MOCK_SESSION_NAME: ${sessionName}`)
		logger.debug(`  DISCORD_TOKEN: ${sessionToken}`)
		logger.debug(`  DISCORD_REST_API: ${process.env.DISCORD_REST_API}`)
	}

	// Get plugin config for auto-open setting
	const pluginConfig = (getPluginOptions('@robojs/mock') as MockPluginConfig) ?? {}
	const config = { ...DEFAULT_MOCK_PLUGIN_CONFIG, ...pluginConfig }
	const shouldOpenBrowser = !noBrowser && config.autoOpenStage

	// Track if we're shutting down
	let isShuttingDown = false

	// Setup shutdown handler
	const shutdown = async (signal: string) => {
		if (isShuttingDown) {
			return
		}
		isShuttingDown = true

		if (!silent) {
			logger.log('')
			logger.info(`Received ${signal}, shutting down...`)
		}

		// Get the session before stopping
		const session = getMockModeSession()

		// Stop Robo
		try {
			const { Robo } = await import('robo.js')
			await Robo.stop(0, 'signal')
		} catch (error) {
			logger.debug('Error stopping Robo:', error)
		}

		// Print summary and persist session
		if (session) {
			if (!silent) {
				printSessionSummary(session)
			}

			// Persist session to .robo/mock folder
			try {
				const filePath = await persistSession(session, config.dataDirectory)
				if (verbose) {
					logger.debug(`Session persisted to: ${filePath}`)
				}

				// Cleanup old sessions (keep last 10)
				await cleanupOldSessions(10, config.dataDirectory)
			} catch (error) {
				logger.debug('Error persisting session:', error)
			}
		}

		// Cleanup
		clearMockModeSession()
		resetMockModeState()

		process.exit(0)
	}

	process.on('SIGINT', () => shutdown('SIGINT'))
	process.on('SIGTERM', () => shutdown('SIGTERM'))

	// Start Robo
	if (!silent) {
		logger.info('Starting mock server and bot...')
	}

	// Ensure server starts BEFORE discordjs so WebSocket handlers are ready
	// when the Discord client tries to connect to the mock gateway.
	// Server at priority 50 runs before discordjs at default priority 100.
	setHookPriority('start', '@robojs/server', 50)

	try {
		const { Robo } = await import('robo.js')
		await Robo.start({
			logLevel: verbose ? 'debug' : silent ? 'error' : 'info'
		})
	} catch (error) {
		logger.error('Failed to start:', error)
		process.exit(1)
	}

	// Open Stage UI in browser
	if (shouldOpenBrowser) {
		const stageUrl = getStageUIUrl(sessionToken)

		// Small delay to ensure server is fully ready
		await new Promise((resolve) => setTimeout(resolve, 500))

		try {
			openBrowser(stageUrl)
			if (verbose) {
				logger.debug(`Opened Stage UI: ${stageUrl}`)
			}
		} catch (error) {
			logger.warn(`Could not open browser: ${(error as Error).message}`)
			logger.info(`Stage UI: ${stageUrl}`)
		}
	}

	if (!silent) {
		logger.log('')
		logger.info('Mock server running. Press Ctrl+C to stop.')
		logger.log('')
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
