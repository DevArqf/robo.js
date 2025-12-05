/**
 * Tests for Named HTTP Method Exports
 *
 * Verifies that API routes can use named exports (GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD)
 * in addition to the traditional default export pattern.
 */
import { describe, expect, it, jest } from '@jest/globals'
import processEntry, { HTTP_METHODS, controller, config } from '../src/robo/routes/api.js'
import type { ApiHandlerModule } from '../src/robo/routes/api.js'
import type { HandlerModule, ScannedEntry } from 'robo.js'

// Local HandlerRecord type to avoid import issues
type HandlerRecord = {
	handler: (HandlerModule & Record<string, unknown>) | null
	key: string
	type: string
	path: string
	exports: { default: boolean; config: boolean; named: string[] }
	metadata: Record<string, unknown>
	enabled: boolean
}

// Helper to create mock handler records
function createMockRecord(handler: Partial<ApiHandlerModule>): HandlerRecord {
	// Create a proper HandlerModule shape
	const handlerModule: HandlerModule & Record<string, unknown> = {
		default: handler.default,
		config: handler.config,
		...handler
	}

	return {
		handler: handlerModule,
		key: 'test',
		type: 'server:api',
		path: 'api/test.js',
		exports: {
			default: !!handler.default,
			config: false,
			named: Object.keys(handler).filter((k) => !['default', 'config'].includes(k))
		},
		metadata: {},
		enabled: true
	}
}

// Helper to create mock requests
function createMockRequest(method: string, url = 'http://localhost:3000/api/test', body?: unknown): Request {
	const init: RequestInit = { method }
	if (body !== undefined) {
		init.body = JSON.stringify(body)
		init.headers = { 'Content-Type': 'application/json' }
	}
	return new Request(url, init)
}

