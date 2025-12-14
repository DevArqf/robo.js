/**
 * Jest Global Setup for Integration Tests
 *
 * Starts the @robojs/mock server before any integration tests run.
 * The server runs for the entire test suite and is shared across all test files.
 */
const { spawn } = require('node:child_process')

// Allow self-signed certificates for voice gateway testing
// This must be set before any TLS connections are made
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const SERVER_PORT = process.env.MOCK_PORT || 3000
const SERVER_STARTUP_TIMEOUT = 30000

/**
 * Start the Robo server and wait for it to be ready
 */
async function startServer() {
	return new Promise((resolve, reject) => {
		console.log('\n[Global Setup] Starting mock server...')

		// Use 'robo dev' for development mode
		const proc = spawn('npx', ['robo', 'dev'], {
			cwd: __dirname.replace('/__tests__/integration', ''),
			stdio: ['pipe', 'pipe', 'pipe'],
			env: {
				...process.env,
				PORT: String(SERVER_PORT),
				FORCE_COLOR: '0'
			},
			shell: true
		})

		let output = ''
		const timeout = setTimeout(() => {
			proc.kill()
			reject(new Error(`Server failed to start within ${SERVER_STARTUP_TIMEOUT}ms. Output:\n${output}`))
		}, SERVER_STARTUP_TIMEOUT)

		proc.stdout?.on('data', (data) => {
			output += data.toString()
			// Server is ready when we see the gateway message or server ready message
			if (output.includes('Gateway WebSocket server ready') || output.includes('Ready!') || output.includes('Server is live')) {
				clearTimeout(timeout)
				console.log('[Global Setup] Mock server started successfully')
				resolve(proc)
			}
		})

		proc.stderr?.on('data', (data) => {
			output += data.toString()
		})

		proc.on('error', (err) => {
			clearTimeout(timeout)
			reject(err)
		})

		proc.on('exit', (code) => {
			if (code !== 0 && code !== null) {
				clearTimeout(timeout)
				reject(new Error(`Server exited with code ${code}. Output:\n${output}`))
			}
		})
	})
}

module.exports = async () => {
	// Start the server
	const serverProcess = await startServer()

	// Store the server process globally so teardown can access it
	globalThis.__MOCK_SERVER_PROCESS__ = serverProcess

	// Wait a bit for the server to fully initialize
	await new Promise((resolve) => setTimeout(resolve, 500))
}
