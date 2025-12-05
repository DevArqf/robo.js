import { RoboRequest } from '../core/robo-request.js'
import type { TestRequestOptions } from './types.js'

/**
 * Creates a RoboRequest suitable for testing API handlers.
 * This is a convenience wrapper around RoboRequest.forTesting().
 *
 * @example
 * ```typescript
 * import { createTestRequest } from '@robojs/server/testing'
 * import { GET } from '../src/api/users/[id]'
 *
 * const request = createTestRequest({
 *   params: { id: '123' },
 *   query: { include: 'profile' }
 * })
 * const response = await GET(request)
 * ```
 */
export function createTestRequest(options: TestRequestOptions = {}): RoboRequest {
	return RoboRequest.forTesting(options)
}
