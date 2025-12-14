import { ready, getServerEngine } from '@robojs/server'
import type { NodeEngine } from '@robojs/server/engines.js'
import { getGatewayServer } from '../core/gateway.js'
import { getStageServer } from '../core/stage.js'
import { getStageBridge } from '../core/stage-bridge.js'
import { startVoiceGateway, VOICE_GATEWAY_PORT } from '../core/voice-gateway.js'
import { mockLogger } from '../core/logger.js'

/**
 * Lifecycle hook: Called when the Robo starts
 * Initializes the Gateway WebSocket server, Voice Gateway server, and Stage WebSocket server
 */
export default async () => {
	// Wait for @robojs/server to be ready
	await ready()

	// Get the server engine and register WebSocket handlers
	const engine = getServerEngine<NodeEngine>()
	const gatewayServer = getGatewayServer()
	const stageServer = getStageServer()

	// Register Discord Gateway WebSocket upgrade handler at root path
	// Discord clients connect to: ws://host/?v=10&encoding=json
	engine.registerWebsocket('/', (req, socket, head) => {
		gatewayServer.handleUpgrade(req, socket, head)
	})

	// Register Stage WebSocket upgrade handler
	// Stage clients connect to: ws://host/stage/ws?token=mock:session_xxx
	engine.registerWebsocket('/stage/ws', (req, socket, head) => {
		stageServer.handleUpgrade(req, socket, head)
	})

	// Initialize the stage bridge (connects session events to stage server)
	getStageBridge()

	// Start Voice Gateway server on separate port
	// @discordjs/voice connects to: ws://host:50001/?v=4
	try {
		await startVoiceGateway(VOICE_GATEWAY_PORT)
	} catch (error) {
		// Voice gateway is optional - log warning but don't fail startup
		mockLogger.warn(`Failed to start Voice Gateway: ${(error as Error).message}`)
	}

	mockLogger.info('Gateway WebSocket server ready')
	mockLogger.info('Stage WebSocket server ready')
}
