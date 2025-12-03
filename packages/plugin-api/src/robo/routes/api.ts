/**
 * Route definition for HTTP API endpoints.
 * Directory inferred from filename: /src/api/
 */
import type { RouteConfig, ScannedEntry, ProcessedEntry, PortalAPI } from 'robo.js'
import type { HandlerRecord } from 'robo.js'

/**
 * API handler function type.
 * Receives request and can return response data or use RoboResponse.
 */
export type ApiHandler = (request: Request) => Response | Promise<Response> | unknown | Promise<unknown>

/**
 * API handler module with exports.
 */
export interface ApiHandlerModule {
	default: ApiHandler
	config?: ApiConfig
}

/**
 * API handler configuration.
 */
export interface ApiConfig {
	/** HTTP methods this endpoint responds to */
	methods?: string[]
}

/**
 * Handler type for data access (portal.server.api)
 */
export type Handler = ApiHandlerModule

/**
 * Controller type for method access (portal.server.endpoint())
 */
export interface ApiController {
	/** Get the handler key (route path) */
	key: string
	/** Execute the handler with a request */
	execute: (request: Request) => Promise<Response>
}

/**
 * Controller factory for runtime (per-handler)
 */
export function controller(key: string, record: HandlerRecord, _pluginState: unknown): ApiController {
	return {
		key,
		async execute(request: Request): Promise<Response> {
			const handler = record.handler?.default as ApiHandler | undefined

			if (!handler) {
				return new Response('Not Found', { status: 404 })
			}

			const result = await handler(request)

			if (result instanceof Response) {
				return result
			}

			// Auto-convert to JSON response
			return new Response(JSON.stringify(result), {
				headers: { 'Content-Type': 'application/json' }
			})
		}
	}
}

/**
 * Namespace controller for portal.server.apis.
 */
export interface ApiNamespaceController {
	get(key: string): Promise<ApiHandlerModule | null>
	list(): string[]
}

/**
 * Namespace controller factory for portal access.
 * Provides get, list methods for all API routes.
 */
export const NamespaceController = (portal: PortalAPI): ApiNamespaceController => ({
	async get(key: string): Promise<ApiHandlerModule | null> {
		try {
			const handler = await portal.getHandler<ApiHandler>('server', 'api', key)
			if (!handler?.default) {
				return null
			}
			return {
				default: handler.default,
				config: handler.config as ApiConfig | undefined
			}
		} catch {
			return null
		}
	},

	list(): string[] {
		const portalApi = portal as unknown as { getByType: (type: string) => Record<string, unknown> }
		const apiData = portalApi.getByType('server:api')
		return Object.keys(apiData)
	}
})

/**
 * Route configuration - how to scan and process files.
 */
export const config: RouteConfig = {
	key: {
		style: 'filepath',
		separator: '/' // users/[id].ts → "users/[id]"
	},
	nesting: {
		maxDepth: 10, // Allow deep nesting for REST APIs
		allowIndex: true, // index.ts → ""
		dynamicSegment: /\[([^\]]+)\]/, // [param] → :param
		catchAllSegment: /\[\.\.\.\w+\]/, // [...slug] → *
		optionalCatchAll: /\[\[\.\.\.(\w+)\]\]/ // [[...slug]] → *?
	},
	exports: {
		named: [],
		default: 'required',
		config: 'optional'
	},
	description: 'HTTP API endpoints'
}

/**
 * Process each scanned API entry.
 */
export default function (entry: ScannedEntry): ProcessedEntry {
	const handlerConfig = entry.exports.config as ApiConfig | undefined

	return {
		key: entry.key,
		path: entry.filePath.replace(/\.ts$/, '.js'),
		exports: {
			default: 'default' in entry.exports,
			config: 'config' in entry.exports,
			named: Object.keys(entry.exports).filter((k) => !['default', 'config'].includes(k))
		},
		metadata: {
			methods: handlerConfig?.methods ?? ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
		}
	}
}
