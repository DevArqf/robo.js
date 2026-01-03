/**
 * Tests for autocomplete handler execution
 *
 * Verifies that:
 * - Autocomplete handlers are found and executed
 * - Disabled handlers/modules are skipped
 * - Middleware chain executes before handler
 * - Timeouts are enforced
 * - Error handling works correctly
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Helper for typed mocks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fn = jest.fn as any

// Import from 'robo.js' to use the mocked module
const roboMock = (await import('robo.js')) as unknown as {
	portal: {
		getByType: jest.Mock
		getRecord: jest.Mock
		importHandler: jest.Mock
		module: jest.Mock
	}
	getForkedLogger: (key: string) => {
		debug: jest.Mock
		info: jest.Mock
		warn: jest.Mock
		error: jest.Mock
	}
	Mode: { isDev: jest.Mock }
	clearForkedLoggers: () => void
}

const { portal, getForkedLogger, Mode } = roboMock

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

// Helper to create mock autocomplete interaction
function createMockAutocompleteInteraction(overrides = {}) {
	return {
		commandName: 'search',
		options: {
			getFocused: fn().mockReturnValue('test'),
			getString: fn().mockReturnValue('test'),
			getSubcommand: fn().mockReturnValue(null),
			getSubcommandGroup: fn().mockReturnValue(null)
		},
		respond: fn().mockResolvedValue(undefined),
		...overrides
	}
}

// Helper to setup portal mock for a specific command
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setupCommandMock(commandKey: string, record: any, middleware: any[] = []) {
	portal.getRecord.mockImplementation(((ns: string, route: string, key: string) => {
		if (ns === 'discordjs' && route === 'commands' && key === commandKey) {
			return record
		}
		return undefined
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	}) as any)

	portal.getByType.mockImplementation(((type: string) => {
		if (type === 'discordjs:middleware') {
			if (middleware.length === 0) return {}
			return { default: middleware }
		}
		return {}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	}) as any)
}

// Import after mocking
const { executeAutocompleteHandler } = await import('../../src/core/handlers/autocomplete.js')

describe('Autocomplete Handler', () => {
	beforeEach(() => {
		jest.clearAllMocks()
		clearLoggerMocks()
		Mode.isDev.mockReturnValue(true)

		// Default mock for module check
		portal.module.mockReturnValue({ isEnabled: () => true })
	})

	describe('executeAutocompleteHandler', () => {
		it('should log error when command is not found', async () => {
			portal.getRecord.mockReturnValue(undefined)

			const interaction = createMockAutocompleteInteraction()
			await executeAutocompleteHandler(interaction as any, 'unknown-command')

			expect(discordLogger.error).toHaveBeenCalledWith(expect.stringContaining('unknown-command'))
		})

		it('should execute autocomplete handler when command is found', async () => {
			const mockAutocomplete = fn().mockResolvedValue([
				{ name: 'Result 1', value: 'result1' },
				{ name: 'Result 2', value: 'result2' }
			])
			const record = {
				key: 'search',
				path: 'commands/search.js',
				enabled: true,
				handler: { default: fn(), autocomplete: mockAutocomplete }
			}

			setupCommandMock('search', record)

			const interaction = createMockAutocompleteInteraction()
			await executeAutocompleteHandler(interaction as any, 'search')

			expect(mockAutocomplete).toHaveBeenCalledWith(interaction)
			expect(interaction.respond).toHaveBeenCalledWith([
				{ name: 'Result 1', value: 'result1' },
				{ name: 'Result 2', value: 'result2' }
			])
		})

		it('should skip autocomplete when module is disabled', async () => {
			const mockAutocomplete = fn()
			const record = {
				key: 'search',
				path: 'commands/search.js',
				enabled: true,
				module: 'admin',
				handler: { default: fn(), autocomplete: mockAutocomplete }
			}

			setupCommandMock('search', record)
			portal.module.mockReturnValue({ isEnabled: () => false })

			const interaction = createMockAutocompleteInteraction()
			await executeAutocompleteHandler(interaction as any, 'search')

			expect(mockAutocomplete).not.toHaveBeenCalled()
			expect(discordLogger.debug).toHaveBeenCalledWith(expect.stringContaining('disabled command from module'))
		})

		it('should skip disabled command', async () => {
			const mockAutocomplete = fn()
			const record = {
				key: 'search',
				path: 'commands/search.js',
				enabled: false,
				handler: { default: fn(), autocomplete: mockAutocomplete }
			}

			setupCommandMock('search', record)

			const interaction = createMockAutocompleteInteraction()
			await executeAutocompleteHandler(interaction as any, 'search')

			expect(mockAutocomplete).not.toHaveBeenCalled()
			expect(discordLogger.debug).toHaveBeenCalledWith(expect.stringContaining('disabled command'))
		})

		it('should import handler if not already imported', async () => {
			const mockAutocomplete = fn().mockResolvedValue([{ name: 'Test', value: 'test' }])
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const record: any = {
				key: 'search',
				path: 'commands/search.js',
				enabled: true,
				handler: null
			}

			portal.importHandler.mockImplementation((async () => {
				record.handler = { default: fn(), autocomplete: mockAutocomplete }
			}) as any)

			setupCommandMock('search', record)

			const interaction = createMockAutocompleteInteraction()
			await executeAutocompleteHandler(interaction as any, 'search')

			expect(portal.importHandler).toHaveBeenCalledWith('discordjs', 'commands', 'search')
			expect(mockAutocomplete).toHaveBeenCalled()
		})

		it('should skip when no autocomplete export exists', async () => {
			const record = {
				key: 'search',
				path: 'commands/search.js',
				enabled: true,
				handler: { default: fn() } // No autocomplete export
			}

			setupCommandMock('search', record)

			const interaction = createMockAutocompleteInteraction()
			await executeAutocompleteHandler(interaction as any, 'search')

			expect(interaction.respond).not.toHaveBeenCalled()
			expect(discordLogger.debug).toHaveBeenCalledWith(expect.stringContaining('No autocomplete handler'))
		})

		it('should handle errors gracefully', async () => {
			const error = new Error('Autocomplete failed')
			const mockAutocomplete = fn().mockRejectedValue(error)
			const record = {
				key: 'search',
				path: 'commands/search.js',
				enabled: true,
				handler: { default: fn(), autocomplete: mockAutocomplete }
			}

			setupCommandMock('search', record)

			const interaction = createMockAutocompleteInteraction()
			await executeAutocompleteHandler(interaction as any, 'search')

			expect(discordLogger.error).toHaveBeenCalledWith('Autocomplete error:', error)
		})

		it('should respond with empty array on timeout', async () => {
			// Create a slow autocomplete handler
			const mockAutocomplete = fn().mockImplementation(
				() => new Promise((resolve) => setTimeout(() => resolve([{ name: 'Test', value: 'test' }]), 5000))
			)
			const record = {
				key: 'search',
				path: 'commands/search.js',
				enabled: true,
				handler: {
					default: fn(),
					autocomplete: mockAutocomplete,
					config: { timeout: 100 } // Very short timeout
				}
			}

			setupCommandMock('search', record)

			const interaction = createMockAutocompleteInteraction()
			await executeAutocompleteHandler(interaction as any, 'search')

			expect(discordLogger.warn).toHaveBeenCalledWith(expect.stringContaining('timed out'))
			expect(interaction.respond).toHaveBeenCalledWith([])
		}, 10000)

		it('should use command-specific timeout over global config', async () => {
			const mockAutocomplete = fn().mockImplementation(
				() => new Promise((resolve) => setTimeout(() => resolve([{ name: 'Slow', value: 'slow' }]), 200))
			)
			const record = {
				key: 'search',
				path: 'commands/search.js',
				enabled: true,
				handler: {
					default: fn(),
					autocomplete: mockAutocomplete,
					config: { timeout: 50 } // Short timeout - should trigger timeout
				}
			}

			setupCommandMock('search', record)

			const interaction = createMockAutocompleteInteraction()
			await executeAutocompleteHandler(interaction as any, 'search')

			// Should timeout because command config timeout (50ms) is shorter than handler delay (200ms)
			expect(discordLogger.warn).toHaveBeenCalledWith(expect.stringContaining('timed out'))
		})

		it('should handle numeric autocomplete values', async () => {
			const mockAutocomplete = fn().mockResolvedValue([
				{ name: '10 items', value: 10 },
				{ name: '20 items', value: 20 },
				{ name: '50 items', value: 50 }
			])
			const record = {
				key: 'quantity',
				path: 'commands/quantity.js',
				enabled: true,
				handler: { default: fn(), autocomplete: mockAutocomplete }
			}

			setupCommandMock('quantity', record)

			const interaction = createMockAutocompleteInteraction({ commandName: 'quantity' })
			await executeAutocompleteHandler(interaction as any, 'quantity')

			expect(interaction.respond).toHaveBeenCalledWith([
				{ name: '10 items', value: 10 },
				{ name: '20 items', value: 20 },
				{ name: '50 items', value: 50 }
			])
		})
	})

	describe('middleware integration', () => {
		it('should execute middleware before autocomplete handler', async () => {
			const executionOrder: string[] = []
			const mockMiddleware = fn(() => {
				executionOrder.push('middleware')
				return {}
			})
			const mockAutocomplete = fn(() => {
				executionOrder.push('autocomplete')
				return Promise.resolve([{ name: 'Test', value: 'test' }])
			})

			const record = {
				key: 'search',
				path: 'commands/search.js',
				enabled: true,
				handler: { default: fn(), autocomplete: mockAutocomplete }
			}

			setupCommandMock('search', record, [
				{ key: 'auth', path: 'middleware/auth.js', enabled: true, handler: { default: mockMiddleware } }
			])

			const interaction = createMockAutocompleteInteraction()
			await executeAutocompleteHandler(interaction as any, 'search')

			expect(executionOrder).toEqual(['middleware', 'autocomplete'])
		})

		it('should abort autocomplete when middleware returns abort', async () => {
			const mockMiddleware = fn(() => ({ abort: true }))
			const mockAutocomplete = fn()

			const record = {
				key: 'search',
				path: 'commands/search.js',
				enabled: true,
				handler: { default: fn(), autocomplete: mockAutocomplete }
			}

			setupCommandMock('search', record, [
				{ key: 'auth', path: 'middleware/auth.js', enabled: true, handler: { default: mockMiddleware } }
			])

			const interaction = createMockAutocompleteInteraction()
			await executeAutocompleteHandler(interaction as any, 'search')

			expect(mockMiddleware).toHaveBeenCalled()
			expect(mockAutocomplete).not.toHaveBeenCalled()
			expect(discordLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Middleware aborted'))
		})
	})

	describe('subcommand handling', () => {
		it('should handle subcommand autocomplete', async () => {
			const mockAutocomplete = fn().mockResolvedValue([{ name: 'User Result', value: 'user1' }])
			const record = {
				key: 'user find',
				path: 'commands/user/find.js',
				enabled: true,
				handler: { default: fn(), autocomplete: mockAutocomplete }
			}

			setupCommandMock('user find', record)

			const interaction = createMockAutocompleteInteraction({
				commandName: 'user',
				options: {
					getFocused: fn().mockReturnValue('john'),
					getSubcommand: fn().mockReturnValue('find'),
					getSubcommandGroup: fn().mockReturnValue(null)
				}
			})
			await executeAutocompleteHandler(interaction as any, 'user find')

			expect(mockAutocomplete).toHaveBeenCalledWith(interaction)
			expect(interaction.respond).toHaveBeenCalledWith([{ name: 'User Result', value: 'user1' }])
		})
	})
})
