/**
 * CLI E2E Tests for Tunnel Commands
 *
 * Tests the CLI commands using MockTunnelProvider.
 * These tests verify behavior without asserting exact console output.
 */
import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals'
import { spawn, type ChildProcess } from 'node:child_process'
import { createMockNanocore, createMockLogger } from '../utils/test-helpers.js'
import { MockTunnelProvider } from '../../.robo/build/core/tunnel/providers/mock.js'

// Helper to spawn a killable subprocess for testing
function spawnTestProcess(): ChildProcess {
	const proc = spawn('sleep', ['3600'], { detached: true, stdio: 'ignore' })
	proc.unref()
	return proc
}

// Create shared mock instances
const mockNanocore = createMockNanocore()
const mockProvider = new MockTunnelProvider()

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

describe('Tunnel CLI Commands (E2E)', () => {
	let processExitSpy: jest.SpiedFunction<typeof process.exit>

	beforeEach(() => {
		// Reset mocks between tests
		mockNanocore.clear()
		mockProvider.reset()

		// Mock process.exit globally to prevent Jest worker termination
		processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
			throw new Error(`process.exit(${code}) called`)
		}) as jest.SpiedFunction<typeof process.exit>
	})

	afterEach(() => {
		processExitSpy.mockRestore()
	})

	describe('tunnel start', () => {
		it('starts tunnel in detached mode by default', async () => {
			const mockLogger = createMockLogger()

			// Import start command (will use mocked CloudflareProvider)
			const { default: startCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/start.js')

			await startCommand(
				createCliContext({ port: 3000, url: undefined, attach: false, verbose: false }, [], mockLogger)
			)

			// Verify MockTunnelProvider was used
			expect(mockProvider.wasCalled('isInstalled')).toBe(true)
			expect(mockProvider.wasCalled('start')).toBe(true)

			// Verify start was called with correct URL
			const startCalls = mockProvider.getCallsTo('start')
			expect(startCalls[0].args[0]).toBe('http://localhost:3000')

			// Verify tunnel was registered
			const tunnels = await TunnelRegistry.getAll()
			expect(tunnels.length).toBeGreaterThan(0)
		})

		// Note: PORT env variable test removed - jest.resetModules() breaks processExitSpy
		// The PORT fallback behavior is tested in integration.test.ts

		it('--url overrides --port', async () => {
			const mockLogger = createMockLogger()

			const { default: startCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/start.js')

			await startCommand(
				createCliContext(
					{
						port: 3000,
						url: 'http://192.168.1.100:9000',
						attach: false,
						verbose: false
					},
					[],
					mockLogger
				)
			)

			// Verify custom URL was used
			const startCalls = mockProvider.getCallsTo('start')
			expect(startCalls[0].args[0]).toBe('http://192.168.1.100:9000')
		})

		it('prevents duplicate tunnels on same port', async () => {
			const mockLogger = createMockLogger()

			// Register existing tunnel on port 3000
			await TunnelRegistry.register({
				pid: process.pid,
				port: 3000,
				url: 'https://existing.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			const { default: startCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/start.js')

			try {
				await startCommand(
					createCliContext({ port: 3000, url: undefined, attach: false, verbose: false }, [], mockLogger)
				)
			} catch {
				// Expected - process.exit throws
			}

			// Verify error message was logged
			expect(mockLogger.hasMessage('already running')).toBe(true)

			// Verify MockTunnelProvider.start was NOT called
			expect(mockProvider.wasCalled('start')).toBe(false)
		})

		it('handles provider start failure gracefully', async () => {
			const mockLogger = createMockLogger()
			mockProvider.shouldFailStart = true

			const { default: startCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/start.js')

			try {
				await startCommand(
					createCliContext({ port: 3000, url: undefined, attach: false, verbose: false }, [], mockLogger)
				)
			} catch {
				// Expected - process.exit throws
			}

			expect(mockLogger.hasMessage('Failed')).toBe(true)
		})

		it('installs cloudflared if not installed', async () => {
			const mockLogger = createMockLogger()
			mockProvider.shouldBeUninstalled = true

			const { default: startCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/start.js')

			await startCommand(
				createCliContext({ port: 3000, url: undefined, attach: false, verbose: false }, [], mockLogger)
			)

			// Verify install was called
			expect(mockProvider.wasCalled('install')).toBe(true)
		})
	})

	describe('tunnel list', () => {
		it('shows message when no tunnels running', async () => {
			const mockLogger = createMockLogger()

			const { default: listCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/list.js')

			await listCommand(createCliContext({ verbose: false }, [], mockLogger))

			expect(mockLogger.hasMessage('No tunnels')).toBe(true)
		})

		it('lists registered tunnels', async () => {
			const mockLogger = createMockLogger()

			// Register a tunnel
			await TunnelRegistry.register({
				pid: process.pid,
				port: 3000,
				url: 'https://test-tunnel.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			const { default: listCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/list.js')

			await listCommand(createCliContext({ verbose: false }, [], mockLogger))

			// Should show the tunnel info
			expect(mockLogger.hasMessage('3000')).toBe(true)
			expect(mockLogger.hasMessage('test-tunnel.example.com')).toBe(true)
		})

		it('lists multiple tunnels', async () => {
			const mockLogger = createMockLogger()

			await TunnelRegistry.register({
				pid: process.pid,
				port: 3000,
				url: 'https://tunnel1.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			await TunnelRegistry.register({
				pid: process.pid,
				port: 8080,
				url: 'https://tunnel2.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			const { default: listCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/list.js')

			await listCommand(createCliContext({ verbose: false }, [], mockLogger))

			expect(mockLogger.hasMessage('3000')).toBe(true)
			expect(mockLogger.hasMessage('8080')).toBe(true)
			expect(mockLogger.hasMessage('tunnel1.example.com')).toBe(true)
			expect(mockLogger.hasMessage('tunnel2.example.com')).toBe(true)
		})
	})

	describe('tunnel stop', () => {
		it('stops specific tunnel by ID', async () => {
			const mockLogger = createMockLogger()

			// Spawn a real subprocess that can be safely killed
			const testProc = spawnTestProcess()

			const record = await TunnelRegistry.register({
				pid: testProc.pid!,
				port: 3000,
				url: 'https://test.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			const { default: stopCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/stop.js')

			await stopCommand(createCliContext({ all: false, verbose: false }, [record.id], mockLogger))

			expect(mockLogger.hasMessage('Stopped')).toBe(true)

			// Verify removed from registry
			const remaining = await TunnelRegistry.getAll()
			expect(remaining).toHaveLength(0)
		})

		it('stops all tunnels with --all flag', async () => {
			const mockLogger = createMockLogger()

			// Spawn real subprocesses
			const testProc1 = spawnTestProcess()
			const testProc2 = spawnTestProcess()

			await TunnelRegistry.register({
				pid: testProc1.pid!,
				port: 3000,
				url: 'https://tunnel1.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			await TunnelRegistry.register({
				pid: testProc2.pid!,
				port: 3001,
				url: 'https://tunnel2.example.com',
				startedAt: Date.now(),
				provider: 'mock'
			})

			const { default: stopCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/stop.js')

			await stopCommand(createCliContext({ all: true, verbose: false }, [], mockLogger))

			expect(mockLogger.hasMessage('Stopped')).toBe(true)

			const remaining = await TunnelRegistry.getAll()
			expect(remaining).toHaveLength(0)
		})

		it('shows error for non-existent tunnel ID', async () => {
			const mockLogger = createMockLogger()

			const { default: stopCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/stop.js')

			await stopCommand(createCliContext({ all: false, verbose: false }, ['nonexistent'], mockLogger))

			expect(mockLogger.hasMessage('not found')).toBe(true)
		})

		it('requires tunnel ID or --all flag', async () => {
			const mockLogger = createMockLogger()

			const { default: stopCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/stop.js')

			await stopCommand(createCliContext({ all: false, verbose: false }, [], mockLogger))

			expect(mockLogger.hasMessage('provide a tunnel ID')).toBe(true)
		})

		it('reports when no tunnels to stop with --all', async () => {
			const mockLogger = createMockLogger()

			const { default: stopCommand } = await import('../../.robo/build/robo/cli/commands/tunnel/stop.js')

			await stopCommand(createCliContext({ all: true, verbose: false }, [], mockLogger))

			expect(mockLogger.hasMessage('No tunnels')).toBe(true)
		})
	})
})
