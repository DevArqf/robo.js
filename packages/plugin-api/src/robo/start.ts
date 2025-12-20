/**
 * Start Hook - Server Initialization
 *
 * This hook runs during Robo.start() to:
 * 1. Register all API routes
 * 2. Start the server
 * 3. Optionally start a tunnel for external access
 *
 * Note: The server engine, router, and Vite are initialized in the prepare hook
 * (prepare.ts) so they're available to other plugins during their start hooks.
 */
import { logger } from '../core/logger.js'
import { getPluginRouteRegistry } from '../core/plugin-routes.js'
import { findAvailablePort, DEFAULT_MAX_PORT_ATTEMPTS } from '../core/port-utils.js'
import { Mode, portal } from 'robo.js'
import { Nanocore } from 'robo.js/unstable.js'
import type { StartContext, HandlerRecord } from 'robo.js'
import type { TunnelConfig, TunnelInstance, TunnelProvider } from '../core/tunnel/types.js'
import type { ApiHandler, ApiHandlerModule, HttpMethodExport } from './routes/api.js'
import { HTTP_METHODS } from './routes/api.js'
import type { RoboReply, RouteHandler } from '../core/types.js'
import type { RoboRequest } from '../core/robo-request.js'
import { pluginOptions, type PluginConfig } from './prepare.js'

const PATH_REGEX = new RegExp(/\[(.+?)\]/g)

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
 * Start hook - Registers API routes, starts the HTTP server, and optionally starts a tunnel
 *
 * Note: Engine, router, and Vite are initialized in prepare.ts
 */
export default async (_context: StartContext<PluginConfig>) => {
	// Get registry initialized in prepare hook
	const registry = getPluginRouteRegistry()

	// Get engine and options from prepare hook
	const {
		engine,
		hostname = process.env.ROBO_HOSTNAME,
		port: configuredPort = parseInt(process.env.PORT ?? '3000'),
		maxPortAttempts = DEFAULT_MAX_PORT_ATTEMPTS
	} = pluginOptions

	// Find available port (auto-increment if enabled and port is in use)
	let port = configuredPort
	if (maxPortAttempts > 1) {
		const result = await findAvailablePort({
			port: configuredPort,
			hostname: hostname ?? 'localhost',
			maxAttempts: maxPortAttempts
		})
		port = result.port
	}

	// Load API routes from the portal
	await portal.ensureRoute('server', 'api')
	const apiRoutes = portal.getByType('server:api') as Record<string, HandlerRecord<ApiHandler>>
	const apiRouteCount = Object.keys(apiRoutes).length

	logger.debug(`Registering ${apiRouteCount} API routes...`)

	// Add loaded API modules onto router
	const prefix = pluginOptions.prefix ?? ''
	const paths: string[] = []

	// Use lazy loading in dev mode for instant HMR updates
	const isDev = Mode.isDev()

	// Import all API handlers and register with the engine
	for (const [routeKey, record] of Object.entries(apiRoutes)) {
		// In production, import handler eagerly for best performance
		// In dev mode, skip eager import - lazy handler will import on first request
		if (!isDev) {
			await portal.importHandler('server', 'api', routeKey)
		}

		// Check if this route belongs to a plugin with exclusive prefix
		const pluginName = record.plugin?.name
		const pluginConfig = pluginName ? registry.getPlugin(pluginName) : null
		const pluginPrefix = pluginConfig?.apiPrefix ?? ''
		const isExclusive = pluginConfig?.exclusive ?? true

		// Base route key (standard API prefix + route)
		const baseKey = prefix + '/' + routeKey.replace(PATH_REGEX, ':$1')

		// In dev mode, use lazy handler for instant HMR updates
		// In production, use eager method dispatcher for best performance
		const wrappedHandler = isDev ? createLazyHandler(routeKey) : createMethodDispatcher(record)

		if (wrappedHandler) {
			if (isExclusive && pluginPrefix) {
				// Exclusive: register ONLY with plugin prefix
				const exclusiveKey = pluginPrefix + baseKey
				engine.registerRoute(exclusiveKey, wrappedHandler)
				paths.push(exclusiveKey)
				logger.debug(`Registered exclusive route: ${exclusiveKey} (plugin: ${pluginName})`)
			} else if (!isExclusive && pluginPrefix) {
				// Additive: register BOTH with and without plugin prefix
				engine.registerRoute(baseKey, wrappedHandler)
				paths.push(baseKey)
				const prefixedKey = pluginPrefix + baseKey
				engine.registerRoute(prefixedKey, wrappedHandler)
				paths.push(prefixedKey)
				logger.debug(`Registered additive routes: ${baseKey} and ${prefixedKey} (plugin: ${pluginName})`)
			} else {
				// No plugin prefix: register normally
				engine.registerRoute(baseKey, wrappedHandler)
				paths.push(baseKey)
			}
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

