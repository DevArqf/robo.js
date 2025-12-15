/**
 * Mock CLI Command - Standalone Server Mode
 *
 * Starts a standalone mock Discord server for testing bots.
 * Bots connect via `robo dev --mock-session <id>`.
 *
 * This command:
 * 1. Starts HTTP server on dedicated port (default: 6625)
 * 2. Registers Gateway and Stage WebSocket handlers
 * 3. Loads all Discord API routes from @robojs/mock via Portal API
 * 4. Opens Stage UI showing waiting for connections
 * 5. Writes server info for port discovery
 *
 * Unlike `robo dev --mock`, this does NOT:
 * - Build or start a bot
 * - Create sessions automatically (sessions created when bots connect)
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCliCommandConfig, color, Env, Manifest, portal } from 'robo.js'
import { writeServerInfo, deleteServerInfo, STANDALONE_MOCK_PORT } from '../../../utils/server-info.js'
import { mockLogger } from '../../../core/logger.js'
import { getGatewayServer } from '../../../core/gateway.js'
import { getStageServer } from '../../../core/stage.js'
import { getStageBridge } from '../../../core/stage-bridge.js'
import { startVoiceGateway, VOICE_GATEWAY_PORT } from '../../../core/voice-gateway.js'
import { sessionManager } from '../../../core/manager.js'
import type { CliContext, HandlerRecord } from 'robo.js'
import type { CreateSessionOptions, SessionConfig } from '../../../types/index.js'

// Dynamic imports for @robojs/server
type BaseEngine = import('@robojs/server/engines').BaseEngine
type RouteHandler = import('@robojs/server').RouteHandler

const PATH_REGEX = /\[(.+?)\]/g

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

	// Load environment variables with mode support
	const envMode = mode ?? process.env.NODE_ENV
	await Env.load({ mode: envMode })

	if (!silent) {
		logger.log('')
		logger.log(color.bold(`  Starting standalone mock server`))
		logger.log('')
	}

	// Initialize mock infrastructure
	const gatewayServer = getGatewayServer()
	const stageServer = getStageServer()
	getStageBridge()

	// Start Voice Gateway on separate port
	try {
		await startVoiceGateway(VOICE_GATEWAY_PORT)
		mockLogger.debug(`Voice Gateway started on port ${VOICE_GATEWAY_PORT}`)
	} catch (error) {
		mockLogger.warn(`Failed to start Voice Gateway: ${(error as Error).message}`)
	}

	// Create server engine from @robojs/server
	let engine: BaseEngine
	try {
		const { NodeEngine } = await import('@robojs/server/engines')
		engine = new NodeEngine()
		await engine.init({})
		mockLogger.debug('Server engine initialized')
	} catch (error) {
		logger.error(`Failed to initialize server engine: ${(error as Error).message}`)
		logger.error('Make sure @robojs/server is installed')
		process.exit(1)
	}

	// Register WebSocket handlers with the engine
	engine.registerWebsocket('/', (req, socket, head) => {
		gatewayServer.handleUpgrade(req, socket, head)
	})
	engine.registerWebsocket('/stage/ws', (req, socket, head) => {
		stageServer.handleUpgrade(req, socket, head)
	})
	engine.registerWebsocket('/mock/stage/ws', (req, socket, head) => {
		stageServer.handleUpgrade(req, socket, head)
	})

	// Register control API routes (session management)
	registerControlRoutes(engine)

	// Register static Stage UI routes
	registerStageRoutes(engine)

	// Initialize manifest for portal access (required before ensureRoute)
	const manifestMode = envMode === 'production' ? 'production' : 'development'
	await Manifest.initialize(manifestMode)

	// Load and register Discord API routes from portal
	await loadApiRoutes(engine)

	// Start server
	await engine.start({ port })

	// Write server info for port discovery
	await writeServerInfo({
		port,
		startedAt: new Date().toISOString(),
		pid: process.pid,
		gatewayUrl: `ws://localhost:${port}/?v=10&encoding=json`,
		restApiUrl: `http://localhost:${port}/api`
	})

	if (!silent) {
		logger.info(`Mock server running on port ${color.cyan(String(port))}`)
		logger.log('')
		logger.info('To connect a bot:')
		logger.log(`  ${color.dim('1.')} Create a session: ${color.cyan(`curl -X POST http://localhost:${port}/api/control/sessions`)}`)
		logger.log(`  ${color.dim('2.')} Start bot with:   ${color.cyan(`robo dev --mock-session <session_id>`)}`)
		logger.log('')
	}

	// Open Stage UI
	const shouldOpenBrowser = !noBrowser
	if (shouldOpenBrowser) {
		const stageUrl = `http://localhost:${port}/stage/`
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

	// Setup shutdown handlers
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
 * Register control API routes for session management
 */
