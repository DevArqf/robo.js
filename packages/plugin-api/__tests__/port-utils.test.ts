/**
 * Tests for Port Utilities
 *
 * Verifies that the port availability checking and automatic port increment
 * functionality works correctly.
 */
import { describe, expect, it, afterEach } from '@jest/globals'
import { createServer, type Server } from 'node:net'
import {
	isPortAvailable,
	findAvailablePort,
	DEFAULT_MAX_PORT_ATTEMPTS
} from '../.robo/build/core/port-utils.js'

// Helper to occupy a port for testing
function occupyPort(port: number, hostname = 'localhost'): Promise<Server> {
	return new Promise((resolve, reject) => {
		const server = createServer()
		server.once('error', reject)
		server.once('listening', () => resolve(server))
		server.listen(port, hostname)
	})
}

// Helper to release a port
function releasePort(server: Server): Promise<void> {
	return new Promise((resolve) => {
		server.close(() => resolve())
	})
}

describe('isPortAvailable', () => {
	let occupiedServer: Server | null = null
	const TEST_PORT = 19876 // Use high port to avoid conflicts

	afterEach(async () => {
		if (occupiedServer) {
			await releasePort(occupiedServer)
			occupiedServer = null
		}
	})

	it('returns true for an available port', async () => {
		const available = await isPortAvailable(TEST_PORT)
		expect(available).toBe(true)
	})

	it('returns false for an occupied port', async () => {
		occupiedServer = await occupyPort(TEST_PORT)
		const available = await isPortAvailable(TEST_PORT)
		expect(available).toBe(false)
	})

	it('respects hostname parameter', async () => {
		// Port available on 127.0.0.1
		const available1 = await isPortAvailable(TEST_PORT, '127.0.0.1')
		expect(available1).toBe(true)

		// Occupy on 127.0.0.1
		occupiedServer = await occupyPort(TEST_PORT, '127.0.0.1')

		// Should be unavailable on 127.0.0.1
		const available2 = await isPortAvailable(TEST_PORT, '127.0.0.1')
		expect(available2).toBe(false)
	})
})

describe('findAvailablePort', () => {
	let occupiedServers: Server[] = []
	const BASE_PORT = 19900

	afterEach(async () => {
		for (const server of occupiedServers) {
			await releasePort(server)
		}
		occupiedServers = []
	})

	it('returns the original port if available', async () => {
		const result = await findAvailablePort({ port: BASE_PORT })

		expect(result.port).toBe(BASE_PORT)
		expect(result.wasIncremented).toBe(false)
		expect(result.originalPort).toBe(BASE_PORT)
	})

	it('increments port when original is in use', async () => {
		occupiedServers.push(await occupyPort(BASE_PORT))

		const result = await findAvailablePort({ port: BASE_PORT })

		expect(result.port).toBe(BASE_PORT + 1)
		expect(result.wasIncremented).toBe(true)
		expect(result.originalPort).toBe(BASE_PORT)
	})

	it('increments multiple times if needed', async () => {
		occupiedServers.push(await occupyPort(BASE_PORT))
		occupiedServers.push(await occupyPort(BASE_PORT + 1))
		occupiedServers.push(await occupyPort(BASE_PORT + 2))

		const result = await findAvailablePort({ port: BASE_PORT })

		expect(result.port).toBe(BASE_PORT + 3)
		expect(result.wasIncremented).toBe(true)
	})

	it('throws error when max attempts exceeded', async () => {
		// Occupy ports BASE_PORT through BASE_PORT + 2
		for (let i = 0; i < 3; i++) {
			occupiedServers.push(await occupyPort(BASE_PORT + i))
		}

		await expect(findAvailablePort({ port: BASE_PORT, maxAttempts: 3 })).rejects.toThrow(
			/Could not find an available port/
		)
	})

	it('uses default maxAttempts when not specified', async () => {
		expect(DEFAULT_MAX_PORT_ATTEMPTS).toBe(10)

		// Occupy 9 ports, should find the 10th
		for (let i = 0; i < 9; i++) {
			occupiedServers.push(await occupyPort(BASE_PORT + i))
		}

		const result = await findAvailablePort({ port: BASE_PORT })
		expect(result.port).toBe(BASE_PORT + 9)
	})

	it('respects hostname parameter', async () => {
		occupiedServers.push(await occupyPort(BASE_PORT, '127.0.0.1'))

		const result = await findAvailablePort({
			port: BASE_PORT,
			hostname: '127.0.0.1'
		})

		expect(result.port).toBe(BASE_PORT + 1)
	})
})

describe('maxPortAttempts config behavior', () => {
	let occupiedServer: Server | null = null
	const TEST_PORT = 19950

	afterEach(async () => {
		if (occupiedServer) {
			await releasePort(occupiedServer)
			occupiedServer = null
		}
	})

	it('maxAttempts of 1 returns original when available', async () => {
		const result = await findAvailablePort({ port: TEST_PORT, maxAttempts: 1 })
		expect(result.port).toBe(TEST_PORT)
		expect(result.wasIncremented).toBe(false)
	})

	it('maxAttempts of 1 throws when port is in use (disables increment)', async () => {
		occupiedServer = await occupyPort(TEST_PORT)

		await expect(findAvailablePort({ port: TEST_PORT, maxAttempts: 1 })).rejects.toThrow(
			/Could not find an available port after 1 attempts/
		)
	})

	it('maxAttempts of 0 throws immediately', async () => {
		await expect(findAvailablePort({ port: TEST_PORT, maxAttempts: 0 })).rejects.toThrow(
			/Could not find an available port after 0 attempts/
		)
	})
})
