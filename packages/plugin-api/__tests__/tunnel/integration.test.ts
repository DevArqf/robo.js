/**
 * Integration Tests for Tunnel CLI
 *
 * Tests full lifecycle scenarios using MockTunnelProvider.
 * Verifies that start → list → stop workflows work correctly.
 */
import { describe, expect, it, beforeEach, jest, afterEach } from '@jest/globals'
import { createMockNanocore, createMockLogger } from '../utils/test-helpers.js'
import { MockTunnelProvider } from '../../.robo/build/core/tunnel/providers/mock.js'

// Create shared mock instances
const mockNanocore = createMockNanocore()
const mockProvider = new MockTunnelProvider()

// Mock process.exit to throw instead of terminating
const mockExit = (code?: number) => {
	throw new Error(`process.exit(${code}) called`)
}

// Mock robo.js/unstable.js for Nanocore
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
		event: jest.fn(),
		ready: jest.fn()
	}
}))

// Mock CloudflareProvider to use MockTunnelProvider
jest.unstable_mockModule('../../.robo/build/core/tunnel/providers/cloudflare.js', () => ({
	CloudflareProvider: jest.fn(() => mockProvider)
}))

// Import after mocking
const { TunnelRegistry } = await import('../../.robo/build/core/tunnel/registry.js')

// Helper to create CLI context with all required properties
function createCliContext(
	options: Record<string, unknown>,
	args: string[] = [],
	mockLogger: ReturnType<typeof createMockLogger>
) {
	return {
		args,
		argv: ['node', 'robo', 'tunnel', ...args],
		cwd: process.cwd(),
		options,
		logger: mockLogger
	} as any
}

