/**
 * Testing utilities for @robojs/server
 *
 * This module provides utilities for unit testing API endpoint handlers
 * without launching a server.
 *
 * @example
 * ```typescript
 * import { createTestRequest, testRoute, createTestClient } from '@robojs/server/testing'
 *
 * // Tier 1: Direct request builder
 * import { GET } from '../src/api/users/[id]'
 * const request = createTestRequest({ params: { id: '123' } })
 * const response = await GET(request)
 *
 * // Tier 2: Route module tester
 * import * as usersRoute from '../src/api/users/[id]'
 * const result = await testRoute(usersRoute, { method: 'POST', body: { name: 'John' } })
 *
 * // Tier 3: Fluent test client
 * const client = createTestClient()
 *   .route('users/[id]', usersRoute)
 * const res = await client.get('/users/123')
 * ```
 *
 * @module @robojs/server/testing
 */

export { createTestRequest } from './create-test-request.js'
export { testRoute, testHandler } from './test-route.js'
export { createTestClient } from './test-client.js'

export type {
	TestRequestOptions,
	TestRouteOptions,
	TestRouteResult,
	TestableModule,
	TestClient,
	TestClientRoute
} from './types.js'
