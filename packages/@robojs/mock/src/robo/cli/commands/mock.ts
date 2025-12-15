/**
 * Mock CLI Command - Standalone Server Mode
 *
 * Starts a standalone mock Discord server for testing bots.
 * Bots connect via `robo dev --mock-session <id>`.
 *
 * This command uses Robo's hook system:
 * 1. executePrepareHooks() - @robojs/server creates engine, @robojs/mock registers WS handlers
 * 2. executeStartHooks() - @robojs/server loads API routes and starts server
 *
 * The only manual registration is control routes (session management API)
 * which are standalone-specific and not part of the plugin's normal routes.
 *
 * Unlike `robo dev --mock`, this does NOT:
 * - Build or start a bot
 * - Create sessions automatically (sessions created when bots connect)
 */
import { execSync } from 'node:child_process'
import { createCliCommandConfig, color, Env, Manifest } from 'robo.js'
import { loadConfig, populatePortal, executePrepareHooks, executeStartHooks, loadPluginData } from 'robo.js/unstable.js'
import { writeServerInfo, deleteServerInfo, STANDALONE_MOCK_PORT } from '../../../utils/server-info.js'
import { mockLogger } from '../../../core/logger.js'
import { getGatewayServer } from '../../../core/gateway.js'
import { getStageServer } from '../../../core/stage.js'
import { getStageBridge } from '../../../core/stage-bridge.js'
import { startVoiceGateway, VOICE_GATEWAY_PORT } from '../../../core/voice-gateway.js'
import { sessionManager } from '../../../core/manager.js'
import { getMockPluginPrefix } from '../../../utils/server.js'
import type { CliContext } from 'robo.js'
import type { CreateSessionOptions, SessionConfig } from '../../../types/index.js'

// Dynamic imports for @robojs/server
type BaseEngine = import('@robojs/server/engines').BaseEngine

export const config = createCliCommandConfig({
	description: 'Start standalone mock Discord server for testing',
	options: [
		{
			alias: '-p',
			name: '--port',
			description: 'Port to run the mock server on',
			type: 'number'
		},
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
			alias: '-n',
			name: '--no-browser',
			description: 'Skip opening Stage UI in browser',
			type: 'boolean',
			default: false
		}
	]
} as const)