function registerControlRoutes(engine: BaseEngine): void {
	// Gateway bot endpoint
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
 * Register Stage UI static file routes
 */
function registerStageRoutes(engine: BaseEngine): void {
	const stageDir = getStageUIDir()
	if (!stageDir) {
		mockLogger.warn('Stage UI directory not found')
		return
	}

	// Redirect /stage to /stage/
	engine.registerRoute('/stage', async () => {
		return new Response(null, {
			status: 302,
			headers: { Location: '/stage/' }
		})
	})

	// Serve index.html for /stage/
	engine.registerRoute('/stage/', async () => {
		const indexPath = path.join(stageDir, 'index.html')
		if (!fs.existsSync(indexPath)) {
			return new Response(JSON.stringify({ error: 'Stage UI not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			})
		}
		const content = fs.readFileSync(indexPath)
		return new Response(content, {
			status: 200,
			headers: { 'Content-Type': 'text/html' }
		})
	})

	// Serve static files from /stage/*
	engine.registerRoute('/stage/**:path', async (req) => {
		const reqPath = (req.params.path as string) || 'index.html'
		const fullPath = path.join(stageDir, reqPath)

		if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
			return new Response(JSON.stringify({ error: 'Not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			})
		}

		const ext = path.extname(fullPath)
		const contentType = getContentType(ext)
		const content = fs.readFileSync(fullPath)

		return new Response(content, {
			status: 200,
			headers: { 'Content-Type': contentType }
		})
	})
}

/**
 * Load and register Discord API routes from the portal
 */
async function loadApiRoutes(engine: BaseEngine): Promise<void> {
	try {
		// Load API routes from portal (this also loads the manifest)
		await portal.ensureRoute('server', 'api')
		const apiRoutes = portal.getByType('server:api') as Record<string, HandlerRecord>

		const routeCount = Object.keys(apiRoutes).length
		if (routeCount === 0) {
			mockLogger.debug('No API routes found in portal')
			return
		}

		mockLogger.debug(`Loading ${routeCount} API routes from portal...`)

		// Register each API route with the engine
		for (const [routeKey, record] of Object.entries(apiRoutes)) {
			// Only load routes from @robojs/mock plugin
			if (record.plugin?.name !== '@robojs/mock') {
				continue
			}

			// Import the handler
			await portal.importHandler('server', 'api', routeKey)

			// Convert route key to URL path (e.g., "v10/channels/[id]/messages" -> "/api/v10/channels/:id/messages")
			const urlPath = '/api/' + routeKey.replace(PATH_REGEX, ':$1')

			// Get the handler function
			const handler = record.handler as { default?: RouteHandler } | RouteHandler | null
			if (!handler) continue

			const routeHandler = typeof handler === 'function' ? handler : handler.default
			if (!routeHandler) continue

			// Register the route
			engine.registerRoute(urlPath, routeHandler as RouteHandler)
			mockLogger.debug(`Registered route: ${urlPath}`)
		}

		mockLogger.debug('API routes loaded successfully')
	} catch (error) {
		mockLogger.warn(`Failed to load API routes from portal: ${(error as Error).message}`)
		mockLogger.debug('Standalone mode may have limited API support')
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
 * Get the Stage UI static files directory.
 * Looks for the built Stage UI in the plugin's public folder.
 */
function getStageUIDir(): string | null {
	// Get current file's directory (ESM-compatible)
	const currentDir = path.dirname(fileURLToPath(import.meta.url))

	// Try to find Stage UI in the plugin's package
	const possiblePaths = [
		// When running from source (src/robo/cli/commands/mock.ts -> public/stage)
		path.join(currentDir, '../../../../public/stage'),
		// When running from built .robo/build/robo/cli/commands -> public/stage (5 levels up)
		path.join(currentDir, '../../../../../public/stage'),
		// When installed as package in node_modules
		path.resolve(process.cwd(), 'node_modules/@robojs/mock/public/stage')
	]

	mockLogger.debug(`Looking for Stage UI, current dir: ${currentDir}`)
	for (const p of possiblePaths) {
		mockLogger.debug(`Trying: ${p} - exists: ${fs.existsSync(p)}`)
		if (fs.existsSync(p)) {
			return p
		}
	}

	return null
}

/**
 * Get content type for file extension.
 */
function getContentType(ext: string): string {
	const types: Record<string, string> = {
		'.html': 'text/html',
		'.css': 'text/css',
		'.js': 'application/javascript',
		'.json': 'application/json',
		'.png': 'image/png',
		'.jpg': 'image/jpeg',
		'.svg': 'image/svg+xml',
		'.ico': 'image/x-icon'
	}
	return types[ext] ?? 'application/octet-stream'
}
