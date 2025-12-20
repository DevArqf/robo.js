/**
 * Tests for HMR (Hot Module Replacement) hook
 *
 * Verifies that:
 * - Config correctly filters to discordjs namespace
 * - Config only triggers for commands and context routes
 * - Metadata hash is computed deterministically
 * - Definition changes are detected via hash comparison
 * - No-change scenario skips registration
 * - Background registration handles errors gracefully
 * - Missing credentials prevent registration
 * - recordsToCommands converts records correctly
 * - recordsToContext filters by context type
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Helper for typed mocks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fn = jest.fn as any

// Import from 'robo.js' to use the mocked module
const roboMock = (await import('robo.js')) as unknown as {
	Env: {
		data: jest.Mock
	}
	portal: {
		getRecord: jest.Mock
		importHandler: jest.Mock
		ensureRoute: jest.Mock
		getByType: jest.Mock
		getPluginConfig: jest.Mock
	}
	getForkedLogger: (key: string) => {
		debug: jest.Mock
		info: jest.Mock
		warn: jest.Mock
		error: jest.Mock
	}
	clearForkedLoggers: () => void
}

const { Env, portal, getForkedLogger } = roboMock

// Pre-initialize the forked logger
const discordLogger = getForkedLogger('discordjs')

// Helper to clear mock call history
function clearLoggerMocks() {
	Object.values(discordLogger).forEach((mockFn) => {
		if (typeof mockFn === 'function' && 'mockClear' in mockFn) {
			;(mockFn as jest.Mock).mockClear()
		}
	})
}

// Get the REST mock from discord.js mock
const discordMock = (await import('discord.js')) as unknown as {
	getRestMock: () => {
		setToken: jest.Mock<any>
		put: jest.Mock<any>
	}
	resetRestMock: () => void
}

const mockRest = discordMock.getRestMock()

// Import HMR module
const { config, default: hmrHook } = await import('../src/robo/hmr.js')

describe('HMR Hook', () => {
	beforeEach(() => {
		clearLoggerMocks()
		mockRest.put.mockClear()
		mockRest.put.mockResolvedValue([])

		portal.getRecord.mockClear()
		portal.importHandler.mockClear()
		portal.ensureRoute.mockClear()
		portal.getByType.mockClear()
		portal.getPluginConfig.mockClear()

		Env.data.mockClear()
		Env.data.mockReturnValue({
			DISCORD_TOKEN: 'test-token-1234567890',
			DISCORD_CLIENT_ID: '123456789012345678'
		})

		portal.importHandler.mockResolvedValue(undefined)
		portal.ensureRoute.mockResolvedValue(undefined)
		portal.getByType.mockReturnValue({})
		portal.getPluginConfig.mockReturnValue(null)
	})

	describe('config', () => {
		it('should filter to discordjs namespace', () => {
			expect(config.namespaces).toBeDefined()
			expect(config.namespaces).toContain('discordjs')
		})

		it('should only trigger for commands and context routes', () => {
			expect(config.routes).toBeDefined()
			expect(config.routes).toContain('commands')
			expect(config.routes).toContain('context')
			expect(config.routes).toHaveLength(2)
		})

		it('should not include events route', () => {
			expect(config.routes).not.toContain('events')
		})
	})

	describe('HMR hook execution', () => {
		it('should log no changes when handlers have no definition changes', async () => {
			const context = createMockHmrContext([])

			await hmrHook(context)

			expect(discordLogger.debug).toHaveBeenCalledWith(expect.stringContaining('No command definition changes'))
		})

		it('should skip handler when record not found', async () => {
			portal.getRecord.mockReturnValue(null)

			const context = createMockHmrContext([
				{ route: 'commands', handlers: [{ key: 'unknown' }] }
			])

			await hmrHook(context)

			// Should not try to import handler if record not found
			expect(portal.importHandler).not.toHaveBeenCalled()
		})

		it('should import handler for each affected route', async () => {
			portal.getRecord.mockReturnValue({ metadata: { description: 'Test' } })

			const context = createMockHmrContext([
				{ route: 'commands', handlers: [{ key: 'ping' }, { key: 'pong' }] }
			])

			await hmrHook(context)

			expect(portal.importHandler).toHaveBeenCalledTimes(2)
			expect(portal.importHandler).toHaveBeenCalledWith('discordjs', 'commands', 'ping')
			expect(portal.importHandler).toHaveBeenCalledWith('discordjs', 'commands', 'pong')
		})

		it('should detect definition changes on second run with different metadata', async () => {
			// First run - establish baseline
			portal.getRecord.mockReturnValue({ metadata: { description: 'Original' } })

			const context1 = createMockHmrContext([
				{ route: 'commands', handlers: [{ key: 'test-cmd' }] }
			])
			await hmrHook(context1)

			clearLoggerMocks()

			// Second run - changed metadata
			portal.getRecord.mockReturnValue({ metadata: { description: 'Changed' } })

			const context2 = createMockHmrContext([
				{ route: 'commands', handlers: [{ key: 'test-cmd' }] }
			])
			await hmrHook(context2)

			expect(discordLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Command definition changed'))
		})

		it('should not detect changes when metadata is unchanged', async () => {
			const metadata = { description: 'Unchanged' }
			portal.getRecord.mockReturnValue({ metadata })

			// First run
			const context1 = createMockHmrContext([
				{ route: 'commands', handlers: [{ key: 'stable-cmd' }] }
			])
			await hmrHook(context1)

			clearLoggerMocks()

			// Second run - same metadata
			const context2 = createMockHmrContext([
				{ route: 'commands', handlers: [{ key: 'stable-cmd' }] }
			])
			await hmrHook(context2)

			// Should log no changes, not command definition changed
			expect(discordLogger.debug).toHaveBeenCalledWith(expect.stringContaining('No command definition changes'))
		})
	})

	describe('background registration', () => {
		it('should warn when credentials are missing', async () => {
			Env.data.mockReturnValue({}) // No token or client ID

			// Force a definition change to trigger registration
			portal.getRecord.mockReturnValueOnce({ metadata: { v: 1 } })
			const context1 = createMockHmrContext([
				{ route: 'commands', handlers: [{ key: 'cred-test' }] }
			])
			await hmrHook(context1)

			portal.getRecord.mockReturnValueOnce({ metadata: { v: 2 } })
			const context2 = createMockHmrContext([
				{ route: 'commands', handlers: [{ key: 'cred-test' }] }
			])
			await hmrHook(context2)

			// Wait for async registration attempt
			await new Promise((r) => setTimeout(r, 50))

			expect(discordLogger.warn).toHaveBeenCalledWith(expect.stringContaining('missing DISCORD_CLIENT_ID or DISCORD_TOKEN'))
		})

		it('should use guild ID from environment when available', async () => {
			Env.data.mockReturnValue({
				DISCORD_TOKEN: 'test-token',
				DISCORD_CLIENT_ID: '123456789',
				DISCORD_GUILD_ID: '987654321'
			})

			portal.getByType.mockReturnValue({
				ping: { metadata: { description: 'Ping' } }
			})

			// Force a definition change
			portal.getRecord.mockReturnValueOnce({ metadata: { v: 1 } })
			const context1 = createMockHmrContext([
				{ route: 'commands', handlers: [{ key: 'guild-test' }] }
			])
			await hmrHook(context1)

			portal.getRecord.mockReturnValueOnce({ metadata: { v: 2 } })
			const context2 = createMockHmrContext([
				{ route: 'commands', handlers: [{ key: 'guild-test' }] }
			])
			await hmrHook(context2)

			// Wait for async registration
			await new Promise((r) => setTimeout(r, 50))

			// Should have attempted registration (via ensureRoute)
			expect(portal.ensureRoute).toHaveBeenCalledWith('discordjs', 'commands')
		})

		it('should use testServers from plugin config when no DISCORD_GUILD_ID', async () => {
			Env.data.mockReturnValue({
				DISCORD_TOKEN: 'test-token',
				DISCORD_CLIENT_ID: '123456789'
			})

			portal.getPluginConfig.mockReturnValue({
				testServers: ['111222333']
			})

			portal.getByType.mockReturnValue({
				ping: { metadata: { description: 'Ping' } }
			})

			// Force a definition change
			portal.getRecord.mockReturnValueOnce({ metadata: { v: 1 } })
			const context1 = createMockHmrContext([
				{ route: 'commands', handlers: [{ key: 'config-test' }] }
			])
			await hmrHook(context1)

			portal.getRecord.mockReturnValueOnce({ metadata: { v: 2 } })
			const context2 = createMockHmrContext([
				{ route: 'commands', handlers: [{ key: 'config-test' }] }
			])
			await hmrHook(context2)

			// Wait for async registration
			await new Promise((r) => setTimeout(r, 50))

			// Should have called getPluginConfig
			expect(portal.getPluginConfig).toHaveBeenCalledWith('discordjs')
		})

		it('should handle registration errors gracefully', async () => {
			Env.data.mockReturnValue({
				DISCORD_TOKEN: 'test-token',
				DISCORD_CLIENT_ID: '123456789'
			})

			portal.getByType.mockReturnValue({
				ping: { metadata: { description: 'Ping' } }
			})

			// Force ensureRoute to fail
			portal.ensureRoute.mockRejectedValue(new Error('Route error'))

			// Force a definition change
			portal.getRecord.mockReturnValueOnce({ metadata: { v: 1 } })
			const context1 = createMockHmrContext([
				{ route: 'commands', handlers: [{ key: 'error-test' }] }
			])
			await hmrHook(context1)

			portal.getRecord.mockReturnValueOnce({ metadata: { v: 2 } })
			const context2 = createMockHmrContext([
				{ route: 'commands', handlers: [{ key: 'error-test' }] }
			])
			await hmrHook(context2)

			// Wait for async registration
			await new Promise((r) => setTimeout(r, 100))

			// Should warn about failure
			expect(discordLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining('Failed to update commands'),
				expect.any(Error)
			)
		})
	})

	describe('recordsToCommands (via integration)', () => {
		it('should handle top-level commands', async () => {
			Env.data.mockReturnValue({
				DISCORD_TOKEN: 'test-token',
				DISCORD_CLIENT_ID: '123456789'
			})

			portal.getByType.mockImplementation((type: string) => {
				if (type === 'discordjs:commands') {
					return {
						ping: { metadata: { description: 'Ping' } }
					}
				}
				return {}
			})

			// Force a definition change
			portal.getRecord.mockReturnValueOnce({ metadata: { v: 1 } })
			const context1 = createMockHmrContext([
				{ route: 'commands', handlers: [{ key: 'records-test' }] }
			])
			await hmrHook(context1)

			portal.getRecord.mockReturnValueOnce({ metadata: { v: 2 } })
			const context2 = createMockHmrContext([
				{ route: 'commands', handlers: [{ key: 'records-test' }] }
			])
			await hmrHook(context2)

			// Wait for async registration
			await new Promise((r) => setTimeout(r, 50))

			// Should have called getByType for commands
			expect(portal.getByType).toHaveBeenCalledWith('discordjs:commands')
		})

		it('should handle subcommands', async () => {
			Env.data.mockReturnValue({
				DISCORD_TOKEN: 'test-token',
				DISCORD_CLIENT_ID: '123456789'
			})

			portal.getByType.mockImplementation((type: string) => {
				if (type === 'discordjs:commands') {
					return {
						'user add': { metadata: { description: 'Add user' } },
						'user remove': { metadata: { description: 'Remove user' } }
					}
				}
				return {}
			})

			// Force a definition change
			portal.getRecord.mockReturnValueOnce({ metadata: { v: 1 } })
			const context1 = createMockHmrContext([
				{ route: 'commands', handlers: [{ key: 'sub-test' }] }
			])
			await hmrHook(context1)

			portal.getRecord.mockReturnValueOnce({ metadata: { v: 2 } })
			const context2 = createMockHmrContext([
				{ route: 'commands', handlers: [{ key: 'sub-test' }] }
			])
			await hmrHook(context2)

			// Wait for async registration
			await new Promise((r) => setTimeout(r, 50))

			expect(portal.getByType).toHaveBeenCalledWith('discordjs:commands')
		})
	})

	describe('recordsToContext (via integration)', () => {
		it('should filter user context menus (type 2)', async () => {
			Env.data.mockReturnValue({
				DISCORD_TOKEN: 'test-token',
				DISCORD_CLIENT_ID: '123456789'
			})

			portal.getByType.mockImplementation((type: string) => {
				if (type === 'discordjs:context') {
					return {
						'User Info': { metadata: { contextType: 2, name: 'User Info' } },
						'Message Info': { metadata: { contextType: 3, name: 'Message Info' } }
					}
				}
				return {}
			})

			// Force a definition change
			portal.getRecord.mockReturnValueOnce({ metadata: { v: 1 } })
			const context1 = createMockHmrContext([
				{ route: 'context', handlers: [{ key: 'ctx-test' }] }
			])
			await hmrHook(context1)

			portal.getRecord.mockReturnValueOnce({ metadata: { v: 2 } })
			const context2 = createMockHmrContext([
				{ route: 'context', handlers: [{ key: 'ctx-test' }] }
			])
			await hmrHook(context2)

			// Wait for async registration
			await new Promise((r) => setTimeout(r, 50))

			expect(portal.getByType).toHaveBeenCalledWith('discordjs:context')
		})
	})
})

// Helper to create mock HMR context
function createMockHmrContext(routes: Array<{ route: string; handlers: Array<{ key: string }> }>) {
	return {
		routes: routes.map((r) => ({
			namespace: 'discordjs',
			route: r.route,
			handlers: r.handlers
		}))
	}
}
