/**
 * Tests for CORS handling in the server handler
 *
 * Tests the CORS configuration options including:
 * - Simple boolean (backwards compatible)
 * - Origin whitelisting
 * - Credentials support
 */
import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals'
import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'

// Mock pluginOptions - must be before importing handler
const mockPluginOptions: { cors?: boolean | { origins?: string[] | '*'; credentials?: boolean } } = {}
jest.unstable_mockModule('../.robo/build/robo/prepare.js', () => ({
	pluginOptions: mockPluginOptions
}))

// Mock other dependencies
jest.unstable_mockModule('../.robo/build/core/logger.js', () => ({
	logger: {
		debug: jest.fn(),
		warn: jest.fn(),
		error: jest.fn()
	}
}))

jest.unstable_mockModule('../.robo/build/core/plugin-routes.js', () => ({
	getPluginRouteRegistry: () => ({
		matchApiPrefix: () => null,
		matchStaticPrefix: () => null
	})
}))

jest.unstable_mockModule('robo.js', () => ({
	color: { bold: (s: string) => s },
	Mode: { isDev: () => false }
}))

/**
 * Creates a mock IncomingMessage for testing
 */
function createMockRequest(options: {
	method?: string
	url?: string
	headers?: Record<string, string | string[]>
} = {}): IncomingMessage {
	const { method = 'GET', url = '/', headers = {} } = options

	const req = new EventEmitter() as IncomingMessage
	req.method = method
	req.url = url
	req.headers = { host: 'localhost:3000', ...headers }

	setImmediate(() => req.emit('end'))

	return req
}

/**
 * Creates a mock ServerResponse for testing
 */
function createMockResponse(): ServerResponse & {
	_headers: Record<string, string | string[]>
	_statusCode: number
	_ended: boolean
} {
	const headers: Record<string, string | string[]> = {}
	const res = {
		_headers: headers,
		_statusCode: 200,
		_ended: false,
		statusCode: 200,
		setHeader: jest.fn((name: string, value: string | string[]) => {
			headers[name.toLowerCase()] = value
		}),
		getHeader: jest.fn((name: string) => headers[name.toLowerCase()]),
		writeHead: jest.fn((code: number) => {
			res._statusCode = code
			res.statusCode = code
		}),
		write: jest.fn(),
		end: jest.fn(() => {
			res._ended = true
		}),
		writableEnded: false,
		headersSent: false
	}
	return res as unknown as ServerResponse & typeof res
}

