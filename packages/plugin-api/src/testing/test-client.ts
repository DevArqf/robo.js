import { controller } from '../robo/routes/api.js'
import type { HttpMethodExport } from '../robo/routes/api.js'
import type { HandlerModule } from 'robo.js'
import { createTestRequest } from './create-test-request.js'
import type { TestClient, TestClientRoute, TestableModule, TestRequestOptions, TestRouteResult } from './types.js'

// Local HandlerRecord type
type HandlerRecord = {
	handler: (HandlerModule & Record<string, unknown>) | null
	key: string
	type: string
	path: string
	exports: { default: boolean; config: boolean; named: string[] }
	metadata: Record<string, unknown>
	enabled: boolean
}

/**
 * Wraps a Response with convenience methods
 */
function wrapResponse(response: Response): TestRouteResult {
	return {
		response,
		status: response.status,
		ok: response.ok,
		header: (name: string) => response.headers.get(name),
		json: async <T = unknown>() => response.clone().json() as Promise<T>,
		text: async () => response.clone().text()
	}
}

/**
 * Converts a route pattern to a regex for matching
 * [param] -> capture group for single segment
 * [...param] -> capture group for multiple segments
 */
function patternToRegex(pattern: string): RegExp {
	const regexPattern = pattern
		// Convert [...param] (catch-all) to capture group FIRST
		.replace(/\[\.\.\.(\w+)\]/g, '(.+)')
		// Convert [param] to capture group
		.replace(/\[(\w+)\]/g, '([^/]+)')

	return new RegExp(`^/?${regexPattern}/?$`)
}

/**
 * Extracts parameter names from a route pattern
 */
function extractParamNames(pattern: string): string[] {
	const names: string[] = []
	const regex = /\[\.\.\.(\w+)\]|\[(\w+)\]/g
	let match

	while ((match = regex.exec(pattern)) !== null) {
		names.push(match[1] || match[2])
	}

	return names
}

/**
 * Extracts parameter values from a path given a pattern
 */
function extractParams(pattern: string, path: string): Record<string, string> {
	const params: Record<string, string> = {}
	const paramNames = extractParamNames(pattern)
	const regex = patternToRegex(pattern)
	const match = path.match(regex)

	if (match) {
		paramNames.forEach((name, i) => {
			params[name] = match[i + 1]
		})
	}

	return params
}

/**
 * Creates a fluent test client for testing multiple routes.
 * Routes are registered with patterns that support dynamic segments.
 *
 * @example
 * ```typescript
 * import { createTestClient } from '@robojs/server/testing'
 * import * as usersRoute from '../src/api/users/[id]'
 * import * as postsRoute from '../src/api/posts'
 *
 * const client = createTestClient()
 *   .route('users/[id]', usersRoute)
 *   .route('posts', postsRoute)
 *
 * // Make requests - params are automatically extracted from the URL
 * const user = await client.get('/users/123')
 * expect(user.status).toBe(200)
 * expect(await user.json()).toEqual({ id: '123' })
 *
 * const posts = await client.post('/posts', { body: { title: 'Hello' } })
 * expect(posts.status).toBe(201)
 * ```
 */
export function createTestClient(): TestClient {
	const routes: TestClientRoute[] = []

	function findRoute(path: string): TestClientRoute | undefined {
		// Remove leading/trailing slashes for consistent matching
		const normalizedPath = path.replace(/^\/+|\/+$/g, '')

		for (const route of routes) {
			const regex = patternToRegex(route.pattern)
			if (regex.test(normalizedPath) || regex.test(path)) {
				return route
			}
		}

		return undefined
	}

	async function executeRequest(
		method: HttpMethodExport,
		path: string,
		options: Omit<TestRequestOptions, 'method'> = {}
	): Promise<TestRouteResult> {
		const route = findRoute(path)

		if (!route) {
			// Return a 404 response
			const response = new Response(JSON.stringify({ error: 'Route not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			})
			return wrapResponse(response)
		}

		// Extract params from the path based on the route pattern
		const extractedParams = extractParams(route.pattern, path)
		const params = { ...extractedParams, ...options.params }

		const request = createTestRequest({
			...options,
			method,
			path,
			params
		})

		const handlerModule: HandlerModule & Record<string, unknown> = {
			default: route.module.default,
			config: route.module.config,
			...route.module
		}

		const record: HandlerRecord = {
			handler: handlerModule,
			key: route.pattern,
			type: 'server:api',
			path: 'test.js',
			exports: {
				default: !!route.module.default,
				config: !!route.module.config,
				named: Object.keys(route.module).filter((k) => !['default', 'config'].includes(k))
			},
			metadata: {},
			enabled: true
		}

		const ctrl = controller(route.pattern, record, null)
		const response = await ctrl.execute(request)
		return wrapResponse(response)
	}

	return {
		route(pattern: string, module: TestableModule): TestClient {
			// Normalize pattern - remove leading/trailing slashes
			const normalizedPattern = pattern.replace(/^\/+|\/+$/g, '')
			routes.push({ pattern: normalizedPattern, module })
			return this
		},
		get: (path, options) => executeRequest('GET', path, options),
		post: (path, options) => executeRequest('POST', path, options),
		put: (path, options) => executeRequest('PUT', path, options),
		delete: (path, options) => executeRequest('DELETE', path, options),
		patch: (path, options) => executeRequest('PATCH', path, options),
		options: (path, options) => executeRequest('OPTIONS', path, options),
		head: (path, options) => executeRequest('HEAD', path, options),
		request: executeRequest
	}
}
