/**
 * Manual mock for @robojs/server module used by @robojs/sync tests.
 *
 * Provides mock implementations for server engine and ready function.
 */

import { jest } from '@jest/globals'

// Store registered websocket handlers for testing
export const registeredWebsockets: Map<string, (req: unknown, socket: unknown, head: unknown) => void> = new Map()

// Mock server engine
const mockEngine = {
	registerWebsocket: jest.fn((path: string, handler: (req: unknown, socket: unknown, head: unknown) => void) => {
		registeredWebsockets.set(path, handler)
	})
}

export const getServerEngine = jest.fn(() => mockEngine)

// Mock NodeEngine class
export class NodeEngine {
	registerWebsocket = mockEngine.registerWebsocket
}

// Mock ready function - resolves immediately
export const ready = jest.fn(() => Promise.resolve())

// Helper to reset mocks between tests
export function resetServerMocks(): void {
	registeredWebsockets.clear()
	jest.clearAllMocks()
}

export default { getServerEngine, NodeEngine, ready }
