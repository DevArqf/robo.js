/**
 * Registering process events ensure the "ready" signal is sent to the parent process.
 * Not doing this may cause the process to hang if any setup causes an error.
 * It's just as important to be able to receive messages from the parent process quickly.
 *
 * Note:
 * - Development mode waits for these events to be registered prior to continuing listening for changes.
 * - Imports are done inline to avoid potential crashes due to errors in them.
 */
export function registerProcessEvents() {
	process.on('SIGINT', async () => {
		const { logger } = await import('./logger.js')
		const { Robo } = await import('./robo.js')

		logger.debug('Received SIGINT signal.')
		Robo.stop()
	})

	process.on('SIGTERM', async () => {
		const { logger } = await import('./logger.js')
		const { Robo } = await import('./robo.js')

		logger.debug('Received SIGTERM signal.')
		Robo.stop()
	})

	process.on('unhandledRejection', async (reason) => {
		const { env } = await import('./env.js')
		const { logger } = await import('./logger.js')
		const { handleUnhandledError, Robo } = await import('./robo.js')
		logger.error(reason)

		// Execute error hooks (blocking with timeout)
		await handleUnhandledError(reason, 'unhandledRejection')

		// Log error and ignore it in production
		if (env.get('nodeEnv') === 'production') {
			return
		}

		// Development mode: stop the process on unhandled rejections
		// Platform-specific error handling (like Discord debug channels) should be handled by plugins
		Robo.stop(1)
	})

	process.on('uncaughtException', async (error) => {
		const { logger } = await import('./logger.js')
		const { handleUnhandledError, Robo } = await import('./robo.js')
		logger.error(error)

		// Execute error hooks (blocking with timeout)
		await handleUnhandledError(error, 'uncaughtException')

		// Always exit on uncaught exceptions after hooks run
		Robo.stop(1)
	})

	// Tell the parent process we're ready to receive messages
	if (typeof process.send === 'function') {
		process.send?.({ type: 'ready' })
	}

	// Backup message with delay to prevent race conditions
	setTimeout(() => {
		if (typeof process.send === 'function') {
			process.send?.({ type: 'ready', delayed: true })
		}
	}, 1_000)
}
