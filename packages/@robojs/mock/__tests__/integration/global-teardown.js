/**
 * Jest Global Teardown for Integration Tests
 *
 * Stops the @robojs/mock server after all integration tests have completed.
 */

module.exports = async () => {
	const serverProcess = globalThis.__MOCK_SERVER_PROCESS__

	if (serverProcess) {
		console.log('\n[Global Teardown] Stopping mock server...')

		// Send SIGTERM to gracefully stop the server
		serverProcess.kill('SIGTERM')

		// Wait for the process to exit (with timeout)
		await new Promise((resolve) => {
			const timeout = setTimeout(() => {
				// Force kill if graceful shutdown takes too long
				serverProcess.kill('SIGKILL')
				resolve()
			}, 5000)

			serverProcess.on('exit', () => {
				clearTimeout(timeout)
				resolve()
			})
		})

		console.log('[Global Teardown] Mock server stopped')
	}
}
