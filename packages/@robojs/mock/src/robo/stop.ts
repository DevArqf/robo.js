import { closeGatewayServer } from '../core/gateway.js'
import { closeStageServer } from '../core/stage.js'
import { resetStageBridge } from '../core/stage-bridge.js'
import { sessionManager } from '../core/manager.js'
import { mockLogger } from '../core/logger.js'

/**
 * Lifecycle hook: Called when the Robo stops
 * Gracefully shuts down the Gateway server, Stage server, and cleans up sessions
 */
export default async () => {
	mockLogger.info('Shutting down mock server...')

	// Close the Stage WebSocket server
	closeStageServer()
	resetStageBridge()

	// Close the Gateway WebSocket server
	closeGatewayServer()

	// Destroy all sessions
	await sessionManager.destroy()

	mockLogger.info('Mock server stopped')
}