describe('CORS Handling', () => {
	beforeEach(() => {
		// Reset mock options before each test
		Object.keys(mockPluginOptions).forEach((key) => delete (mockPluginOptions as Record<string, unknown>)[key])
		jest.resetModules()
	})

	describe('cors: true (simple boolean)', () => {
		it('sets wildcard Access-Control-Allow-Origin', async () => {
			mockPluginOptions.cors = true

			const { createServerHandler } = await import('../.robo/build/core/handler.js')
			const mockRouter = { find: () => null }
			const handler = createServerHandler(mockRouter as never)

			const req = createMockRequest({ headers: { origin: 'http://example.com' } })
			const res = createMockResponse()

			await handler(req, res)

			expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*')
		})

		it('handles OPTIONS preflight with 204', async () => {
			mockPluginOptions.cors = true

			const { createServerHandler } = await import('../.robo/build/core/handler.js')
			const mockRouter = { find: () => null }
			const handler = createServerHandler(mockRouter as never)

			const req = createMockRequest({ method: 'OPTIONS' })
			const res = createMockResponse()

			await handler(req, res)

			expect(res.writeHead).toHaveBeenCalledWith(204)
			expect(res.end).toHaveBeenCalled()
		})

		it('sets standard allowed methods and headers', async () => {
			mockPluginOptions.cors = true

			const { createServerHandler } = await import('../.robo/build/core/handler.js')
			const mockRouter = { find: () => null }
			const handler = createServerHandler(mockRouter as never)

			const req = createMockRequest()
			const res = createMockResponse()

			await handler(req, res)

			expect(res.setHeader).toHaveBeenCalledWith(
				'Access-Control-Allow-Methods',
				'GET, POST, PUT, DELETE, PATCH, OPTIONS'
			)
			expect(res.setHeader).toHaveBeenCalledWith(
				'Access-Control-Allow-Headers',
				'Content-Type, Authorization, X-Requested-With'
			)
		})
	})

	describe('cors with specific origins', () => {
		it('echoes back allowed origin', async () => {
			mockPluginOptions.cors = {
				origins: ['http://localhost:7426', 'http://example.com']
			}

			const { createServerHandler } = await import('../.robo/build/core/handler.js')
			const mockRouter = { find: () => null }
			const handler = createServerHandler(mockRouter as never)

			const req = createMockRequest({ headers: { origin: 'http://localhost:7426' } })
			const res = createMockResponse()

			await handler(req, res)

			expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:7426')
			expect(res.setHeader).toHaveBeenCalledWith('Vary', 'Origin')
		})

		it('does not set origin header for disallowed origins', async () => {
			mockPluginOptions.cors = {
				origins: ['http://allowed.com']
			}

			const { createServerHandler } = await import('../.robo/build/core/handler.js')
			const mockRouter = { find: () => null }
			const handler = createServerHandler(mockRouter as never)

			const req = createMockRequest({ headers: { origin: 'http://notallowed.com' } })
			const res = createMockResponse()

			await handler(req, res)

			// Should not have called setHeader with Access-Control-Allow-Origin for this origin
			const originCalls = (res.setHeader as jest.Mock).mock.calls.filter(
				(call) => call[0] === 'Access-Control-Allow-Origin'
			)
			expect(originCalls.length).toBe(0)
		})
	})

	describe('cors with credentials', () => {
		it('sets Access-Control-Allow-Credentials header', async () => {
			mockPluginOptions.cors = {
				origins: ['http://localhost:7426'],
				credentials: true
			}

			const { createServerHandler } = await import('../.robo/build/core/handler.js')
			const mockRouter = { find: () => null }
			const handler = createServerHandler(mockRouter as never)

			const req = createMockRequest({ headers: { origin: 'http://localhost:7426' } })
			const res = createMockResponse()

			await handler(req, res)

			expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true')
		})

		it('echoes specific origin instead of wildcard when credentials enabled', async () => {
			mockPluginOptions.cors = {
				origins: '*',
				credentials: true
			}

			const { createServerHandler } = await import('../.robo/build/core/handler.js')
			const mockRouter = { find: () => null }
			const handler = createServerHandler(mockRouter as never)

			const req = createMockRequest({ headers: { origin: 'http://any-origin.com' } })
			const res = createMockResponse()

			await handler(req, res)

			// With credentials + wildcard, should echo back the request origin
			expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://any-origin.com')
			expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true')

			// Should NOT have wildcard
			const wildcardCalls = (res.setHeader as jest.Mock).mock.calls.filter(
				(call) => call[0] === 'Access-Control-Allow-Origin' && call[1] === '*'
			)
			expect(wildcardCalls.length).toBe(0)
		})
	})

	describe('cors disabled', () => {
		it('does not set CORS headers when cors is undefined', async () => {
			// cors not set

			const { createServerHandler } = await import('../.robo/build/core/handler.js')
			const mockRouter = { find: () => null }
			const handler = createServerHandler(mockRouter as never)

			const req = createMockRequest()
			const res = createMockResponse()

			await handler(req, res)

			const corsCalls = (res.setHeader as jest.Mock).mock.calls.filter((call) =>
				(call[0] as string).toLowerCase().startsWith('access-control-')
			)
			expect(corsCalls.length).toBe(0)
		})

		it('does not set CORS headers when cors is false', async () => {
			mockPluginOptions.cors = false as never

			const { createServerHandler } = await import('../.robo/build/core/handler.js')
			const mockRouter = { find: () => null }
			const handler = createServerHandler(mockRouter as never)

			const req = createMockRequest()
			const res = createMockResponse()

			await handler(req, res)

			const corsCalls = (res.setHeader as jest.Mock).mock.calls.filter((call) =>
				(call[0] as string).toLowerCase().startsWith('access-control-')
			)
			expect(corsCalls.length).toBe(0)
		})
	})
})
