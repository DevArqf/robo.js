/**
 * Port Utilities
 *
 * Provides utilities for checking port availability and finding available ports.
 * Used by the server to automatically increment ports when the configured port is in use.
 */
import { createServer, type Server } from 'node:net'
import { logger } from './logger.js'

/**
 * Default maximum number of port increment attempts
 */
export const DEFAULT_MAX_PORT_ATTEMPTS = 10

/**
 * Options for finding an available port
 */
export interface FindAvailablePortOptions {
	/** Starting port number */
	port: number
	/** Hostname to check (defaults to 'localhost') */
	hostname?: string
	/** Maximum number of ports to try (defaults to 10) */
	maxAttempts?: number
}

/**
 * Result of finding an available port
 */
export interface FindAvailablePortResult {
	/** The available port that was found */
	port: number
	/** Whether the port was incremented from the original */
	wasIncremented: boolean
	/** Original port that was requested */
	originalPort: number
}

/**
 * Check if a specific port is available on the given hostname
 *
 * @param port - Port number to check
 * @param hostname - Hostname to bind to (defaults to 'localhost')
 * @returns Promise<boolean> - true if port is available, false if in use
 */
export function isPortAvailable(port: number, hostname = 'localhost'): Promise<boolean> {
	return new Promise((resolve) => {
		const server: Server = createServer()

		server.once('error', (err: NodeJS.ErrnoException) => {
			if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
				resolve(false)
			} else {
				// For other errors, assume port is not available
				resolve(false)
			}
		})

		server.once('listening', () => {
			server.close(() => {
				resolve(true)
			})
		})

		server.listen(port, hostname)
	})
}

/**
 * Find an available port, starting from the given port and incrementing if necessary
 *
 * @param options - Options for finding the port
 * @returns Promise with the available port information
 * @throws Error if no available port found within maxAttempts
 */
export async function findAvailablePort(options: FindAvailablePortOptions): Promise<FindAvailablePortResult> {
	const { port: startPort, hostname = 'localhost', maxAttempts = DEFAULT_MAX_PORT_ATTEMPTS } = options

	let currentPort = startPort

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const available = await isPortAvailable(currentPort, hostname)

		if (available) {
			const wasIncremented = currentPort !== startPort

			if (wasIncremented) {
				logger.warn(`Port ${startPort} is in use. Using port ${currentPort} instead.`)
			}

			return {
				port: currentPort,
				wasIncremented,
				originalPort: startPort
			}
		}

		currentPort++
	}

	throw new Error(
		`Could not find an available port after ${maxAttempts} attempts. ` +
			`Ports ${startPort}-${startPort + maxAttempts - 1} are all in use.`
	)
}