export default async function mockCommand({ options, logger }: CliContext) {
	const { mode, silent, verbose } = options as {
		port?: number
		mode?: string
		silent?: boolean
		verbose?: boolean
		'no-browser'?: boolean
	}
	const port = (options.port as number | undefined) ?? STANDALONE_MOCK_PORT
	const noBrowser = options['no-browser'] as boolean | undefined

	// Configure logger
	if (verbose) {
		mockLogger.setup({ level: 'debug' })
	}

	// Set NODE_ENV if not already set
	if (!process.env.NODE_ENV) {
		process.env.NODE_ENV = 'development'
	}

	// Set environment variables for standalone mode
	// These are read by prepare.ts and start.ts hooks
	process.env.PORT = String(port)
	process.env.ROBO_MOCK_MODE = 'true'
	process.env.__ROBO_MOCK_STANDALONE = 'true'

	// Load environment variables with mode support
	const envMode = mode ?? process.env.NODE_ENV
	await Env.load({ mode: envMode })

	if (!silent) {
		logger.log('')
		logger.log(color.bold(`  Starting standalone mock server`))
		logger.log('')
	}

	// 1. Load config (required for loadPluginData)
	await loadConfig()

	// 2. Get plugin data from config
	const plugins = loadPluginData()
	mockLogger.debug(`Loaded ${plugins.size} plugin(s) from config`)

	// 3. Initialize manifest for portal access
	const manifestMode = envMode === 'production' ? 'production' : 'development'
	await Manifest.initialize(manifestMode)

	// 4. Populate portal (loads commands, events, API routes from manifest)
	await populatePortal(manifestMode)
	mockLogger.debug('Portal populated')

	// 5. Initialize mock infrastructure BEFORE hooks run
	// This ensures gateway/stage servers exist when prepare hook registers WS handlers
	getGatewayServer()
	getStageServer()
	getStageBridge()

	// Start Voice Gateway on separate port
	try {
		await startVoiceGateway(VOICE_GATEWAY_PORT)
		mockLogger.debug(`Voice Gateway started on port ${VOICE_GATEWAY_PORT}`)
	} catch (error) {
		mockLogger.warn(`Failed to start Voice Gateway: ${(error as Error).message}`)
	}

	// 6. Execute prepare hooks
	// - @robojs/server's prepare: creates engine, sets globalThis.roboServer.engine
	// - @robojs/mock's prepare: registers WebSocket handlers via callback
	mockLogger.debug('Executing prepare hooks...')
	await executePrepareHooks(plugins, manifestMode)

	// 6b. Register mock plugin prefix in the route registry
	// The manifest may not have this info in standalone mode (no build required),
	// so we register it manually to ensure Stage UI static files are served correctly
	try {
		const { getPluginRouteRegistry } = await import('@robojs/server')
		const registry = getPluginRouteRegistry()
		const prefix = getMockPluginPrefix()
		registry.register({ '@robojs/mock': prefix })
		mockLogger.debug(`Registered mock plugin prefix: ${prefix}`)
	} catch (error) {
		mockLogger.warn(`Could not register plugin prefix: ${(error as Error).message}`)
	}

	// 7. Get engine from @robojs/server
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const engine = (globalThis as any).roboServer?.engine as BaseEngine | undefined
	if (!engine) {
		logger.error('Failed to initialize server engine - @robojs/server prepare hook may have failed')
		logger.error('Make sure @robojs/server is installed and configured')
		process.exit(1)
	}

	// 8. Register control API routes BEFORE start hooks
	// These must be registered before @robojs/server's start hook which calls engine.start()
	// They're at non-prefixed paths because Discord.js clients expect /api/v10/gateway/bot
	registerControlRoutes(engine)

	// 9. Execute start hooks
	// - @robojs/server's start: loads API routes from portal (with /mock prefix), starts server
	// - @robojs/mock's start: skipped in standalone mode (via __ROBO_MOCK_STANDALONE check)
	mockLogger.debug('Executing start hooks...')
	await executeStartHooks(plugins, manifestMode)

	// 9. Write server info for port discovery by --mock-session
	await writeServerInfo({
		port,
		startedAt: new Date().toISOString(),
		pid: process.pid,
		gatewayUrl: `ws://localhost:${port}/?v=10&encoding=json`,
		restApiUrl: `http://localhost:${port}/api`
	})

	// Get plugin prefix for Stage UI URL
	const pluginPrefix = getMockPluginPrefix()
	const stageUrl = pluginPrefix ? `http://localhost:${port}${pluginPrefix}/stage/` : `http://localhost:${port}/stage/`

	if (!silent) {
		logger.info(`Mock server running on port ${color.cyan(String(port))}`)
		logger.log('')
		logger.info('To connect a bot:')
		logger.log(`  ${color.dim('1.')} Create a session: ${color.cyan(`curl -X POST http://localhost:${port}/api/control/sessions`)}`)
		logger.log(`  ${color.dim('2.')} Start bot with:   ${color.cyan(`robo dev --mock-session <session_id>`)}`)
		logger.log('')
	}

	// 10. Open Stage UI
	const shouldOpenBrowser = !noBrowser
	if (shouldOpenBrowser) {
		await new Promise((r) => setTimeout(r, 500))

		try {
			openBrowser(stageUrl)
			if (!silent) {
				logger.info(`Stage UI: ${color.cyan(stageUrl)}`)
			}
		} catch (error) {
			if (!silent) {
				logger.warn(`Could not open browser: ${(error as Error).message}`)
				logger.info(`Stage UI: ${stageUrl}`)
			}
		}
	}

	// 11. Setup shutdown handlers
	const shutdown = async (signal: string) => {
		if (!silent) {
			logger.log('')
			logger.info(`Received ${signal}, shutting down...`)
		}

		// Clean up
		await deleteServerInfo()
		await engine.stop()
		process.exit(0)
	}

	process.on('SIGINT', () => shutdown('SIGINT'))
	process.on('SIGTERM', () => shutdown('SIGTERM'))

	// Keep process alive
	await new Promise(() => {})
}

/**
 * Register control API routes for session management.
 * These are standalone-specific and not part of the plugin's normal routes.
 */
function registerControlRoutes(engine: BaseEngine): void {
	// Gateway bot endpoint - returns WebSocket URL for Discord.js client
	engine.registerRoute('/api/gateway/bot', async (req) => {
		const host = req.headers.get('host') || `localhost:${STANDALONE_MOCK_PORT}`
		const protocol = host.includes('localhost') || host.startsWith('127.') ? 'ws' : 'wss'
		return {
			url: `${protocol}://${host}`,
			shards: 1,
			session_start_limit: { total: 1000, remaining: 1000, reset_after: 0, max_concurrency: 1 }
		}
	})
	engine.registerRoute('/api/v10/gateway/bot', async (req) => {
		const host = req.headers.get('host') || `localhost:${STANDALONE_MOCK_PORT}`
		const protocol = host.includes('localhost') || host.startsWith('127.') ? 'ws' : 'wss'
		return {
			url: `${protocol}://${host}`,
			shards: 1,
			session_start_limit: { total: 1000, remaining: 1000, reset_after: 0, max_concurrency: 1 }
		}
	})

	// Session management endpoints
	engine.registerRoute('/api/control/sessions', async (req) => {
		if (req.method === 'GET') {
			const sessions = sessionManager.getAll()
			return {
				sessions: sessions.map((s) => ({
					session_id: s.id,
					token: s.token,
					name: s.name,
					created_at: s.createdAt,
					expires_at: s.expiresAt,
					connections: s.connections.size
				}))
			}
		}

		if (req.method === 'POST') {
			let body: { name?: string; ttl?: number; config?: SessionConfig } = {}
			try {
				body = await req.json()
			} catch {
				// Empty body is fine
			}

			const sessionOptions: CreateSessionOptions = {
				name: body.name,
				ttl: body.ttl,
				config: body.config
			}

			const session = await sessionManager.create(sessionOptions)
			return {
				session_id: session.id,
				token: session.token,
				expires_at: session.expiresAt
			}
		}

		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { 'Content-Type': 'application/json' }
		})
	})

	engine.registerRoute('/api/control/sessions/:id', async (req) => {
		const sessionId = req.params.id as string
		const session = sessionManager.get(sessionId)

		if (!session) {
			return new Response(JSON.stringify({ error: 'Session not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			})
		}

		return {
			session_id: session.id,
			token: session.token,
			name: session.name,
			created_at: session.createdAt,
			expires_at: session.expiresAt,
			connections: session.connections.size
		}
	})
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
