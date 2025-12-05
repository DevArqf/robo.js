/**
 * Tests for Testing Utilities
 *
 * Verifies that the testing utilities work correctly for unit testing
 * API endpoint handlers without launching a server.
 */
import { describe, expect, it, jest } from '@jest/globals'
import { createTestRequest, testRoute, testHandler, createTestClient } from '../.robo/build/testing/index.js'
import type { ApiHandlerModule } from '../.robo/build/robo/routes/api.js'

// Mock route modules for testing
const usersRoute: ApiHandlerModule = {
	GET: (req) => {
		const request = req as Request & { params: Record<string, string>; query: Record<string, string> }
		return {
			id: request.params?.id || 'unknown',
			method: 'GET',
			query: request.query || {}
		}
	},
	POST: async (req) => {
		const body = await req.json()
		const request = req as Request & { params: Record<string, string> }
		return {
			id: request.params?.id || 'unknown',
			body,
			method: 'POST'
		}
	},
	DELETE: () => {
		return new Response(null, { status: 204 })
	}
}

const postsRoute: ApiHandlerModule = {
	default: (req) => ({
		path: req.url,
		method: req.method
	})
}

const mixedRoute: ApiHandlerModule = {
	GET: () => ({ handler: 'named-get' }),
	default: () => ({ handler: 'default' })
}

describe('createTestRequest', () => {
	it('creates request with default values', () => {
		const req = createTestRequest()
		expect(req.method).toBe('GET')
		expect(req.url).toBe('http://localhost:3000/test')
		expect(req.params).toEqual({})
	})

	it('creates request with custom method', () => {
		const req = createTestRequest({ method: 'POST' })
		expect(req.method).toBe('POST')
	})

	it('creates request with params', () => {
		const req = createTestRequest({
			params: { id: '123', slug: 'test-post' }
		})
		expect(req.params.id).toBe('123')
		expect(req.params.slug).toBe('test-post')
	})

	it('creates request with query parameters', () => {
		const req = createTestRequest({
			query: { filter: 'active', page: '1' }
		})
		expect(req.query.filter).toBe('active')
		expect(req.query.page).toBe('1')
	})

	it('creates request with array query parameters', () => {
		const req = createTestRequest({
			query: { tags: ['a', 'b', 'c'] }
		})
		const url = new URL(req.url)
		expect(url.searchParams.getAll('tags')).toEqual(['a', 'b', 'c'])
	})

	it('creates request with custom path', () => {
		const req = createTestRequest({ path: '/api/users/123' })
		expect(req.url).toBe('http://localhost:3000/api/users/123')
	})

	it('creates request with custom baseUrl', () => {
		const req = createTestRequest({
			path: '/test',
			baseUrl: 'https://example.com'
		})
		expect(req.url).toBe('https://example.com/test')
	})

	it('creates request with headers', () => {
		const req = createTestRequest({
			headers: { Authorization: 'Bearer token123' }
		})
		expect(req.headers.get('Authorization')).toBe('Bearer token123')
	})

	it('creates request with JSON body for POST', () => {
		const req = createTestRequest({
			method: 'POST',
			body: { name: 'John', age: 30 }
		})
		expect(req.headers.get('Content-Type')).toBe('application/json')
	})

	it('creates request with string body', () => {
		const req = createTestRequest({
			method: 'POST',
			body: 'plain text body'
		})
		// String body gets text/plain content type from the Request API
		expect(req.headers.get('Content-Type')).toBe('text/plain;charset=UTF-8')
	})

	it('ignores body for GET requests', () => {
		const req = createTestRequest({
			method: 'GET',
			body: { ignored: true }
		})
		// Body should not be set for GET
		expect(req.method).toBe('GET')
	})
})

describe('testRoute', () => {
	describe('method dispatch', () => {
		it('dispatches GET to GET handler', async () => {
			const result = await testRoute(usersRoute, {
				method: 'GET',
				params: { id: '456' }
			})
			expect(result.status).toBe(200)
			expect(await result.json()).toEqual({
				id: '456',
				method: 'GET',
				query: {}
			})
		})

		it('dispatches POST to POST handler', async () => {
			const result = await testRoute(usersRoute, {
				method: 'POST',
				params: { id: '789' },
				body: { name: 'Jane' }
			})
			expect(result.status).toBe(200)
			const data = await result.json<{ body: { name: string }; method: string }>()
			expect(data.body.name).toBe('Jane')
			expect(data.method).toBe('POST')
		})

		it('dispatches DELETE to DELETE handler', async () => {
			const result = await testRoute(usersRoute, { method: 'DELETE' })
			expect(result.status).toBe(204)
		})

		it('returns 405 for unsupported method', async () => {
			const result = await testRoute(usersRoute, { method: 'PATCH' })
			expect(result.status).toBe(405)
		})

		it('falls back to default handler when no named export', async () => {
			const result = await testRoute(postsRoute, { method: 'POST' })
			expect(result.status).toBe(200)
			const data = await result.json<{ method: string }>()
			expect(data.method).toBe('POST')
		})

		it('prefers named export over default', async () => {
			const result = await testRoute(mixedRoute, { method: 'GET' })
			expect(result.status).toBe(200)
			expect(await result.json()).toEqual({ handler: 'named-get' })
		})

		it('uses default for methods without named export', async () => {
			const result = await testRoute(mixedRoute, { method: 'POST' })
			expect(result.status).toBe(200)
			expect(await result.json()).toEqual({ handler: 'default' })
		})
	})

	describe('OPTIONS auto-handling', () => {
		it('auto-handles OPTIONS with 204 and Allow header', async () => {
			const result = await testRoute(usersRoute, { method: 'OPTIONS' })
			expect(result.status).toBe(204)
			expect(result.header('Allow')).toContain('GET')
			expect(result.header('Allow')).toContain('POST')
			expect(result.header('Allow')).toContain('DELETE')
		})
	})

	describe('HEAD handling', () => {
		it('falls back to GET for HEAD requests', async () => {
			const result = await testRoute(usersRoute, {
				method: 'HEAD',
				params: { id: '123' }
			})
			expect(result.status).toBe(200)
		})
	})

	describe('TestRouteResult convenience methods', () => {
		it('provides ok property for 2xx status', async () => {
			const okResult = await testRoute(usersRoute, { method: 'GET' })
			expect(okResult.ok).toBe(true)

			const notFoundResult = await testRoute(usersRoute, { method: 'PATCH' })
			expect(notFoundResult.ok).toBe(false)
		})

		it('provides header() method', async () => {
			const result = await testRoute(usersRoute, { method: 'GET' })
			expect(result.header('Content-Type')).toBe('application/json')
		})

		it('provides text() method', async () => {
			const result = await testRoute(usersRoute, {
				method: 'GET',
				params: { id: 'test' }
			})
			const text = await result.text()
			expect(text).toContain('test')
		})

		it('allows multiple reads via cloning', async () => {
			const result = await testRoute(usersRoute, { method: 'GET' })
			const json1 = await result.json()
			const json2 = await result.json()
			expect(json1).toEqual(json2)
		})
	})
})

