/**
 * Start Hook - Server Initialization
 *
 * This hook runs during Robo.start() to:
 * 1. Initialize the HTTP server engine (Fastify or Node.js)
 * 2. Set up Vite dev server if available
 * 3. Register all API routes
 * 4. Start the server
 * 5. Optionally start a tunnel for external access
 */
import { logger } from '../core/logger.js'
import { initPluginRoutes, type PluginPrefixMap } from '../core/plugin-routes.js'
import { hasDependency } from '../core/runtime-utils.js'
import { setConfig, setEngine } from '../core/server.js'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { color, portal } from 'robo.js'
import { Nanocore } from 'robo.js/unstable.js'
import type { BaseEngine } from '../engines/base.js'
import type { StartContext, HandlerRecord } from 'robo.js'
import type { ViteDevServer } from 'vite'
import type { TunnelConfig, TunnelInstance, TunnelProvider } from '../core/tunnel/types.js'
import type { ApiHandler, ApiHandlerModule, HttpMethodExport } from './routes/api.js'
import { HTTP_METHODS } from './routes/api.js'
import type { RoboReply, RouteHandler } from '../core/types.js'
import type { RoboRequest } from '../core/robo-request.js'

const PATH_REGEX = new RegExp(/\[(.+?)\]/g)

/**
 * Plugin configuration options.
 */
export interface PluginConfig {
	cors?: boolean
	engine?: BaseEngine
	hostname?: string
	/**
	 * Plugin URL prefixes - centralized configuration for plugin route prefixing.
	 *
	 * Example:
	 * ```typescript
	 * pluginPrefixes: {
	 *   '@robojs/mock': '/mock',  // Both API and static under /mock/*
	 *   // OR granular:
	 *   '@robojs/mock': { api: '/mock-api', static: '/mock-static' }
	 * }
	 * ```
	 */
	pluginPrefixes?: PluginPrefixMap
	port?: number
	prefix?: string | null | false
	vite?: ViteDevServer
	tunnel?: TunnelConfig
}

export let pluginOptions: PluginConfig = {}

/**
 * Creates a method dispatcher that routes requests to the appropriate handler
 * based on HTTP method. Supports both named method exports and default fallback.
 */
function createMethodDispatcher(record: HandlerRecord<ApiHandler>): RouteHandler | null {
	const handler = record.handler as ApiHandlerModule | null
	if (!handler) return null

	const hasDefault = typeof handler.default === 'function'
	const methodExports = HTTP_METHODS.filter((m) => typeof handler[m] === 'function')

	// Optimization: if only default export, return it directly (current behavior)
	if (hasDefault && methodExports.length === 0) {
		return handler.default as RouteHandler
	}

	// Compute allowed methods for OPTIONS/405 responses
	const getAllowedMethods = () => {
		const allowed = [...methodExports]
		if (hasDefault) {
			// Default handles all methods not explicitly exported
			for (const m of HTTP_METHODS) {
				if (!allowed.includes(m)) {
					allowed.push(m)
				}
			}
		}
		return allowed
	}

	// Create dispatcher for method-based routing
	return async (req: RoboRequest, reply: RoboReply): Promise<unknown> => {
		const method = req.method.toUpperCase() as HttpMethodExport

		// Auto-handle OPTIONS if no explicit handler
		if (method === 'OPTIONS' && !handler.OPTIONS && !hasDefault) {
			const allowed = getAllowedMethods()
			reply.header('Allow', allowed.join(', '))
			return reply.code(204).send('')
		}

		// Try named method handler first
		const methodHandler = handler[method] as RouteHandler | undefined
		if (methodHandler) {
			return methodHandler(req, reply)
		}

		// HEAD auto-handling: use GET if no HEAD handler
		if (method === 'HEAD' && handler.GET) {
			return (handler.GET as RouteHandler)(req, reply)
		}

		// Fall back to default handler
		if (hasDefault) {
			return (handler.default as RouteHandler)(req, reply)
		}

		// No handler for this method - return 405
		reply.header('Allow', methodExports.join(', '))
		return reply.code(405).json({
			error: 'Method Not Allowed',
			message: `${method} is not supported for this endpoint`,
			allowedMethods: methodExports
		})
	}
}

/**
 * Start hook - Initializes the HTTP server and optionally starts a tunnel
 */
