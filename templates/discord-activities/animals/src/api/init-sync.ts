import { RoboResponse } from '@robojs/server'
import { logger } from 'robo.js'
import type { RoboRequest } from '@robojs/server'

let isRegistered = false

/**
 * Endpoint to manually initialize sync WebSocket handler
 * This works around the sync plugin start hook timeout issue
 */
export default async (req: RoboRequest) => {
	if (isRegistered) {
		return RoboResponse.json({ success: true, message: 'Already registered' })
	}

	try {
		logger.info('[init-sync] Registering sync WebSocket handler...')

		// Import required modules
		const { SyncServer } = await import('@robojs/sync/server')
		const { getServerEngine } = await import('@robojs/server')

		// Get server engine
		const engine = getServerEngine()
		if (!engine) {
			throw new Error('Server engine not available')
		}

		// Start sync server if not started
		let wss = SyncServer.getSocketServer()
		if (!wss) {
			logger.info('[init-sync] Starting sync WebSocket server...')
			SyncServer.start()
			wss = SyncServer.getSocketServer()
		}

		if (!wss) {
			throw new Error('Failed to start sync WebSocket server')
		}

		// Register WebSocket handler
		engine.registerWebsocket('/sync', (req, socket, head) => {
			const socketServer = SyncServer.getSocketServer()
			if (socketServer) {
				socketServer.handleUpgrade(req, socket, head, (ws) => {
					socketServer.emit('connection', ws, req)
				})
			}
		})

		isRegistered = true
		logger.ready('[init-sync] Sync WebSocket handler registered successfully at /sync ✅')

		return RoboResponse.json({
			success: true,
			message: 'Sync WebSocket handler registered successfully'
		})
	} catch (error) {
		logger.error('[init-sync] Failed to register sync handler:', error)
		return RoboResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		)
	}
}
