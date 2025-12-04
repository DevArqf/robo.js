/**
 * Tests for the `robo dev --tunnel` CLI extension
 *
 * Tests the before hook directly with minimal mocking.
 * Does NOT test the full robo dev command (that would require mocking the entire runtime).
 */
import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals'
import { createMockLogger, createMockNanocore } from '../utils/test-helpers.js'
import { MockTunnelProvider } from '../../.robo/build/core/tunnel/providers/mock.js'

// Shared mock instances
const mockNanocore = createMockNanocore()
const mockProvider = new MockTunnelProvider()

// Mock CloudflareProvider to use MockTunnelProvider
jest.unstable_mockModule('../../.robo/build/core/tunnel/index.js', () => ({
	CloudflareProvider: jest.fn(() => mockProvider)
}))

// Import after mocking
const { before } = await import('../../.robo/build/robo/cli/extend/dev.js')

// Helper to create minimal CLI context
function createDevContext(options: { tunnel?: boolean }, logger = createMockLogger()) {
	return {
		args: [],
		options,
		logger,
		cwd: process.cwd(),
		argv: ['dev', ...(options.tunnel ? ['--tunnel'] : [])]
	} as any
}

describe('robo dev --tunnel extension', () => {
	let processExitSpy: jest.SpiedFunction<typeof process.exit>
	let originalPort: string | undefined
	let originalTunnelEnabled: string | undefined

	beforeEach(() => {
		// Save original env
		originalPort = process.env.PORT
		originalTunnelEnabled = process.env.__ROBO_TUNNEL_ENABLED

		// Reset mocks
		mockProvider.reset()
		mockNanocore.clear()

		// Clear the env var before each test
		delete process.env.__ROBO_TUNNEL_ENABLED

		// Mock process.exit
		processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
			throw new Error(`process.exit(${code}) called`)
		}) as jest.SpiedFunction<typeof process.exit>
	})

	afterEach(() => {
		// Restore env
		if (originalPort !== undefined) {
			process.env.PORT = originalPort
		} else {
			delete process.env.PORT
		}
		if (originalTunnelEnabled !== undefined) {
			process.env.__ROBO_TUNNEL_ENABLED = originalTunnelEnabled
		} else {
			delete process.env.__ROBO_TUNNEL_ENABLED
		}

		processExitSpy.mockRestore()
	})

	describe('when --tunnel is false/undefined', () => {
		it('returns early without side effects', async () => {
			const ctx = createDevContext({ tunnel: false })

			const result = await before(ctx)

			// Should return undefined (continue normally)
			expect(result).toBeUndefined()
			// Provider should NOT be called
			expect(mockProvider.wasCalled('isInstalled')).toBe(false)
			// Env var should NOT be set
			expect(process.env.__ROBO_TUNNEL_ENABLED).toBeUndefined()
		})

		it('does nothing when tunnel option is missing', async () => {
			const ctx = createDevContext({})

			await before(ctx)

			expect(mockProvider.wasCalled('isInstalled')).toBe(false)
		})
	})

	describe('when --tunnel is true', () => {
		it('errors if PORT env is not set', async () => {
			delete process.env.PORT
			const logger = createMockLogger()
			const ctx = createDevContext({ tunnel: true }, logger)

			await expect(before(ctx)).rejects.toThrow('process.exit(1)')
			expect(logger.hasMessage('Cannot start tunnel without a PORT')).toBe(true)
		})

		it('installs cloudflared if not installed', async () => {
			process.env.PORT = '3000'
			mockProvider.shouldBeUninstalled = true
			const logger = createMockLogger()
			const ctx = createDevContext({ tunnel: true }, logger)

			await before(ctx)

			expect(mockProvider.wasCalled('isInstalled')).toBe(true)
			expect(mockProvider.wasCalled('install')).toBe(true)
			expect(logger.hasMessage('Installing')).toBe(true)
		})

		it('skips install if cloudflared already installed', async () => {
			process.env.PORT = '3000'
			mockProvider.shouldBeUninstalled = false // Already installed
			const ctx = createDevContext({ tunnel: true })

			await before(ctx)

			expect(mockProvider.wasCalled('isInstalled')).toBe(true)
			expect(mockProvider.wasCalled('install')).toBe(false)
		})

		it('calls provider.initialize with Cloudflare config from env', async () => {
			process.env.PORT = '3000'
			process.env.CLOUDFLARE_DOMAIN = 'example.com'
			process.env.CLOUDFLARE_API_KEY = 'test-key'
			process.env.CLOUDFLARE_ZONE_ID = 'zone-123'
			process.env.CLOUDFLARE_ACCOUNT_ID = 'account-456'

			const ctx = createDevContext({ tunnel: true })

			await before(ctx)

			expect(mockProvider.wasCalled('initialize')).toBe(true)
			const initCalls = mockProvider.getCallsTo('initialize')
			expect(initCalls[0].args[0]).toEqual({
				domain: 'example.com',
				apiKey: 'test-key',
				zoneId: 'zone-123',
				accountId: 'account-456'
			})

			// Cleanup
			delete process.env.CLOUDFLARE_DOMAIN
			delete process.env.CLOUDFLARE_API_KEY
			delete process.env.CLOUDFLARE_ZONE_ID
			delete process.env.CLOUDFLARE_ACCOUNT_ID
		})

		it('sets __ROBO_TUNNEL_ENABLED env var', async () => {
			process.env.PORT = '3000'
			const ctx = createDevContext({ tunnel: true })

			await before(ctx)

			expect(process.env.__ROBO_TUNNEL_ENABLED).toBe('true')
		})

		it('handles install failure', async () => {
			process.env.PORT = '3000'
			mockProvider.shouldBeUninstalled = true
			mockProvider.shouldFailInstall = true
			const ctx = createDevContext({ tunnel: true })

			await expect(before(ctx)).rejects.toThrow('Mock install failure')
		})
	})
})