export default async (context: StartContext<PluginConfig>) => {
	const { pluginConfig } = context
	pluginOptions = pluginConfig ?? {}
	globalThis.roboServer = {}

	// Set default options
	if (pluginOptions.prefix === undefined) {
		pluginOptions.prefix = '/api'
	}
	if (!pluginOptions.engine) {
		pluginOptions.engine = await getDefaultEngine()
	}

	// Assign config instance for `Server.config()`
	setConfig(pluginOptions)

	// Assign engine instance for `Server.getEngine()`
	setEngine(pluginOptions.engine)

	// Initialize plugin route registry for prefix stripping and static asset serving
	const registry = initPluginRoutes(pluginOptions.pluginPrefixes)
	if (pluginOptions.pluginPrefixes) {
		const pluginCount = Object.keys(pluginOptions.pluginPrefixes).length
		logger.debug(`Initialized plugin route registry with ${pluginCount} plugin prefix(es)`)
	}

	// Start HTTP server only if API Routes are defined
	const { engine, hostname = process.env.ROBO_HOSTNAME, port = parseInt(process.env.PORT ?? '3000') } = pluginOptions
	let vite: ViteDevServer | undefined = pluginOptions.vite
	globalThis.roboServer.engine = engine

	// Load API routes from the portal
	await portal.ensureRoute('server', 'api')
	const apiRoutes = portal.getByType('server:api') as Record<string, HandlerRecord<ApiHandler>>
	const apiRouteCount = Object.keys(apiRoutes).length

	logger.debug(`Preparing server with ${apiRouteCount} API routes...`)
	await engine.init({ vite })

	// If Vite is available, start the dev server
	if (vite) {
		logger.debug('Using Vite server specified in options.')
	} else if (process.env.NODE_ENV !== 'production' && (await hasDependency('vite', true))) {
		try {
			const { createServer: createViteServer } = await import('vite')
			const viteConfigPathTs = path.join(process.cwd(), 'config', 'vite.ts')
			const viteConfigPath = path.join(process.cwd(), 'config', 'vite.mjs')

			vite = await createViteServer({
				configFile: existsSync(viteConfigPathTs) ? viteConfigPathTs : existsSync(viteConfigPath) ? viteConfigPath : undefined,
				server: {
					hmr: {
						path: '/hmr',
						server: engine.getHttpServer()
					},
					middlewareMode: { server: engine.getHttpServer() }
				}
			})
			logger.debug('Vite server created successfully.')
		} catch (e) {
			logger.error(`Failed to start Vite server:`, e)
		}
	}

	// Setup Vite if available and register socket bypass
	if (vite) {
		await engine.setupVite(vite)

		// Prevent other plugins from registering the HMR route
		engine.registerWebsocket('/hmr', () => {
			logger.debug('Vite HMR connection detected. Skipping registration...')
		})
	}

	// Add loaded API modules onto new router instance
	const prefix = pluginOptions.prefix ?? ''
	const paths: string[] = []

	// Import all API handlers and register with the engine
	for (const [routeKey, record] of Object.entries(apiRoutes)) {
		// Import the handler if not already imported
		await portal.importHandler('server', 'api', routeKey)

		const key = prefix + '/' + routeKey.replace(PATH_REGEX, ':$1')
		paths.push(key)

		// Use method dispatcher to handle named HTTP method exports
		const wrappedHandler = createMethodDispatcher(record)
		if (wrappedHandler) {
			engine.registerRoute(key, wrappedHandler)
		}
	}

	logger.debug(`Starting server...`)
	await engine.start({ hostname, port })

	// Let the rest of the app know that the server is ready
	globalThis.roboServer.ready = true
	const localUrl = `http://${hostname ?? 'localhost'}:${port}`
	Nanocore.update('watch', { localUrl })

	// Start tunnel if enabled via CLI flag or plugin config
	const tunnelEnabled = process.env.__ROBO_TUNNEL_ENABLED === 'true' || pluginOptions.tunnel?.enabled

	if (tunnelEnabled) {
		await startTunnel(port, pluginOptions.tunnel)
	}
}

/**
 * Start the tunnel using the configured provider
 */
async function startTunnel(port: number, config?: TunnelConfig): Promise<void> {
	try {
		let provider: TunnelProvider

		// Get provider from config or default to Cloudflare
		if (config?.provider && typeof config.provider !== 'string') {
			provider = config.provider
		} else {
			const { CloudflareProvider } = await import('../core/tunnel/index.js')
			provider = new CloudflareProvider()
		}

		const tunnelUrl = `http://localhost:${port}`

		logger.event('Starting tunnel...')
		const instance: TunnelInstance = await provider.start(tunnelUrl, {
			domain: config?.cloudflare?.domain ?? process.env.CLOUDFLARE_DOMAIN,
			apiKey: config?.cloudflare?.apiKey ?? process.env.CLOUDFLARE_API_KEY,
			zoneId: config?.cloudflare?.zoneId ?? process.env.CLOUDFLARE_ZONE_ID,
			accountId: config?.cloudflare?.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID,
			tunnelId: process.env.CLOUDFLARE_TUNNEL_ID,
			tunnelToken: process.env.CLOUDFLARE_TUNNEL_TOKEN
		})

		// Store for cleanup in stop hook
		globalThis.roboServer.tunnelInstance = instance
		globalThis.roboServer.tunnelProvider = provider
	} catch (error) {
		logger.error('Failed to start tunnel:', error)
	}
}

/**
 * Get the default server engine based on available dependencies
 */
async function getDefaultEngine(): Promise<BaseEngine> {
	// Return Fastify if available
	const isFastifyAvailable = await hasDependency('fastify')
	if (isFastifyAvailable) {
		logger.debug(color.bold('Fastify'), 'is available. Using it as the server engine.')
		const { FastifyEngine } = await import('../engines/fastify.js')
		return new FastifyEngine()
	}

	// Default engine
	logger.debug('Using', color.bold('Node.js'), 'as the server engine.')
	const { NodeEngine } = await import('../engines/node.js')
	return new NodeEngine()
}
