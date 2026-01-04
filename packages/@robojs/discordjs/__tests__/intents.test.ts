/**
 * Tests for the intent inference system
 *
 * Ensures that:
 * - Intents are correctly inferred from event names
 * - Missing intents are detected and warnings are logged
 * - Intent validation provides helpful suggestions
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { GatewayIntentBits } from 'discord.js'
import { REQUIRED_INTENTS, checkIntents, inferIntents, getIntentNames, validateIntents } from '../src/core/intents.js'
import { createMockClient } from './helpers/discord-mocks.js'
import { logger } from 'robo.js'

// Get the forked logger mock
const mockLogger = logger.fork('discordjs')

describe('Intent System', () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe('REQUIRED_INTENTS mapping', () => {
		it('should map guild events to Guilds intent', () => {
			expect(REQUIRED_INTENTS.guildCreate).toBe(GatewayIntentBits.Guilds)
			expect(REQUIRED_INTENTS.guildUpdate).toBe(GatewayIntentBits.Guilds)
			expect(REQUIRED_INTENTS.guildDelete).toBe(GatewayIntentBits.Guilds)
		})

		it('should map channel events to Guilds intent', () => {
			expect(REQUIRED_INTENTS.channelCreate).toBe(GatewayIntentBits.Guilds)
			expect(REQUIRED_INTENTS.channelUpdate).toBe(GatewayIntentBits.Guilds)
			expect(REQUIRED_INTENTS.channelDelete).toBe(GatewayIntentBits.Guilds)
		})

		it('should map member events to GuildMembers intent', () => {
			expect(REQUIRED_INTENTS.guildMemberAdd).toBe(GatewayIntentBits.GuildMembers)
			expect(REQUIRED_INTENTS.guildMemberUpdate).toBe(GatewayIntentBits.GuildMembers)
			expect(REQUIRED_INTENTS.guildMemberRemove).toBe(GatewayIntentBits.GuildMembers)
		})

		it('should map moderation events to GuildModeration intent', () => {
			expect(REQUIRED_INTENTS.guildBanAdd).toBe(GatewayIntentBits.GuildModeration)
			expect(REQUIRED_INTENTS.guildBanRemove).toBe(GatewayIntentBits.GuildModeration)
			expect(REQUIRED_INTENTS.guildAuditLogEntryCreate).toBe(GatewayIntentBits.GuildModeration)
		})

		it('should map message events to array of possible intents', () => {
			expect(REQUIRED_INTENTS.messageCreate).toEqual([
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.DirectMessages
			])
			expect(REQUIRED_INTENTS.messageUpdate).toEqual([
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.DirectMessages
			])
			expect(REQUIRED_INTENTS.messageDelete).toEqual([
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.DirectMessages
			])
		})

		it('should map reaction events to GuildMessageReactions intent', () => {
			expect(REQUIRED_INTENTS.messageReactionAdd).toBe(GatewayIntentBits.GuildMessageReactions)
			expect(REQUIRED_INTENTS.messageReactionRemove).toBe(GatewayIntentBits.GuildMessageReactions)
		})

		it('should map presence events to GuildPresences intent', () => {
			expect(REQUIRED_INTENTS.presenceUpdate).toBe(GatewayIntentBits.GuildPresences)
		})

		it('should map voice events to GuildVoiceStates intent', () => {
			expect(REQUIRED_INTENTS.voiceStateUpdate).toBe(GatewayIntentBits.GuildVoiceStates)
		})

		it('should map auto moderation events correctly', () => {
			expect(REQUIRED_INTENTS.autoModerationRuleCreate).toBe(GatewayIntentBits.AutoModerationConfiguration)
			expect(REQUIRED_INTENTS.autoModerationActionExecution).toBe(GatewayIntentBits.AutoModerationExecution)
		})

		it('should not have mapping for events that dont require intents', () => {
			// Events like 'ready', 'interactionCreate' don't require specific intents
			expect(REQUIRED_INTENTS.ready).toBeUndefined()
			expect(REQUIRED_INTENTS.interactionCreate).toBeUndefined()
			expect(REQUIRED_INTENTS.clientReady).toBeUndefined()
		})
	})

	describe('inferIntents', () => {
		it('should return empty set for events without required intents', () => {
			const result = inferIntents(['ready', 'interactionCreate', 'clientReady'])
			expect(result.size).toBe(0)
		})

		it('should infer Guilds intent from guild events', () => {
			const result = inferIntents(['guildCreate', 'guildUpdate'])
			expect(result.has(GatewayIntentBits.Guilds)).toBe(true)
			expect(result.size).toBe(1)
		})

		it('should infer GuildMembers intent from member events', () => {
			const result = inferIntents(['guildMemberAdd'])
			expect(result.has(GatewayIntentBits.GuildMembers)).toBe(true)
		})

		it('should infer multiple intents from message events', () => {
			const result = inferIntents(['messageCreate'])
			expect(result.has(GatewayIntentBits.GuildMessages)).toBe(true)
			expect(result.has(GatewayIntentBits.DirectMessages)).toBe(true)
		})

		it('should aggregate intents from multiple events', () => {
			const result = inferIntents(['guildCreate', 'guildMemberAdd', 'presenceUpdate'])
			expect(result.has(GatewayIntentBits.Guilds)).toBe(true)
			expect(result.has(GatewayIntentBits.GuildMembers)).toBe(true)
			expect(result.has(GatewayIntentBits.GuildPresences)).toBe(true)
			expect(result.size).toBe(3)
		})

		it('should handle empty event list', () => {
			const result = inferIntents([])
			expect(result.size).toBe(0)
		})

		it('should handle unknown event names gracefully', () => {
			const result = inferIntents(['unknownEvent', 'anotherUnknown'])
			expect(result.size).toBe(0)
		})

		it('should deduplicate intents from multiple events requiring same intent', () => {
			const result = inferIntents(['guildCreate', 'guildUpdate', 'guildDelete', 'channelCreate'])
			expect(result.has(GatewayIntentBits.Guilds)).toBe(true)
			expect(result.size).toBe(1) // All require Guilds, should only appear once
		})
	})

	describe('getIntentNames', () => {
		it('should convert single intent bit to name', () => {
			const intents = new Set([GatewayIntentBits.Guilds])
			const names = getIntentNames(intents)
			expect(names).toContain('Guilds')
		})

		it('should convert multiple intent bits to names', () => {
			const intents = new Set([GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers])
			const names = getIntentNames(intents)
			expect(names).toContain('Guilds')
			expect(names).toContain('GuildMembers')
		})

		it('should handle empty set', () => {
			const names = getIntentNames(new Set())
			expect(names).toEqual([])
		})

		it('should handle unknown intent bits', () => {
			const intents = new Set([999999 as GatewayIntentBits])
			const names = getIntentNames(intents)
			expect(names[0]).toContain('Unknown')
		})
	})

	describe('checkIntents', () => {
		it('should not warn when all required intents are present', () => {
			const client = createMockClient({
				intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMembers
			})
			const events = {
				guildCreate: [{}],
				guildMemberAdd: [{}]
			}

			checkIntents(client, events)

			expect(mockLogger.warn).not.toHaveBeenCalled()
		})

		it('should warn about missing single intent', () => {
			const client = createMockClient({
				intents: GatewayIntentBits.Guilds // Missing GuildMembers
			})
			const events = {
				guildCreate: [{}],
				guildMemberAdd: [{}] // Requires GuildMembers
			}

			checkIntents(client, events)

			expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Missing intents'))
			expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('GuildMembers'))
		})

		it('should warn about multiple missing intents', () => {
			const client = createMockClient({
				intents: 0 // No intents
			})
			const events = {
				guildCreate: [{}], // Requires Guilds
				guildMemberAdd: [{}], // Requires GuildMembers
				presenceUpdate: [{}] // Requires GuildPresences
			}

			checkIntents(client, events)

			expect(mockLogger.warn).toHaveBeenCalled()
		})

		it('should not warn for events with any of multiple possible intents', () => {
			const client = createMockClient({
				intents: GatewayIntentBits.GuildMessages // Has one of the required
			})
			const events = {
				messageCreate: [{}] // Requires GuildMessages OR DirectMessages
			}

			checkIntents(client, events)

			expect(mockLogger.warn).not.toHaveBeenCalled()
		})

		it('should warn when none of the possible intents are present', () => {
			const client = createMockClient({
				intents: GatewayIntentBits.Guilds // Has neither GuildMessages nor DirectMessages
			})
			const events = {
				messageCreate: [{}] // Requires GuildMessages OR DirectMessages
			}

			checkIntents(client, events)

			expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Missing intents'))
		})

		it('should skip events that dont require intents', () => {
			const client = createMockClient({
				intents: 0 // No intents
			})
			const events = {
				ready: [{}],
				interactionCreate: [{}],
				clientReady: [{}]
			}

			checkIntents(client, events)

			// Should not warn because these events don't require specific intents
			expect(mockLogger.warn).not.toHaveBeenCalled()
		})

		it('should handle empty events object', () => {
			const client = createMockClient({ intents: 0 })
			checkIntents(client, {})
			expect(mockLogger.warn).not.toHaveBeenCalled()
		})
	})

	describe('validateIntents', () => {
		it('should return valid:true when all intents are present', () => {
			const intents = GatewayIntentBits.Guilds | GatewayIntentBits.GuildMembers
			const result = validateIntents(intents, ['guildCreate', 'guildMemberAdd'])

			expect(result.valid).toBe(true)
			expect(result.missing).toEqual([])
			expect(result.suggestions).toEqual([])
		})

		it('should return valid:false with missing intents list', () => {
			const intents = GatewayIntentBits.Guilds // Missing GuildMembers
			const result = validateIntents(intents, ['guildCreate', 'guildMemberAdd'])

			expect(result.valid).toBe(false)
			expect(result.missing).toContain('guildMemberAdd')
		})

		it('should provide helpful suggestions for missing intents', () => {
			const intents = 0 // No intents
			const result = validateIntents(intents, ['guildMemberAdd'])

			expect(result.suggestions.length).toBeGreaterThan(0)
			expect(result.suggestions[0]).toContain('guildMemberAdd')
			expect(result.suggestions[0]).toContain('GuildMembers')
		})

		it('should provide suggestions for events with multiple possible intents', () => {
			const intents = 0 // No intents
			const result = validateIntents(intents, ['messageCreate'])

			expect(result.valid).toBe(false)
			expect(result.missing).toContain('messageCreate')
			expect(result.suggestions[0]).toContain('messageCreate')
			expect(result.suggestions[0]).toContain('GuildMessages')
			expect(result.suggestions[0]).toContain('DirectMessages')
		})

		it('should handle events that dont require intents', () => {
			const result = validateIntents(0, ['ready', 'interactionCreate'])

			expect(result.valid).toBe(true)
			expect(result.missing).toEqual([])
		})

		it('should handle bigint intents', () => {
			const intents = BigInt(GatewayIntentBits.Guilds)
			const result = validateIntents(intents, ['guildCreate'])

			expect(result.valid).toBe(true)
		})

		it('should handle empty event list', () => {
			const result = validateIntents(0, [])

			expect(result.valid).toBe(true)
			expect(result.missing).toEqual([])
		})
	})
})
