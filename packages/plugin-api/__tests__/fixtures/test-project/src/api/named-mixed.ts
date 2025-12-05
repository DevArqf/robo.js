/**
 * Test route: Named GET + default fallback
 * - GET should use named export
 * - POST/PUT/DELETE should use default fallback
 */
import type { RoboRequest } from '@robojs/server'

export function GET() {
	return { method: 'GET', handler: 'named' }
}

export default (request: RoboRequest) => {
	return { method: request.method, handler: 'default' }
}
