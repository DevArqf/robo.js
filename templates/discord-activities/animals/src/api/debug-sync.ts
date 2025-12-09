import { RoboResponse } from '@robojs/server'
import type { RoboRequest } from '@robojs/server'

/**
 * Debug endpoint to check if sync WebSocket is registered
 */
export default async (req: RoboRequest) => {
	try {
		// Try to import sync server to see if it's initialized
		const { SyncServer } = await import('@robojs/sync/server')
		const wss = SyncServer.getSocketServer()

		return RoboResponse.json({
			syncServerExists: !!SyncServer,
			websocketServerExists: !!wss,
			websocketServerListening: wss ? true : false
		})
	} catch (error) {
		return RoboResponse.json({
			error: error instanceof Error ? error.message : 'Unknown error',
			syncServerExists: false
		})
	}
}
