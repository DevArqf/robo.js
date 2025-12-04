import { SessionManager } from '../session/manager.js'
import { mockLogger } from './logger.js'

/**
 * Lazy singleton session manager instance
 * Initialized on first access to avoid issues during build
 */
let _sessionManager: SessionManager | null = null
let _cleanupRegistered = false

function getSessionManager(): SessionManager {
	if (!_sessionManager) {
		_sessionManager = new SessionManager()
		registerCleanupHandlers()
	}
	return _sessionManager
}

/**
 * Convenience accessor for the session manager singleton
 * Used by the Control API and other components
 */
export const sessionManager = {
	create: (...args: Parameters<SessionManager['create']>) => getSessionManager().create(...args),
	get: (...args: Parameters<SessionManager['get']>) => getSessionManager().get(...args),
	getByToken: (...args: Parameters<SessionManager['getByToken']>) => getSessionManager().getByToken(...args),
	delete: (...args: Parameters<SessionManager['delete']>) => getSessionManager().delete(...args),
	getAll: () => getSessionManager().getAll(),
	get size() {
		return _sessionManager?.size ?? 0
	},
	destroy: () => _sessionManager?.destroy() ?? Promise.resolve()
}

// Handle graceful shutdown
async function cleanup() {
	if (_sessionManager) {
		mockLogger.info('Shutting down session manager...')
		await _sessionManager.destroy()
		_sessionManager = null
	}
}

// Register cleanup handlers (only once, only in runtime)
function registerCleanupHandlers() {
	if (_cleanupRegistered) return
	if (typeof process === 'undefined') return
	if (process.env?.NODE_ENV === 'test') return

	_cleanupRegistered = true

	process.on('SIGINT', async () => {
		await cleanup()
		process.exit(0)
	})

	process.on('SIGTERM', async () => {
		await cleanup()
		process.exit(0)
	})
}
