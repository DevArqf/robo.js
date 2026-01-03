/**
 * Tests for utility functions
 *
 * Verifies that:
 * - Sage options are merged correctly with proper priority
 * - Ephemeral flags are added correctly
 * - Command options are extracted from interactions
 * - deferReply patching prevents multiple deferrals
 * - Command keys are generated correctly from interactions
 * - Timeout utility works correctly
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { setPluginState } from '../src/core/client.js'
import {
	DEFAULT_SAGE,
	BUFFER,
	TIMEOUT,
	withEphemeralDefer,
	withEphemeralReply,
	getSage,
	timeout,
	extractCommandOptions,
	patchDeferReply,
	getCommandKey
} from '../src/core/utils.js'
import type { PluginState } from '../src/types/index.js'

// Helper for typed mocks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fn = jest.fn as any

describe('Utility Functions', () => {
	beforeEach(() => {
		jest.clearAllMocks()
		// Reset plugin state
		setPluginState({
			serverRestrictions: new Map(),
			config: {}
		})
	})

	describe('DEFAULT_SAGE', () => {
		it('should have expected default values', () => {
			expect(DEFAULT_SAGE).toEqual({
				defer: true,
				deferBuffer: 250,
				ephemeral: false,
				errorReplies: true
			})
		})
	})

	describe('symbols', () => {
		it('should export BUFFER symbol', () => {
			expect(typeof BUFFER).toBe('symbol')
			expect(BUFFER.toString()).toContain('BUFFER')
		})

		it('should export TIMEOUT symbol', () => {
			expect(typeof TIMEOUT).toBe('symbol')
			expect(TIMEOUT.toString()).toContain('TIMEOUT')
		})

		it('should have distinct symbols', () => {
			expect(BUFFER).not.toBe(TIMEOUT)
		})
	})

	describe('withEphemeralDefer', () => {
		it('should add ephemeral flag when on is true', () => {
			const opts: { flags?: number; ephemeral?: boolean } = {}
			const result = withEphemeralDefer(opts, true)

			// Should have either flags or ephemeral set
			expect(result.flags === 64 || result.ephemeral === true).toBe(true)
		})

		it('should not modify options when on is false', () => {
			const opts: { flags?: number; ephemeral?: boolean } = {}
			const result = withEphemeralDefer(opts, false)

			expect(result.flags).toBeUndefined()
			expect(result.ephemeral).toBeUndefined()
		})

		it('should return the same object (mutated)', () => {
			const opts: { flags?: number; ephemeral?: boolean } = {}
			const result = withEphemeralDefer(opts, true)

			expect(result).toBe(opts)
		})

		it('should default on to true', () => {
			const opts: { flags?: number; ephemeral?: boolean } = {}
			const result = withEphemeralDefer(opts)

			expect(result.flags === 64 || result.ephemeral === true).toBe(true)
		})
	})

	describe('withEphemeralReply', () => {
		it('should add ephemeral flag when on is true', () => {
			const opts: { content: string; flags?: number; ephemeral?: boolean } = { content: 'test' }
			const result = withEphemeralReply(opts, true)

			expect(result.flags === 64 || result.ephemeral === true).toBe(true)
		})

		it('should not modify options when on is false', () => {
			const opts: { content: string; flags?: number; ephemeral?: boolean } = { content: 'test' }
			const result = withEphemeralReply(opts, false)

			expect(result.flags).toBeUndefined()
			expect(result.ephemeral).toBeUndefined()
		})

		it('should preserve existing content', () => {
			const opts: { content: string; flags?: number } = { content: 'my message' }
			const result = withEphemeralReply(opts, true)

			expect(result.content).toBe('my message')
		})
	})

	describe('getSage', () => {
		it('should return default sage options when no config provided', () => {
			const result = getSage()

			expect(result).toEqual(DEFAULT_SAGE)
		})

		it('should disable all sage options when commandConfig.sage is false', () => {
			const result = getSage({ sage: false })

			expect(result).toEqual({
				defer: false,
				deferBuffer: 0,
				ephemeral: false,
				errorReplies: false
			})
		})

		it('should disable all sage options when plugin sage is false and command sage is undefined', () => {
			setPluginState({
				serverRestrictions: new Map(),
				config: { sage: false }
			})

			const result = getSage()

			expect(result).toEqual({
				defer: false,
				deferBuffer: 0,
				ephemeral: false,
				errorReplies: false
			})
		})

		it('should merge command sage options with defaults', () => {
			const result = getSage({ sage: { defer: false, ephemeral: true } })

			expect(result).toEqual({
				...DEFAULT_SAGE,
				defer: false,
				ephemeral: true
			})
		})

		it('should use command deferBuffer over plugin deferBuffer', () => {
			setPluginState({
				serverRestrictions: new Map(),
				config: { sage: { deferBuffer: 500 } }
			})

			const result = getSage({ sage: { deferBuffer: 100 } })

			expect(result.deferBuffer).toBe(100)
		})

		it('should use plugin deferBuffer over timeouts.commandDeferral', () => {
			setPluginState({
				serverRestrictions: new Map(),
				config: {
					sage: { deferBuffer: 500 },
					timeouts: { commandDeferral: 300 }
				}
			})

			const result = getSage()

			expect(result.deferBuffer).toBe(500)
		})

		it('should use timeouts.commandDeferral over default', () => {
			setPluginState({
				serverRestrictions: new Map(),
				config: {
					timeouts: { commandDeferral: 300 }
				}
			})

			const result = getSage()

			expect(result.deferBuffer).toBe(300)
		})

		it('should merge plugin sage with command sage', () => {
			setPluginState({
				serverRestrictions: new Map(),
				config: { sage: { ephemeral: true, errorReplies: false } }
			})

			const result = getSage({ sage: { defer: false } })

			expect(result).toEqual({
				...DEFAULT_SAGE,
				defer: false,
				ephemeral: true,
				errorReplies: false
			})
		})
	})

	describe('timeout', () => {
		it('should resolve after the specified duration', async () => {
			const start = Date.now()
			await timeout(() => {}, 50)
			const elapsed = Date.now() - start

			expect(elapsed).toBeGreaterThanOrEqual(45) // Allow small timing variance
		})

		it('should return the callback result', async () => {
			const result = await timeout(() => 'done', 10)

			expect(result).toBe('done')
		})

		it('should return TIMEOUT symbol when callback returns it', async () => {
			const result = await timeout(() => TIMEOUT, 10)

			expect(result).toBe(TIMEOUT)
		})
	})

	describe('extractCommandOptions', () => {
		function createMockInteraction(optionGetters: Record<string, unknown> = {}) {
			return {
				options: {
					getString: fn((name: string) => optionGetters[`string:${name}`] ?? null),
					getInteger: fn((name: string) => optionGetters[`integer:${name}`] ?? null),
					getNumber: fn((name: string) => optionGetters[`number:${name}`] ?? null),
					getBoolean: fn((name: string) => optionGetters[`boolean:${name}`] ?? null),
					getAttachment: fn((name: string) => optionGetters[`attachment:${name}`] ?? null),
					getChannel: fn((name: string) => optionGetters[`channel:${name}`] ?? null),
					getMember: fn((name: string) => optionGetters[`member:${name}`] ?? null),
					getMentionable: fn((name: string) => optionGetters[`mention:${name}`] ?? null),
					getRole: fn((name: string) => optionGetters[`role:${name}`] ?? null),
					getUser: fn((name: string) => optionGetters[`user:${name}`] ?? null)
				}
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any
		}

		it('should extract string option', () => {
			const interaction = createMockInteraction({ 'string:query': 'search term' })
			const options = [{ name: 'query', type: 'string' as const }]

			const result = extractCommandOptions(interaction, options)

			expect(result).toEqual({ query: 'search term' })
		})

		it('should extract integer option', () => {
			const interaction = createMockInteraction({ 'integer:count': 42 })
			const options = [{ name: 'count', type: 'integer' as const }]

			const result = extractCommandOptions(interaction, options)

			expect(result).toEqual({ count: 42 })
		})

		it('should extract number option', () => {
			const interaction = createMockInteraction({ 'number:amount': 3.14 })
			const options = [{ name: 'amount', type: 'number' as const }]

			const result = extractCommandOptions(interaction, options)

			expect(result).toEqual({ amount: 3.14 })
		})

		it('should extract boolean option', () => {
			const interaction = createMockInteraction({ 'boolean:enabled': true })
			const options = [{ name: 'enabled', type: 'boolean' as const }]

			const result = extractCommandOptions(interaction, options)

			expect(result).toEqual({ enabled: true })
		})

		it('should extract user option', () => {
			const mockUser = { id: '123', username: 'test' }
			const interaction = createMockInteraction({ 'user:target': mockUser })
			const options = [{ name: 'target', type: 'user' as const }]

			const result = extractCommandOptions(interaction, options)

			expect(result).toEqual({ target: mockUser })
		})

		it('should extract channel option', () => {
			const mockChannel = { id: '456', name: 'general' }
			const interaction = createMockInteraction({ 'channel:channel': mockChannel })
			const options = [{ name: 'channel', type: 'channel' as const }]

			const result = extractCommandOptions(interaction, options)

			expect(result).toEqual({ channel: mockChannel })
		})

		it('should extract role option', () => {
			const mockRole = { id: '789', name: 'Admin' }
			const interaction = createMockInteraction({ 'role:role': mockRole })
			const options = [{ name: 'role', type: 'role' as const }]

			const result = extractCommandOptions(interaction, options)

			expect(result).toEqual({ role: mockRole })
		})

		it('should extract member option', () => {
			const mockMember = { id: '123', displayName: 'Test User' }
			const interaction = createMockInteraction({ 'member:member': mockMember })
			const options = [{ name: 'member', type: 'member' as const }]

			const result = extractCommandOptions(interaction, options)

			expect(result).toEqual({ member: mockMember })
		})

		it('should extract mentionable option', () => {
			const mockMentionable = { id: '123' }
			const interaction = createMockInteraction({ 'mention:target': mockMentionable })
			const options = [{ name: 'target', type: 'mention' as const }]

			const result = extractCommandOptions(interaction, options)

			expect(result).toEqual({ target: mockMentionable })
		})

		it('should extract attachment option', () => {
			const mockAttachment = { id: '999', name: 'file.png' }
			const interaction = createMockInteraction({ 'attachment:file': mockAttachment })
			const options = [{ name: 'file', type: 'attachment' as const }]

			const result = extractCommandOptions(interaction, options)

			expect(result).toEqual({ file: mockAttachment })
		})

		it('should default to string type when type not specified', () => {
			const interaction = createMockInteraction({ 'string:input': 'value' })
			const options = [{ name: 'input' }] // No type specified

			const result = extractCommandOptions(interaction, options)

			expect(result).toEqual({ input: 'value' })
		})

		it('should return undefined for missing optional options', () => {
			const interaction = createMockInteraction({})
			const options = [{ name: 'optional', type: 'string' as const, required: false }]

			const result = extractCommandOptions(interaction, options)

			expect(result).toEqual({ optional: undefined })
		})

		it('should extract multiple options', () => {
			const interaction = createMockInteraction({
				'string:name': 'John',
				'integer:age': 30,
				'boolean:active': true
			})
			const options = [
				{ name: 'name', type: 'string' as const },
				{ name: 'age', type: 'integer' as const },
				{ name: 'active', type: 'boolean' as const }
			]

			const result = extractCommandOptions(interaction, options)

			expect(result).toEqual({ name: 'John', age: 30, active: true })
		})

		it('should return empty object for undefined options', () => {
			const interaction = createMockInteraction({})

			const result = extractCommandOptions(interaction, undefined)

			expect(result).toEqual({})
		})
	})

	describe('patchDeferReply', () => {
		it('should prevent multiple deferrals', async () => {
			const originalDeferReply = fn().mockResolvedValue(undefined)
			const interaction = {
				deferReply: originalDeferReply,
				fetchReply: fn().mockResolvedValue({ id: '123' })
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any

			patchDeferReply(interaction)

			// Call deferReply twice
			await interaction.deferReply()
			await interaction.deferReply()

			// Original should only be called once
			expect(originalDeferReply).toHaveBeenCalledTimes(1)
		})

		it('should return same promise on subsequent calls', async () => {
			const originalDeferReply = fn().mockResolvedValue('first')
			const interaction = {
				deferReply: originalDeferReply,
				fetchReply: fn().mockResolvedValue({ id: '123' })
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any

			patchDeferReply(interaction)

			const result1 = await interaction.deferReply()
			const result2 = await interaction.deferReply()

			expect(result1).toBe(result2)
		})

		it('should handle fetchReply option on first call', async () => {
			const mockMessage = { id: '123', content: 'test' }
			const originalDeferReply = fn().mockResolvedValue(mockMessage)
			const interaction = {
				deferReply: originalDeferReply,
				fetchReply: fn().mockResolvedValue(mockMessage)
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any

			patchDeferReply(interaction)

			const result = await interaction.deferReply({ fetchReply: true })

			expect(result).toEqual(mockMessage)
		})

		it('should call fetchReply if requested after non-fetch defer', async () => {
			const mockMessage = { id: '123', content: 'test' }
			const originalDeferReply = fn().mockResolvedValue(undefined)
			const interaction = {
				deferReply: originalDeferReply,
				fetchReply: fn().mockResolvedValue(mockMessage)
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any

			patchDeferReply(interaction)

			// First call without fetchReply
			await interaction.deferReply()
			// Second call with fetchReply - should fetch
			const result = await interaction.deferReply({ fetchReply: true })

			expect(interaction.fetchReply).toHaveBeenCalled()
			expect(result).toEqual(mockMessage)
		})
	})

	describe('getCommandKey', () => {
		it('should return command name for simple command', () => {
			const interaction = {
				commandName: 'ping',
				options: {
					getSubcommandGroup: fn().mockImplementation(() => {
						throw new Error('No subcommand group')
					}),
					getSubcommand: fn().mockImplementation(() => {
						throw new Error('No subcommand')
					})
				}
			}

			const result = getCommandKey(interaction)

			expect(result).toBe('ping')
		})

		it('should include subcommand in key', () => {
			const interaction = {
				commandName: 'user',
				options: {
					getSubcommandGroup: fn().mockReturnValue(null),
					getSubcommand: fn().mockReturnValue('info')
				}
			}

			const result = getCommandKey(interaction)

			expect(result).toBe('user info')
		})

		it('should include subcommand group in key', () => {
			const interaction = {
				commandName: 'config',
				options: {
					getSubcommandGroup: fn().mockReturnValue('server'),
					getSubcommand: fn().mockReturnValue('set')
				}
			}

			const result = getCommandKey(interaction)

			expect(result).toBe('config server set')
		})

		it('should handle missing getSubcommandGroup method', () => {
			const interaction = {
				commandName: 'simple',
				options: {}
			}

			const result = getCommandKey(interaction)

			expect(result).toBe('simple')
		})

		it('should handle null subcommand group', () => {
			const interaction = {
				commandName: 'user',
				options: {
					getSubcommandGroup: fn().mockReturnValue(null),
					getSubcommand: fn().mockReturnValue('profile')
				}
			}

			const result = getCommandKey(interaction)

			expect(result).toBe('user profile')
		})

		it('should filter out empty strings', () => {
			const interaction = {
				commandName: 'test',
				options: {
					getSubcommandGroup: fn().mockReturnValue(''),
					getSubcommand: fn().mockReturnValue('action')
				}
			}

			const result = getCommandKey(interaction)

			// Empty string from group should be filtered
			expect(result).toBe('test action')
		})
	})
})
