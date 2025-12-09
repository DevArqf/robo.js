import { logger } from 'robo.js'

/**
 * Custom start hook to ensure sync WebSocket handler is registered
 * This works around the sync plugin start hook timeout issue
 */
export default async () => {
	try {
		logger.info('Manually registering sync WebSocket handler...')

		// Import sync server and server engine
		const { SyncServer } = await import('@robojs/sync/server')
		const { getServerEngine } = await import('@robojs/server')

		// Get the WebSocket server
		const wss = SyncServer.getSocketServer()

		if (!wss) {
			logger.warn('Sync WebSocket server not initialized, attempting to start...')
			SyncServer.start()
		}

		// Register the WebSocket handler with the HTTP server
		const engine = getServerEngine()

		// Check if handler is already registered
		engine.registerWebsocket('/sync', (req, socket, head) => {
			const socketServer = SyncServer.getSocketServer()
			socketServer?.handleUpgrade(req, socket, head, (ws) => {
				socketServer?.emit('connection', ws, req)
			})
		})

		logger.ready('Sync WebSocket handler registered successfully at /sync')
	} catch (error) {
		logger.error('Failed to register sync WebSocket handler:', error)
	}
}
