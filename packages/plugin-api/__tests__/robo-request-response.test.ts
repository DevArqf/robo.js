/**
 * Tests for RoboRequest and RoboResponse
 *
 * Tests the request/response wrappers that extend the Web API
 * with additional convenience methods for server-side use.
 */
import { describe, expect, it, jest } from '@jest/globals'
import { EventEmitter } from 'node:events'
import type { IncomingMessage } from 'node:http'
import { RoboRequest, applyParams, validateURL } from '../.robo/build/core/robo-request.js'
import { RoboResponse } from '../.robo/build/core/robo-response.js'

/**
 * Creates a mock IncomingMessage for testing RoboRequest.from()
 */
function createMockIncomingMessage(options: {
	method?: string
	url?: string
	headers?: Record<string, string | string[]>
	body?: string | Buffer
	originalUrl?: string
} = {}): IncomingMessage {
	const { method = 'GET', url = '/', headers = {}, body, originalUrl } = options

	const req = new EventEmitter() as IncomingMessage & { originalUrl?: string }
	req.method = method
	req.url = url
	req.headers = { host: 'localhost:3000', ...headers }

	if (originalUrl) {
		req.originalUrl = originalUrl
	}

	// Simulate body streaming asynchronously
	if (body) {
		setImmediate(() => {
			req.emit('data', Buffer.isBuffer(body) ? body : Buffer.from(body))
			req.emit('end')
		})
	} else {
		setImmediate(() => req.emit('end'))
	}

	return req
}