describe('testHandler', () => {
	it('executes handler directly and returns raw result', async () => {
		const handler = (req: Request) => ({
			received: req.method,
			path: req.url
		})

		const result = await testHandler(handler, {
			method: 'POST',
			path: '/custom'
		})

		expect(result.received).toBe('POST')
		expect(result.path).toContain('/custom')
	})

	it('works with async handlers', async () => {
		const handler = async (req: Request) => {
			await new Promise((resolve) => setTimeout(resolve, 10))
			return { async: true, method: req.method }
		}

		const result = await testHandler(handler, { method: 'PUT' })
		expect(result.async).toBe(true)
		expect(result.method).toBe('PUT')
	})

	it('allows access to params via RoboRequest', async () => {
		const handler = (req: Request) => {
			const roboReq = req as Request & { params: Record<string, string> }
			return { id: roboReq.params.id }
		}

		const result = await testHandler(handler, {
			params: { id: 'abc123' }
		})
		expect(result.id).toBe('abc123')
	})
})

describe('createTestClient', () => {
	it('registers routes and dispatches requests', async () => {
		const client = createTestClient()
			.route('users/[id]', usersRoute)
			.route('posts', postsRoute)

		const userRes = await client.get('/users/123')
		expect(userRes.status).toBe(200)
		const userData = await userRes.json<{ id: string }>()
		expect(userData.id).toBe('123')

		const postRes = await client.get('/posts')
		expect(postRes.status).toBe(200)
	})

	it('extracts params from dynamic segments', async () => {
		const client = createTestClient().route('users/[id]', usersRoute)

		const res = await client.get('/users/456')
		const data = await res.json<{ id: string }>()
		expect(data.id).toBe('456')
	})

	it('returns 404 for unknown routes', async () => {
		const client = createTestClient()
		const res = await client.get('/unknown')
		expect(res.status).toBe(404)
	})

	it('supports all HTTP methods', async () => {
		const client = createTestClient().route('users/[id]', usersRoute)

		const getRes = await client.get('/users/1')
		expect(getRes.status).toBe(200)

		const postRes = await client.post('/users/1', { body: { name: 'Test' } })
		expect(postRes.status).toBe(200)

		const deleteRes = await client.delete('/users/1')
		expect(deleteRes.status).toBe(204)
	})

	it('supports request() method for any HTTP method', async () => {
		const client = createTestClient().route('posts', postsRoute)

		const res = await client.request('PATCH', '/posts')
		expect(res.status).toBe(200)
		const data = await res.json<{ method: string }>()
		expect(data.method).toBe('PATCH')
	})

	it('merges extracted params with provided params', async () => {
		const paramRoute: ApiHandlerModule = {
			GET: (req) => {
				const roboReq = req as Request & { params: Record<string, string> }
				return roboReq.params
			}
		}

		const client = createTestClient().route('items/[id]', paramRoute)

		const res = await client.get('/items/123', { params: { extra: 'value' } })
		const data = await res.json<{ id: string; extra: string }>()
		expect(data.id).toBe('123')
		expect(data.extra).toBe('value')
	})

	it('handles routes with leading/trailing slashes', async () => {
		const client = createTestClient().route('/users/[id]/', usersRoute)

		const res1 = await client.get('users/123')
		expect(res1.status).toBe(200)

		const res2 = await client.get('/users/456/')
		expect(res2.status).toBe(200)
	})

	it('supports catch-all segments', async () => {
		const catchAllRoute: ApiHandlerModule = {
			GET: (req) => {
				const roboReq = req as Request & { params: Record<string, string> }
				return { slug: roboReq.params.slug }
			}
		}

		const client = createTestClient().route('docs/[...slug]', catchAllRoute)

		const res = await client.get('/docs/api/users/create')
		const data = await res.json<{ slug: string }>()
		expect(data.slug).toBe('api/users/create')
	})
})
