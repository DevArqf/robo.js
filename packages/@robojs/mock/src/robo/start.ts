import { ready, getServerEngine } from '@robojs/server'
import type { NodeEngine } from '@robojs/server/engines.js'
import { getGatewayServer } from '../core/gateway.js'
import { mockLogger } from '../core/logger.js'

/**
 * Lifecycle hook: Called when the Robo starts
 * Initializes the Gateway WebSocket server
 */
export default async () => {
	// Wait for @robojs/server to be ready
	await ready()

	// Get the server engine and register WebSocket handler
	const engine = getServerEngine<NodeEngine>()
	const gatewayServer = getGatewayServer()

	// Register WebSocket upgrade handler at root path
	// Discord clients connect to: ws://host/?v=10&encoding=json
	engine.registerWebsocket('/', (req, socket, head) => {
		gatewayServer.handleUpgrade(req, socket, head)
	})

	mockLogger.info('Gateway WebSocket server ready')
}