describe('RoboRequest', () => {
	describe('params getter', () => {
		it('returns empty object by default', async () => {
			const mockReq = createMockIncomingMessage()
			const request = await RoboRequest.from(mockReq)

			expect(request.params).toEqual({})
		})

		it('returns params set via applyParams', async () => {
			const mockReq = createMockIncomingMessage()
			const request = await RoboRequest.from(mockReq)

			applyParams(request, { id: '123', slug: 'test-post' })

			expect(request.params).toEqual({ id: '123', slug: 'test-post' })
		})
	})

	describe('query getter', () => {
		it('parses single query parameters', async () => {
			const mockReq = createMockIncomingMessage({ url: '/api/users?name=john' })
			const request = await RoboRequest.from(mockReq)

			expect(request.query).toEqual({ name: 'john' })
		})

		it('parses multiple query parameters', async () => {
			const mockReq = createMockIncomingMessage({ url: '/api/users?name=john&age=30&active=true' })
			const request = await RoboRequest.from(mockReq)

			expect(request.query).toEqual({ name: 'john', age: '30', active: 'true' })
		})

		it('returns empty object for no query string', async () => {
			const mockReq = createMockIncomingMessage({ url: '/api/users' })
			const request = await RoboRequest.from(mockReq)

			expect(request.query).toEqual({})
		})

		it('handles URL-encoded values', async () => {
			const mockReq = createMockIncomingMessage({ url: '/api/search?q=hello%20world&tag=%23test' })
			const request = await RoboRequest.from(mockReq)

			expect(request.query).toEqual({ q: 'hello world', tag: '#test' })
		})

		it('handles special characters in query values', async () => {
			const mockReq = createMockIncomingMessage({ url: '/api/search?email=user%40example.com' })
			const request = await RoboRequest.from(mockReq)

			expect(request.query).toEqual({ email: 'user@example.com' })
		})
	})

	describe('raw getter', () => {
		it('returns the original IncomingMessage', async () => {
			const mockReq = createMockIncomingMessage()
			const request = await RoboRequest.from(mockReq)

			expect(request.raw).toBe(mockReq)
		})
	})

	describe('from() static method', () => {
		describe('protocol detection', () => {
			it('uses http as default protocol', async () => {
				const mockReq = createMockIncomingMessage({ url: '/api/test' })
				const request = await RoboRequest.from(mockReq)

				expect(request.url).toBe('http://localhost:3000/api/test')
			})

			it('respects x-forwarded-proto header for https', async () => {
				const mockReq = createMockIncomingMessage({
					url: '/api/test',
					headers: { 'x-forwarded-proto': 'https' }
				})
				const request = await RoboRequest.from(mockReq)

				expect(request.url).toBe('https://localhost:3000/api/test')
			})

			it('handles x-forwarded-proto with multiple values', async () => {
				const mockReq = createMockIncomingMessage({
					url: '/api/test',
					headers: { 'x-forwarded-proto': 'https, http' }
				})
				const request = await RoboRequest.from(mockReq)

				// Should use the first value (https)
				expect(request.url).toBe('https://localhost:3000/api/test')
			})

			it('handles x-forwarded-proto as array', async () => {
				const mockReq = createMockIncomingMessage({
					url: '/api/test',
					headers: { 'x-forwarded-proto': ['https', 'http'] }
				})
				const request = await RoboRequest.from(mockReq)

				expect(request.url).toBe('https://localhost:3000/api/test')
			})
		})

		describe('URL construction', () => {
			it('constructs URL from host header and path', async () => {
				const mockReq = createMockIncomingMessage({
					url: '/api/users/123',
					headers: { host: 'example.com' }
				})
				const request = await RoboRequest.from(mockReq)

				expect(request.url).toBe('http://example.com/api/users/123')
			})

			it('uses originalUrl if present (Express compatibility)', async () => {
				const mockReq = createMockIncomingMessage({
					url: '/users/123', // req.url might be modified by middleware
					originalUrl: '/api/users/123' // original URL before middleware
				})
				const request = await RoboRequest.from(mockReq)

				expect(request.url).toBe('http://localhost:3000/api/users/123')
			})

			it('preserves query string in URL', async () => {
				const mockReq = createMockIncomingMessage({
					url: '/api/search?q=test&page=1'
				})
				const request = await RoboRequest.from(mockReq)

				expect(request.url).toBe('http://localhost:3000/api/search?q=test&page=1')
			})
		})

		describe('body handling', () => {
			it('buffers body for POST requests', async () => {
				const mockReq = createMockIncomingMessage({
					method: 'POST',
					url: '/api/users',
					body: JSON.stringify({ name: 'John' })
				})
				const request = await RoboRequest.from(mockReq)

				const body = await request.json()
				expect(body).toEqual({ name: 'John' })
			})

			it('buffers body for PUT requests', async () => {
				const mockReq = createMockIncomingMessage({
					method: 'PUT',
					url: '/api/users/123',
					body: JSON.stringify({ name: 'Jane' })
				})
				const request = await RoboRequest.from(mockReq)

				const body = await request.json()
				expect(body).toEqual({ name: 'Jane' })
			})

			it('buffers body for PATCH requests', async () => {
				const mockReq = createMockIncomingMessage({
					method: 'PATCH',
					url: '/api/users/123',
					body: JSON.stringify({ active: true })
				})
				const request = await RoboRequest.from(mockReq)

				const body = await request.json()
				expect(body).toEqual({ active: true })
			})

			it('buffers body for DELETE requests with body', async () => {
				const mockReq = createMockIncomingMessage({
					method: 'DELETE',
					url: '/api/users/123',
					body: JSON.stringify({ reason: 'inactive' })
				})
				const request = await RoboRequest.from(mockReq)

				const body = await request.json()
				expect(body).toEqual({ reason: 'inactive' })
			})

			it('skips body buffering for GET requests', async () => {
				const mockReq = createMockIncomingMessage({
					method: 'GET',
					url: '/api/users'
				})
				const request = await RoboRequest.from(mockReq)

				expect(request.body).toBeNull()
			})

			it('skips body buffering for HEAD requests', async () => {
				const mockReq = createMockIncomingMessage({
					method: 'HEAD',
					url: '/api/users'
				})
				const request = await RoboRequest.from(mockReq)

				expect(request.body).toBeNull()
			})

			it('respects skipBody option', async () => {
				const mockReq = createMockIncomingMessage({
					method: 'POST',
					url: '/api/users',
					body: JSON.stringify({ name: 'John' })
				})
				const request = await RoboRequest.from(mockReq, { skipBody: true })

				expect(request.body).toBeNull()
			})

			it('uses provided body option instead of buffering', async () => {
				const preBufferedBody = Buffer.from(JSON.stringify({ preBuffered: true }))
				const mockReq = createMockIncomingMessage({
					method: 'POST',
					url: '/api/users'
					// No body in mock - we'll provide it via options
				})
				const request = await RoboRequest.from(mockReq, { body: preBufferedBody })

				const body = await request.json()
				expect(body).toEqual({ preBuffered: true })
			})

			it('handles binary body data', async () => {
				const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03])
				const mockReq = createMockIncomingMessage({
					method: 'POST',
					url: '/api/upload',
					body: binaryData
				})
				const request = await RoboRequest.from(mockReq)

				const arrayBuffer = await request.arrayBuffer()
				expect(Buffer.from(arrayBuffer)).toEqual(binaryData)
			})
		})

		describe('method handling', () => {
			it('preserves HTTP method', async () => {
				const mockReq = createMockIncomingMessage({ method: 'DELETE' })
				const request = await RoboRequest.from(mockReq)

				expect(request.method).toBe('DELETE')
			})

			it('defaults method to GET when not provided', async () => {
				const mockReq = createMockIncomingMessage()
				delete mockReq.method
				const request = await RoboRequest.from(mockReq)

				expect(request.method).toBe('GET')
			})
		})

		describe('headers', () => {
			it('copies headers from IncomingMessage', async () => {
				const mockReq = createMockIncomingMessage({
					headers: {
						host: 'example.com',
						'content-type': 'application/json',
						authorization: 'Bearer token123'
					}
				})
				const request = await RoboRequest.from(mockReq)

				expect(request.headers.get('content-type')).toBe('application/json')
				expect(request.headers.get('authorization')).toBe('Bearer token123')
			})
		})
	})

	describe('applyParams()', () => {
		it('sets params on the request', async () => {
			const mockReq = createMockIncomingMessage()
			const request = await RoboRequest.from(mockReq)

			applyParams(request, { userId: '456' })

			expect(request.params.userId).toBe('456')
		})

		it('overwrites existing params', async () => {
			const mockReq = createMockIncomingMessage()
			const request = await RoboRequest.from(mockReq)

			applyParams(request, { id: '123' })
			applyParams(request, { id: '456', name: 'test' })

			expect(request.params).toEqual({ id: '456', name: 'test' })
		})
	})

	describe('validateURL()', () => {
		it('returns valid absolute URLs unchanged', () => {
			expect(validateURL('http://example.com/path')).toBe('http://example.com/path')
			expect(validateURL('https://example.com:8080/path?query=1')).toBe('https://example.com:8080/path?query=1')
		})

		it('throws descriptive error for relative URLs', () => {
			expect(() => validateURL('/api/users')).toThrow('URL is malformed')
			expect(() => validateURL('/api/users')).toThrow('Please use only absolute URLs')
		})

		it('throws descriptive error for malformed URLs', () => {
			expect(() => validateURL('not-a-url')).toThrow('URL is malformed')
			expect(() => validateURL('')).toThrow('URL is malformed')
		})

		it('accepts URL objects', () => {
			const url = new URL('http://example.com/test')
			expect(validateURL(url)).toBe('http://example.com/test')
		})
	})
})

