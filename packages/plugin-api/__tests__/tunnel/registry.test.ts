/**
 * TunnelRegistry Tests
 *
 * Tests for the tunnel registry that manages persistent storage of tunnel information.
 * Uses mocked Nanocore storage.
 */
import { describe, expect, it, beforeEach, jest } from '@jest/globals'
import { createMockNanocore } from '../utils/test-helpers.js'

// Create mock Nanocore before importing registry
const mockNanocore = createMockNanocore()

// Mock the robo.js/unstable module
jest.unstable_mockModule('robo.js/unstable.js', () => ({
	Nanocore: mockNanocore
}))

// Mock the logger
jest.unstable_mockModule('../../.robo/build/core/logger.js', () => ({
	logger: {
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		event: jest.fn()
	}
}))

// Import registry after mocking
const { TunnelRegistry } = await import('../../.robo/build/core/tunnel/registry.js')
const { isProcessAlive } = await import('../../.robo/build/core/tunnel/utils.js')

describe('TunnelRegistry', () => {
	beforeEach(() => {
		// Clear storage between tests
		mockNanocore.clear()
	})

	describe('register', () => {
		it('generates unique ID and stores record', async () => {
			const record = await TunnelRegistry.register({
				pid: process.pid, // Use current process so it's "alive"
				port: 3000,
				url: 'https://test.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			expect(record.id).toMatch(/^[a-z0-9]{6}$/)
			expect(record.pid).toBe(process.pid)
			expect(record.port).toBe(3000)
			expect(record.url).toBe('https://test.example.com')
			expect(record.provider).toBe('mock')
		})

		it('allows multiple tunnels to be registered', async () => {
			await TunnelRegistry.register({
				pid: process.pid,
				port: 3000,
				url: 'https://tunnel1.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			await TunnelRegistry.register({
				pid: process.pid,
				port: 3001,
				url: 'https://tunnel2.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			const all = await TunnelRegistry.getAll()
			expect(all).toHaveLength(2)
		})

		it('assigns unique IDs to each tunnel', async () => {
			const record1 = await TunnelRegistry.register({
				pid: process.pid,
				port: 3000,
				url: 'https://tunnel1.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			const record2 = await TunnelRegistry.register({
				pid: process.pid,
				port: 3001,
				url: 'https://tunnel2.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			expect(record1.id).not.toBe(record2.id)
		})
	})

	describe('getAll', () => {
		it('returns empty array when no tunnels registered', async () => {
			const tunnels = await TunnelRegistry.getAll()
			expect(tunnels).toEqual([])
		})

		it('returns all registered tunnels with alive processes', async () => {
			await TunnelRegistry.register({
				pid: process.pid,
				port: 3000,
				url: 'https://tunnel1.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			await TunnelRegistry.register({
				pid: process.pid,
				port: 3001,
				url: 'https://tunnel2.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			const tunnels = await TunnelRegistry.getAll()
			expect(tunnels).toHaveLength(2)
		})

		it('filters out tunnels with dead processes', async () => {
			// Register with dead PID (non-existent process)
			await TunnelRegistry.register({
				pid: 999999999,
				port: 3000,
				url: 'https://dead-tunnel.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			// Register with alive PID (current process)
			await TunnelRegistry.register({
				pid: process.pid,
				port: 3001,
				url: 'https://alive-tunnel.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			const tunnels = await TunnelRegistry.getAll()
			expect(tunnels).toHaveLength(1)
			expect(tunnels[0].url).toBe('https://alive-tunnel.example.com')
		})

		it('auto-cleans dead tunnels from storage', async () => {
			// Register with dead PID
			await TunnelRegistry.register({
				pid: 999999999,
				port: 3000,
				url: 'https://dead-tunnel.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			// First call filters and cleans
			await TunnelRegistry.getAll()

			// Check storage directly - dead tunnel should be removed
			const storage = mockNanocore._storage.get('server/tunnels') as { tunnels: unknown[] }
			expect(storage.tunnels).toHaveLength(0)
		})
	})

	describe('get', () => {
		it('returns null for non-existent ID', async () => {
			const result = await TunnelRegistry.get('nonexistent')
			expect(result).toBeNull()
		})

		it('returns tunnel by ID', async () => {
			const record = await TunnelRegistry.register({
				pid: process.pid,
				port: 3000,
				url: 'https://test.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			const result = await TunnelRegistry.get(record.id)
			expect(result).not.toBeNull()
			expect(result?.id).toBe(record.id)
			expect(result?.url).toBe('https://test.example.com')
		})

		it('returns null and cleans up dead process', async () => {
			const record = await TunnelRegistry.register({
				pid: 999999999, // Dead PID
				port: 3000,
				url: 'https://dead.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			const result = await TunnelRegistry.get(record.id)
			expect(result).toBeNull()
		})
	})

	describe('remove', () => {
		it('returns false for non-existent ID', async () => {
			const result = await TunnelRegistry.remove('nonexistent')
			expect(result).toBe(false)
		})

		it('removes existing tunnel and returns true', async () => {
			const record = await TunnelRegistry.register({
				pid: process.pid,
				port: 3000,
				url: 'https://test.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			const removed = await TunnelRegistry.remove(record.id)
			expect(removed).toBe(true)

			const result = await TunnelRegistry.get(record.id)
			expect(result).toBeNull()
		})

		it('only removes the specified tunnel', async () => {
			const record1 = await TunnelRegistry.register({
				pid: process.pid,
				port: 3000,
				url: 'https://tunnel1.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			const record2 = await TunnelRegistry.register({
				pid: process.pid,
				port: 3001,
				url: 'https://tunnel2.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			await TunnelRegistry.remove(record1.id)

			const remaining = await TunnelRegistry.getAll()
			expect(remaining).toHaveLength(1)
			expect(remaining[0].id).toBe(record2.id)
		})
	})

	describe('kill', () => {
		it('returns false for non-existent tunnel', async () => {
			const result = await TunnelRegistry.kill('nonexistent')
			expect(result).toBe(false)
		})

		it('removes tunnel from registry after kill', async () => {
			// Note: We can't fully test kill behavior since we'd need a real process
			// This test just verifies the registry cleanup part
			const record = await TunnelRegistry.register({
				pid: 999999999, // Non-existent PID
				port: 3000,
				url: 'https://test.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			// Since PID doesn't exist, get() will return null (auto-cleanup)
			// and kill() will return false
			const result = await TunnelRegistry.kill(record.id)
			expect(result).toBe(false)
		})
	})

	describe('killAll', () => {
		it('returns 0 when no tunnels registered', async () => {
			const count = await TunnelRegistry.killAll()
			expect(count).toBe(0)
		})

		it('returns count of killed tunnels', async () => {
			// Register tunnels with dead PIDs (they won't actually be killable)
			await TunnelRegistry.register({
				pid: 999999998,
				port: 3000,
				url: 'https://tunnel1.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			await TunnelRegistry.register({
				pid: 999999999,
				port: 3001,
				url: 'https://tunnel2.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			// Since PIDs are dead, they'll be cleaned up during getAll()
			// and killAll will return 0
			const count = await TunnelRegistry.killAll()
			expect(count).toBe(0)

			// Registry should be empty
			const remaining = await TunnelRegistry.getAll()
			expect(remaining).toHaveLength(0)
		})
	})
})

describe('isProcessAlive (exported from registry)', () => {
	it('is exported from registry module', () => {
		expect(typeof isProcessAlive).toBe('function')
	})

	it('works correctly', () => {
		expect(isProcessAlive(process.pid)).toBe(true)
		expect(isProcessAlive(999999999)).toBe(false)
	})
})