describe('HTTP_METHODS constant', () => {
	it('exports all standard HTTP methods', () => {
		expect(HTTP_METHODS).toEqual(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'])
	})

	it('has 7 methods', () => {
		expect(HTTP_METHODS).toHaveLength(7)
	})
})

describe('controller function', () => {
	describe('handler detection', () => {
		it('returns 404 when handler is null', async () => {
			const record = createMockRecord({})
			record.handler = null
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('GET'))
			expect(response.status).toBe(404)
		})
	})

	describe('default export only (backward compatibility)', () => {
		it('routes all methods to default handler', async () => {
			const defaultHandler = jest.fn().mockReturnValue({ message: 'handled' })
			const record = createMockRecord({ default: defaultHandler })
			const ctrl = controller('test', record, null)

			for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const) {
				const response = await ctrl.execute(createMockRequest(method))
				expect(response.status).toBe(200)
				const body = await response.json()
				expect(body).toEqual({ message: 'handled' })
			}
		})

		it('handles OPTIONS requests with default handler', async () => {
			const defaultHandler = jest.fn().mockReturnValue({ options: true })
			const record = createMockRecord({ default: defaultHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('OPTIONS'))
			expect(response.status).toBe(200)
			expect(defaultHandler).toHaveBeenCalled()
		})

		it('handles HEAD requests with default handler', async () => {
			const defaultHandler = jest.fn().mockReturnValue({ head: true })
			const record = createMockRecord({ default: defaultHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('HEAD'))
			expect(response.status).toBe(200)
			expect(defaultHandler).toHaveBeenCalled()
		})
	})

	describe('named method exports only', () => {
		it('GET export handles GET requests', async () => {
			const getHandler = jest.fn().mockReturnValue({ method: 'GET' })
			const record = createMockRecord({ GET: getHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('GET'))
			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body).toEqual({ method: 'GET' })
			expect(getHandler).toHaveBeenCalled()
		})

		it('POST export handles POST requests', async () => {
			const postHandler = jest.fn().mockReturnValue({ method: 'POST' })
			const record = createMockRecord({ POST: postHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('POST'))
			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body).toEqual({ method: 'POST' })
		})

		it('PUT export handles PUT requests', async () => {
			const putHandler = jest.fn().mockReturnValue({ method: 'PUT' })
			const record = createMockRecord({ PUT: putHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('PUT'))
			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body).toEqual({ method: 'PUT' })
		})

		it('DELETE export handles DELETE requests', async () => {
			const deleteHandler = jest.fn().mockReturnValue({ method: 'DELETE' })
			const record = createMockRecord({ DELETE: deleteHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('DELETE'))
			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body).toEqual({ method: 'DELETE' })
		})

		it('PATCH export handles PATCH requests', async () => {
			const patchHandler = jest.fn().mockReturnValue({ method: 'PATCH' })
			const record = createMockRecord({ PATCH: patchHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('PATCH'))
			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body).toEqual({ method: 'PATCH' })
		})

		it('OPTIONS export handles OPTIONS requests', async () => {
			const optionsHandler = jest.fn().mockReturnValue({ method: 'OPTIONS' })
			const record = createMockRecord({ OPTIONS: optionsHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('OPTIONS'))
			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body).toEqual({ method: 'OPTIONS' })
		})

		it('HEAD export handles HEAD requests', async () => {
			const headHandler = jest.fn().mockReturnValue({ method: 'HEAD' })
			const record = createMockRecord({ HEAD: headHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('HEAD'))
			expect(response.status).toBe(200)
			expect(headHandler).toHaveBeenCalled()
		})
	})

	describe('mixed exports (named + default)', () => {
		it('named export takes priority over default for matching method', async () => {
			const getHandler = jest.fn().mockReturnValue({ handler: 'named' })
			const defaultHandler = jest.fn().mockReturnValue({ handler: 'default' })
			const record = createMockRecord({ GET: getHandler, default: defaultHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('GET'))
			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body).toEqual({ handler: 'named' })
			expect(getHandler).toHaveBeenCalled()
			expect(defaultHandler).not.toHaveBeenCalled()
		})

		it('default export handles methods without named export', async () => {
			const getHandler = jest.fn().mockReturnValue({ handler: 'named' })
			const defaultHandler = jest.fn().mockReturnValue({ handler: 'default' })
			const record = createMockRecord({ GET: getHandler, default: defaultHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('POST'))
			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body).toEqual({ handler: 'default' })
			expect(defaultHandler).toHaveBeenCalled()
			expect(getHandler).not.toHaveBeenCalled()
		})

		it('GET + POST named: DELETE uses neither (405)', async () => {
			const getHandler = jest.fn().mockReturnValue({ method: 'GET' })
			const postHandler = jest.fn().mockReturnValue({ method: 'POST' })
			const record = createMockRecord({ GET: getHandler, POST: postHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('DELETE'))
			expect(response.status).toBe(405)
			expect(getHandler).not.toHaveBeenCalled()
			expect(postHandler).not.toHaveBeenCalled()
		})
	})

	describe('405 Method Not Allowed', () => {
		it('returns 405 for unsupported method when only named exports', async () => {
			const getHandler = jest.fn().mockReturnValue({ method: 'GET' })
			const record = createMockRecord({ GET: getHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('POST'))
			expect(response.status).toBe(405)
		})

		it('405 response includes Allow header with available methods', async () => {
			const getHandler = jest.fn().mockReturnValue({ method: 'GET' })
			const postHandler = jest.fn().mockReturnValue({ method: 'POST' })
			const record = createMockRecord({ GET: getHandler, POST: postHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('DELETE'))
			expect(response.status).toBe(405)
			expect(response.headers.get('Allow')).toBe('GET, POST')
		})

		it('405 response body contains error message', async () => {
			const getHandler = jest.fn().mockReturnValue({ method: 'GET' })
			const record = createMockRecord({ GET: getHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('PUT'))
			expect(response.status).toBe(405)
			const body = await response.json()
			expect(body.error).toBe('Method Not Allowed')
		})
	})

	describe('OPTIONS auto-handling', () => {
		it('auto-responds to OPTIONS when no OPTIONS export and no default', async () => {
			const getHandler = jest.fn().mockReturnValue({ method: 'GET' })
			const postHandler = jest.fn().mockReturnValue({ method: 'POST' })
			const record = createMockRecord({ GET: getHandler, POST: postHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('OPTIONS'))
			expect(response.status).toBe(204)
			expect(getHandler).not.toHaveBeenCalled()
			expect(postHandler).not.toHaveBeenCalled()
		})

		it('includes Allow header listing all available methods', async () => {
			const getHandler = jest.fn().mockReturnValue({ method: 'GET' })
			const deleteHandler = jest.fn().mockReturnValue({ method: 'DELETE' })
			const record = createMockRecord({ GET: getHandler, DELETE: deleteHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('OPTIONS'))
			expect(response.status).toBe(204)
			expect(response.headers.get('Allow')).toBe('GET, DELETE')
		})

		it('explicit OPTIONS export overrides auto-handling', async () => {
			const getHandler = jest.fn().mockReturnValue({ method: 'GET' })
			const optionsHandler = jest.fn().mockReturnValue({ custom: 'options' })
			const record = createMockRecord({ GET: getHandler, OPTIONS: optionsHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('OPTIONS'))
			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body).toEqual({ custom: 'options' })
			expect(optionsHandler).toHaveBeenCalled()
		})

		it('default export handles OPTIONS if no explicit export', async () => {
			const defaultHandler = jest.fn().mockReturnValue({ from: 'default' })
			const getHandler = jest.fn().mockReturnValue({ method: 'GET' })
			const record = createMockRecord({ GET: getHandler, default: defaultHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('OPTIONS'))
			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body).toEqual({ from: 'default' })
			expect(defaultHandler).toHaveBeenCalled()
		})
	})

	describe('HEAD auto-handling', () => {
		it('HEAD falls back to GET handler when no HEAD export', async () => {
			const getHandler = jest.fn().mockReturnValue({ method: 'GET' })
			const record = createMockRecord({ GET: getHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('HEAD'))
			expect(response.status).toBe(200)
			expect(getHandler).toHaveBeenCalled()
		})

		it('explicit HEAD export overrides GET fallback', async () => {
			const getHandler = jest.fn().mockReturnValue({ method: 'GET' })
			const headHandler = jest.fn().mockReturnValue({ method: 'HEAD' })
			const record = createMockRecord({ GET: getHandler, HEAD: headHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('HEAD'))
			expect(response.status).toBe(200)
			expect(headHandler).toHaveBeenCalled()
			expect(getHandler).not.toHaveBeenCalled()
		})

		it('HEAD returns 405 if no HEAD, no GET, and no default', async () => {
			const postHandler = jest.fn().mockReturnValue({ method: 'POST' })
			const record = createMockRecord({ POST: postHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('HEAD'))
			expect(response.status).toBe(405)
		})

		it('default export handles HEAD if no explicit exports', async () => {
			const defaultHandler = jest.fn().mockReturnValue({ from: 'default' })
			const record = createMockRecord({ default: defaultHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('HEAD'))
			expect(response.status).toBe(200)
			expect(defaultHandler).toHaveBeenCalled()
		})
	})

	describe('response handling', () => {
		it('returns Response object directly if handler returns Response', async () => {
			const getHandler = jest.fn().mockReturnValue(
				new Response('custom', { status: 201, headers: { 'X-Custom': 'header' } })
			)
			const record = createMockRecord({ GET: getHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('GET'))
			expect(response.status).toBe(201)
			expect(response.headers.get('X-Custom')).toBe('header')
			expect(await response.text()).toBe('custom')
		})

		it('auto-converts plain objects to JSON response', async () => {
			const getHandler = jest.fn().mockReturnValue({ data: [1, 2, 3] })
			const record = createMockRecord({ GET: getHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('GET'))
			expect(response.status).toBe(200)
			expect(response.headers.get('Content-Type')).toBe('application/json')
			const body = await response.json()
			expect(body).toEqual({ data: [1, 2, 3] })
		})

		it('handles async handlers', async () => {
			const getHandler = jest.fn().mockImplementation(async () => {
				await new Promise((r) => setTimeout(r, 10))
				return { async: true }
			})
			const record = createMockRecord({ GET: getHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('GET'))
			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body).toEqual({ async: true })
		})
	})

	describe('edge cases', () => {
		it('handler with only config export returns 405 for all methods', async () => {
			const record = createMockRecord({ config: { methods: ['GET'] } } as unknown as ApiHandlerModule)
			const ctrl = controller('test', record, null)

			for (const method of ['GET', 'POST', 'PUT', 'DELETE'] as const) {
				const response = await ctrl.execute(createMockRequest(method))
				// No handler available, so 405
				expect(response.status).toBe(405)
			}
		})

		it('case-insensitive method matching (lowercase input)', async () => {
			const getHandler = jest.fn().mockReturnValue({ method: 'GET' })
			const record = createMockRecord({ GET: getHandler })
			const ctrl = controller('test', record, null)

			// Request methods are normalized to uppercase by the Request constructor
			const response = await ctrl.execute(new Request('http://localhost/api/test', { method: 'get' }))
			expect(response.status).toBe(200)
			expect(getHandler).toHaveBeenCalled()
		})

		it('empty handler object returns 405', async () => {
			const record = createMockRecord({})
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('GET'))
			expect(response.status).toBe(405)
		})
	})

	describe('request passing', () => {
		it('passes request object to handler', async () => {
			const getHandler = jest.fn().mockImplementation((req: Request) => {
				return { url: req.url, method: req.method }
			})
			const record = createMockRecord({ GET: getHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('GET', 'http://localhost:3000/api/users'))
			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body.url).toBe('http://localhost:3000/api/users')
			expect(body.method).toBe('GET')
			expect(getHandler).toHaveBeenCalledWith(expect.any(Request))
		})
	})

	describe('primitive return values', () => {
		it('handles null return value', async () => {
			const getHandler = jest.fn().mockReturnValue(null)
			const record = createMockRecord({ GET: getHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('GET'))
			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body).toBe(null)
		})

		it('handles undefined return value', async () => {
			const getHandler = jest.fn().mockReturnValue(undefined)
			const record = createMockRecord({ GET: getHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('GET'))
			expect(response.status).toBe(200)
		})

		it('handles string return value', async () => {
			const getHandler = jest.fn().mockReturnValue('Hello World')
			const record = createMockRecord({ GET: getHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('GET'))
			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body).toBe('Hello World')
		})

		it('handles number return value', async () => {
			const getHandler = jest.fn().mockReturnValue(42)
			const record = createMockRecord({ GET: getHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('GET'))
			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body).toBe(42)
		})

		it('handles boolean return value', async () => {
			const getHandler = jest.fn().mockReturnValue(true)
			const record = createMockRecord({ GET: getHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('GET'))
			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body).toBe(true)
		})

		it('handles array return value', async () => {
			const getHandler = jest.fn().mockReturnValue([1, 2, 3])
			const record = createMockRecord({ GET: getHandler })
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest('GET'))
			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body).toEqual([1, 2, 3])
		})
	})

	describe('controller properties', () => {
		it('exposes the route key', () => {
			const record = createMockRecord({ GET: jest.fn() })
			const ctrl = controller('users/[id]', record, null)

			expect(ctrl.key).toBe('users/[id]')
		})
	})
})

describe('behavior matrix', () => {
	/**
	 * Comprehensive behavior matrix test
	 * | Route Has | Request Method | Result |
	 * |-----------|---------------|--------|
	 * | Only `default` | Any | Calls `default` |
	 * | Only `GET` | GET | Calls `GET` |
	 * | Only `GET` | POST | Returns 405 with `Allow: GET` |
	 * | `GET` + `default` | GET | Calls `GET` (named takes priority) |
	 * | `GET` + `default` | POST | Calls `default` (fallback) |
	 * | `GET` + `POST` | DELETE | Returns 405 with `Allow: GET, POST` |
	 */

	const scenarios: Array<{
		name: string
		handler: Partial<ApiHandlerModule>
		method: string
		expectedStatus: number
		expectedCalled?: 'GET' | 'POST' | 'default' | 'none'
		expectedAllow?: string
	}> = [
		{
			name: 'Only default + Any method → Calls default',
			handler: { default: jest.fn().mockReturnValue({ ok: true }) },
			method: 'PATCH',
			expectedStatus: 200,
			expectedCalled: 'default'
		},
		{
			name: 'Only GET + GET → Calls GET',
			handler: { GET: jest.fn().mockReturnValue({ ok: true }) },
			method: 'GET',
			expectedStatus: 200,
			expectedCalled: 'GET'
		},
		{
			name: 'Only GET + POST → Returns 405',
			handler: { GET: jest.fn().mockReturnValue({ ok: true }) },
			method: 'POST',
			expectedStatus: 405,
			expectedCalled: 'none',
			expectedAllow: 'GET'
		},
		{
			name: 'GET + default + GET → Calls GET (named priority)',
			handler: {
				GET: jest.fn().mockReturnValue({ from: 'GET' }),
				default: jest.fn().mockReturnValue({ from: 'default' })
			},
			method: 'GET',
			expectedStatus: 200,
			expectedCalled: 'GET'
		},
		{
			name: 'GET + default + POST → Calls default (fallback)',
			handler: {
				GET: jest.fn().mockReturnValue({ from: 'GET' }),
				default: jest.fn().mockReturnValue({ from: 'default' })
			},
			method: 'POST',
			expectedStatus: 200,
			expectedCalled: 'default'
		},
		{
			name: 'GET + POST + DELETE → Returns 405 with Allow: GET, POST',
			handler: {
				GET: jest.fn().mockReturnValue({ from: 'GET' }),
				POST: jest.fn().mockReturnValue({ from: 'POST' })
			},
			method: 'DELETE',
			expectedStatus: 405,
			expectedCalled: 'none',
			expectedAllow: 'GET, POST'
		}
	]

	for (const scenario of scenarios) {
		it(scenario.name, async () => {
			const record = createMockRecord(scenario.handler)
			const ctrl = controller('test', record, null)

			const response = await ctrl.execute(createMockRequest(scenario.method))
			expect(response.status).toBe(scenario.expectedStatus)

			if (scenario.expectedAllow) {
				expect(response.headers.get('Allow')).toBe(scenario.expectedAllow)
			}

			if (scenario.expectedCalled === 'none') {
				if (scenario.handler.GET) expect(scenario.handler.GET).not.toHaveBeenCalled()
				if (scenario.handler.POST) expect(scenario.handler.POST).not.toHaveBeenCalled()
				if (scenario.handler.default) expect(scenario.handler.default).not.toHaveBeenCalled()
			} else if (scenario.expectedCalled === 'GET') {
				expect(scenario.handler.GET).toHaveBeenCalled()
				if (scenario.handler.default) expect(scenario.handler.default).not.toHaveBeenCalled()
			} else if (scenario.expectedCalled === 'POST') {
				expect(scenario.handler.POST).toHaveBeenCalled()
			} else if (scenario.expectedCalled === 'default') {
				expect(scenario.handler.default).toHaveBeenCalled()
				if (scenario.handler.GET) expect(scenario.handler.GET).not.toHaveBeenCalled()
			}
		})
	}
})

describe('route config', () => {
	it('includes all HTTP methods in named exports', () => {
		expect(config.exports?.named).toEqual(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'])
	})

	it('makes default export optional', () => {
		expect(config.exports?.default).toBe('optional')
	})

	it('makes config export optional', () => {
		expect(config.exports?.config).toBe('optional')
	})

	it('uses filepath style for keys', () => {
		expect(config.key?.style).toBe('filepath')
	})

	it('uses / as separator', () => {
		expect(config.key?.separator).toBe('/')
	})
})

describe('route processor (processEntry)', () => {
	// Helper to create mock scanned entries
	function createScannedEntry(overrides: Partial<ScannedEntry> = {}): ScannedEntry {
		return {
			key: 'users',
			type: 'server:api',
			filePath: 'src/api/users.ts',
			relativePath: 'users.ts',
			exports: { default: () => {} },
			...overrides
		}
	}

	it('processes entry with default export', () => {
		const entry = createScannedEntry({
			key: 'users',
			filePath: 'src/api/users.ts',
			exports: { default: () => {} }
		})

		const result = processEntry(entry)

		expect(result.key).toBe('users')
		expect(result.path).toBe('src/api/users.js')
		expect(result.exports.default).toBe(true)
		expect(result.exports.named).toEqual([])
	})

	it('processes entry with named method exports', () => {
		const entry = createScannedEntry({
			key: 'users',
			filePath: 'src/api/users.ts',
			exports: {
				GET: () => {},
				POST: () => {}
			}
		})

		const result = processEntry(entry)

		expect(result.exports.default).toBe(false)
		expect(result.exports.named).toContain('GET')
		expect(result.exports.named).toContain('POST')
	})

	it('processes entry with mixed exports', () => {
		const entry = createScannedEntry({
			key: 'users/[id]',
			filePath: 'src/api/users/[id].ts',
			exports: {
				default: () => {},
				GET: () => {},
				DELETE: () => {}
			}
		})

		const result = processEntry(entry)

		expect(result.key).toBe('users/[id]')
		expect(result.exports.default).toBe(true)
		expect(result.exports.named).toContain('GET')
		expect(result.exports.named).toContain('DELETE')
	})

	it('converts .ts extension to .js in path', () => {
		const entry = createScannedEntry({
			filePath: 'src/api/deeply/nested/route.ts'
		})

		const result = processEntry(entry)

		expect(result.path).toBe('src/api/deeply/nested/route.js')
	})

	it('extracts config from exports', () => {
		const entry = createScannedEntry({
			exports: {
				default: () => {},
				config: { methods: ['GET'] }
			}
		})

		const result = processEntry(entry)

		expect(result.exports.config).toBe(true)
	})

	it('includes default methods in metadata when no config', () => {
		const entry = createScannedEntry({
			exports: { GET: () => {} }
		})

		const result = processEntry(entry)

		expect(result.metadata.methods).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
	})
})