describe('RoboResponse', () => {
	describe('constructor', () => {
		it('creates response with string body', () => {
			const response = new RoboResponse('Hello, World!')

			expect(response).toBeInstanceOf(Response)
			expect(response).toBeInstanceOf(RoboResponse)
		})

		it('creates response with init options', () => {
			const response = new RoboResponse('Not Found', {
				status: 404,
				statusText: 'Not Found',
				headers: { 'X-Custom': 'header' }
			})

			expect(response.status).toBe(404)
			expect(response.statusText).toBe('Not Found')
			expect(response.headers.get('X-Custom')).toBe('header')
		})

		it('creates empty response', () => {
			const response = new RoboResponse()

			expect(response.status).toBe(200)
		})

		it('creates response with null body', () => {
			const response = new RoboResponse(null, { status: 204 })

			expect(response.status).toBe(204)
		})
	})

	describe('json() static method', () => {
		it('creates JSON response from object', async () => {
			const response = RoboResponse.json({ message: 'Hello' })

			expect(response).toBeInstanceOf(RoboResponse)
			const body = await response.json()
			expect(body).toEqual({ message: 'Hello' })
		})

		it('creates JSON response from array', async () => {
			const response = RoboResponse.json([1, 2, 3])

			const body = await response.json()
			expect(body).toEqual([1, 2, 3])
		})

		it('creates JSON response from primitive values', async () => {
			const stringResponse = RoboResponse.json('hello')
			const numberResponse = RoboResponse.json(42)
			const boolResponse = RoboResponse.json(true)
			const nullResponse = RoboResponse.json(null)

			expect(await stringResponse.json()).toBe('hello')
			expect(await numberResponse.json()).toBe(42)
			expect(await boolResponse.json()).toBe(true)
			expect(await nullResponse.json()).toBe(null)
		})

		it('sets Content-Type header to application/json', () => {
			const response = RoboResponse.json({ data: true })

			expect(response.headers.get('Content-Type')).toBe('application/json')
		})

		it('respects custom status code in init', () => {
			const response = RoboResponse.json({ created: true }, { status: 201 })

			expect(response.status).toBe(201)
		})

		it('respects custom headers in init', () => {
			const response = RoboResponse.json({ data: true }, {
				headers: { 'X-Request-Id': 'abc123' }
			})

			expect(response.headers.get('X-Request-Id')).toBe('abc123')
			// Should still have Content-Type
			expect(response.headers.get('Content-Type')).toBe('application/json')
		})

		it('creates JSON response from nested objects', async () => {
			const response = RoboResponse.json({
				user: {
					name: 'John',
					address: {
						city: 'NYC'
					}
				},
				tags: ['a', 'b']
			})

			const body = await response.json()
			expect(body.user.address.city).toBe('NYC')
			expect(body.tags).toEqual(['a', 'b'])
		})
	})
})
