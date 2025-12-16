import type { RoboRequest } from '@robojs/server'
import { readRegistry } from '../../../session/registry.js'
import { validateMethod } from '../utils.js'

/**
 * GET /api/control/tests/registry - Get the current test session registry
 *
 * Response:
 * {
 *   registry: TestSessionRegistry | null
 * }
 */
export default async (request: RoboRequest) => {
	validateMethod(request, ['GET'])

	const registry = readRegistry()

	return {
		registry
	}
}