describe('Tunnel Integration Tests', () => {
	let processExitSpy: jest.SpiedFunction<typeof process.exit>

	beforeEach(() => {
		// Reset all mocks between tests
		mockNanocore.clear()
		mockProvider.reset()

		// Mock process.exit to throw instead of terminating
		processExitSpy = jest.spyOn(process, 'exit').mockImplementation(mockExit as any)
	})

	afterEach(() => {
		processExitSpy.mockRestore()
	})

	describe('Full Lifecycle', () => {
		it('start → list → stop lifecycle works correctly', async () => {
			const startLogger = createMockLogger()
			const listLogger = createMockLogger()
			const stopLogger = createMockLogger()

			// Import commands
			const { default: startCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/start.js')
			const { default: listCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/list.js')
			const { default: stopCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/stop.js')

			// 1. Start a tunnel
			await startCommand(
				createCliContext({ port: 3000, url: undefined, attach: false, verbose: false }, [], startLogger)
			)

			// Verify tunnel was started
			expect(mockProvider.wasCalled('start')).toBe(true)
			expect(startLogger.hasMessage('mock-tunnel.example.com')).toBe(true)

			// 2. List tunnels
			await listCommand(createCliContext({ verbose: false }, [], listLogger))

			// Verify tunnel appears in list
			expect(listLogger.hasMessage('3000')).toBe(true)
			expect(listLogger.hasMessage('mock-tunnel.example.com')).toBe(true)

			// Get tunnel ID from registry
			const tunnels = await TunnelRegistry.getAll()
			expect(tunnels).toHaveLength(1)
			const tunnelId = tunnels[0].id

			// 3. Stop the tunnel
			await stopCommand(createCliContext({ all: false, verbose: false }, [tunnelId], stopLogger))

			// Verify tunnel was stopped
			expect(stopLogger.hasMessage('Stopped')).toBe(true)

			// 4. Verify registry is empty
			const remainingTunnels = await TunnelRegistry.getAll()
			expect(remainingTunnels).toHaveLength(0)
		})

		it('multiple tunnels on different ports', async () => {
			const logger1 = createMockLogger()
			const logger2 = createMockLogger()
			const listLogger = createMockLogger()
			const stopLogger = createMockLogger()

			const { default: startCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/start.js')
			const { default: listCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/list.js')
			const { default: stopCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/stop.js')

			// Start tunnel on port 3000
			mockProvider.mockUrl = 'https://tunnel-3000.example.com'
			await startCommand(
				createCliContext({ port: 3000, url: undefined, attach: false, verbose: false }, [], logger1)
			)

			// Reset provider calls for second tunnel, keep URL different
			mockProvider.calls = []
			mockProvider.mockUrl = 'https://tunnel-8080.example.com'

			// Start tunnel on port 8080
			await startCommand(
				createCliContext({ port: 8080, url: undefined, attach: false, verbose: false }, [], logger2)
			)

			// List should show both tunnels
			await listCommand(createCliContext({ verbose: false }, [], listLogger))

			expect(listLogger.hasMessage('3000')).toBe(true)
			expect(listLogger.hasMessage('8080')).toBe(true)

			// Verify both tunnels are registered
			const tunnels = await TunnelRegistry.getAll()
			expect(tunnels).toHaveLength(2)

			// Stop all tunnels
			await stopCommand(createCliContext({ all: true, verbose: false }, [], stopLogger))

			expect(stopLogger.hasMessage('Stopped 2')).toBe(true)

			// Verify registry is empty
			const remaining = await TunnelRegistry.getAll()
			expect(remaining).toHaveLength(0)
		})

		it('duplicate port prevention', async () => {
			const logger1 = createMockLogger()
			const logger2 = createMockLogger()

			const { default: startCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/start.js')

			// Start first tunnel on port 3000
			await startCommand(
				createCliContext({ port: 3000, url: undefined, attach: false, verbose: false }, [], logger1)
			)

			// Reset provider calls
			mockProvider.calls = []

			// Try to start second tunnel on same port
			try {
				await startCommand(
					createCliContext({ port: 3000, url: undefined, attach: false, verbose: false }, [], logger2)
				)
			} catch {
				// Expected - process.exit throws
			}

			// Should show error about existing tunnel
			expect(logger2.hasMessage('already running')).toBe(true)

			// Provider.start should NOT have been called for second attempt
			expect(mockProvider.wasCalled('start')).toBe(false)

			// Only one tunnel should be registered
			const tunnels = await TunnelRegistry.getAll()
			expect(tunnels).toHaveLength(1)
		})

		it('handles dead tunnels gracefully in list', async () => {
			const listLogger = createMockLogger()

			// Manually register a tunnel with dead PID
			await TunnelRegistry.register({
				pid: 999999999, // Non-existent PID
				port: 3000,
				url: 'https://dead-tunnel.example.com',
				startedAt: Date.now() - 10000,
				provider: 'mock'
			})

			const { default: listCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/list.js')

			await listCommand(createCliContext({ verbose: false }, [], listLogger))

			// Should show no tunnels (dead one was cleaned up)
			expect(listLogger.hasMessage('No tunnels')).toBe(true)
		})
	})

	describe('Error Handling', () => {
		it('handles provider install failure', async () => {
			const logger = createMockLogger()
			mockProvider.shouldBeUninstalled = true
			mockProvider.shouldFailInstall = true

			const { default: startCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/start.js')

			await expect(
				startCommand(
					createCliContext({ port: 3000, url: undefined, attach: false, verbose: false }, [], logger)
				)
			).rejects.toThrow('Mock install failure')
		})

		it('handles provider start failure', async () => {
			const logger = createMockLogger()
			mockProvider.shouldFailStart = true

			const { default: startCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/start.js')

			try {
				await startCommand(
					createCliContext({ port: 3000, url: undefined, attach: false, verbose: false }, [], logger)
				)
			} catch {
				// Expected - process.exit
			}

			expect(logger.hasMessage('Failed')).toBe(true)

			// No tunnel should be registered
			const tunnels = await TunnelRegistry.getAll()
			expect(tunnels).toHaveLength(0)
		})
	})

	describe('Port Extraction from URL', () => {
		it('extracts port from custom URL for registry', async () => {
			const logger = createMockLogger()

			const { default: startCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/start.js')

			await startCommand(
				createCliContext(
					{
						port: undefined,
						url: 'http://192.168.1.100:9000',
						attach: false,
						verbose: false
					},
					[],
					logger
				)
			)

			// Verify tunnel was registered with extracted port
			const tunnels = await TunnelRegistry.getAll()
			expect(tunnels).toHaveLength(1)
			expect(tunnels[0].port).toBe(9000)
		})

		it('defaults to port 80 for HTTP URL without port', async () => {
			const logger = createMockLogger()

			const { default: startCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/start.js')

			await startCommand(
				createCliContext(
					{
						port: undefined,
						url: 'http://192.168.1.100',
						attach: false,
						verbose: false
					},
					[],
					logger
				)
			)

			const tunnels = await TunnelRegistry.getAll()
			expect(tunnels).toHaveLength(1)
			expect(tunnels[0].port).toBe(80)
		})

		it('defaults to port 80 for HTTPS URL without port', async () => {
			// Note: The implementation defaults to 80 for ALL URLs without explicit ports
			// This is because URL.port returns empty string for default ports (80/443)
			// and the code uses: parsedUrl.port ? parseInt(parsedUrl.port, 10) : 80
			const logger = createMockLogger()

			const { default: startCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/start.js')

			await startCommand(
				createCliContext(
					{
						port: undefined,
						url: 'https://192.168.1.100',
						attach: false,
						verbose: false
					},
					[],
					logger
				)
			)

			const tunnels = await TunnelRegistry.getAll()
			expect(tunnels).toHaveLength(1)
			// Implementation always defaults to 80 when no port specified
			expect(tunnels[0].port).toBe(80)
		})
	})
})

describe('MockTunnelProvider', () => {
	it('tracks all method calls', () => {
		const provider = new MockTunnelProvider()

		provider.isInstalled()
		expect(provider.wasCalled('isInstalled')).toBe(true)
		expect(provider.getCallsTo('isInstalled')).toHaveLength(1)
	})

	it('can simulate failures', async () => {
		const provider = new MockTunnelProvider()
		provider.shouldFailStart = true

		await expect(provider.start('http://localhost:3000')).rejects.toThrow('Mock start failure')
	})

	it('reset clears all state', async () => {
		const provider = new MockTunnelProvider()
		provider.shouldFailStart = true
		provider.mockUrl = 'custom-url'
		provider.isInstalled()

		provider.reset()

		expect(provider.shouldFailStart).toBe(false)
		expect(provider.mockUrl).toBe('https://mock-tunnel.example.com')
		expect(provider.calls).toHaveLength(0)
	})

	it('returns configurable mock URL', async () => {
		const provider = new MockTunnelProvider()
		provider.mockUrl = 'https://custom-test-url.example.com'

		const instance = await provider.start('http://localhost:3000')
		expect(instance.url).toBe('https://custom-test-url.example.com')
	})

	it('creates mock process with working kill method', async () => {
		const provider = new MockTunnelProvider()
		provider.useRealProcess = false // Use EventEmitter mock for this test
		const instance = await provider.start('http://localhost:3000')

		// Uses fake PID 99999 to avoid accidentally killing Jest worker
		expect(instance.process.pid).toBe(99999)
		expect(instance.process.killed).toBe(false)

		instance.process.kill()

		expect(instance.process.killed).toBe(true)
	})
})
