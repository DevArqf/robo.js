/**
 * Tests for the permission system
 *
 * Ensures that:
 * - Permissions are correctly extracted from entries
 * - Guild overrides work properly
 * - Permission validation is accurate
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { PermissionFlagsBits } from 'discord.js'
import {
	PERMISSION_FLAGS,
	getPermissionNames,
	aggregateCommandPermissions,
	aggregateContextPermissions,
	setGuildPermissionOverride,
	getEffectivePermissions,
	hasRequiredPermissions,
	getMissingPermissions,
	combinePermissions
} from '../src/core/permissions.js'
import type { CommandEntry, ContextEntry } from '../src/types/index.js'
import { logger } from 'robo.js'

// Get the forked logger mock
const mockLogger = logger.fork('discordjs')

describe('Permission System', () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe('PERMISSION_FLAGS', () => {
		it('should export PermissionFlagsBits', () => {
			expect(PERMISSION_FLAGS).toBe(PermissionFlagsBits)
		})

		it('should have common permission flags', () => {
			expect(PERMISSION_FLAGS.Administrator).toBeDefined()
			expect(PERMISSION_FLAGS.ManageGuild).toBeDefined()
			expect(PERMISSION_FLAGS.BanMembers).toBeDefined()
			expect(PERMISSION_FLAGS.KickMembers).toBeDefined()
		})
	})

	describe('getPermissionNames', () => {
		it('should return empty array for null permissions', () => {
			expect(getPermissionNames(null)).toEqual([])
		})

		it('should return empty array for undefined permissions', () => {
			expect(getPermissionNames(undefined)).toEqual([])
		})

		it('should convert single permission bit to name', () => {
			const names = getPermissionNames(PermissionFlagsBits.Administrator)
			expect(names).toContain('Administrator')
		})

		it('should convert multiple permission bits to names', () => {
			const perms = PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers
			const names = getPermissionNames(perms)
			expect(names).toContain('BanMembers')
			expect(names).toContain('KickMembers')
		})

		it('should handle string permissions', () => {
			const permStr = PermissionFlagsBits.Administrator.toString()
			const names = getPermissionNames(permStr)
			expect(names).toContain('Administrator')
		})

		it('should handle number permissions', () => {
			const names = getPermissionNames(Number(PermissionFlagsBits.ManageGuild))
			expect(names).toContain('ManageGuild')
		})

		it('should return empty array for zero permissions', () => {
			expect(getPermissionNames(0n)).toEqual([])
		})
	})

	describe('aggregateCommandPermissions', () => {
		it('should aggregate permissions from command entries', () => {
			const commands: Record<string, CommandEntry> = {
				ban: {
					key: 'ban',
					path: '/commands/ban.js',
					defaultMemberPermissions: PermissionFlagsBits.BanMembers.toString()
				} as CommandEntry
			}

			const result = aggregateCommandPermissions(commands)

			expect(result.has('ban')).toBe(true)
			expect(result.get('ban')?.defaultMemberPermissions).toBe(PermissionFlagsBits.BanMembers)
			expect(result.get('ban')?.permissionNames).toContain('BanMembers')
		})

		it('should handle commands without permissions', () => {
			const commands: Record<string, CommandEntry> = {
				ping: {
					key: 'ping',
					path: '/commands/ping.js'
				} as CommandEntry
			}

			const result = aggregateCommandPermissions(commands)

			expect(result.has('ping')).toBe(true)
			expect(result.get('ping')?.defaultMemberPermissions).toBeNull()
			expect(result.get('ping')?.permissionNames).toEqual([])
		})

		it('should process subcommands recursively', () => {
			const commands: Record<string, CommandEntry> = {
				mod: {
					key: 'mod',
					path: '/commands/mod.js',
					subcommands: {
						ban: {
							key: 'ban',
							path: '/commands/mod/ban.js',
							defaultMemberPermissions: PermissionFlagsBits.BanMembers.toString()
						} as CommandEntry,
						kick: {
							key: 'kick',
							path: '/commands/mod/kick.js',
							defaultMemberPermissions: PermissionFlagsBits.KickMembers.toString()
						} as CommandEntry
					}
				} as CommandEntry
			}

			const result = aggregateCommandPermissions(commands)

			expect(result.has('mod')).toBe(true)
			expect(result.has('mod ban')).toBe(true)
			expect(result.has('mod kick')).toBe(true)
			expect(result.get('mod ban')?.permissionNames).toContain('BanMembers')
			expect(result.get('mod kick')?.permissionNames).toContain('KickMembers')
		})

		it('should initialize empty guild overrides', () => {
			const commands: Record<string, CommandEntry> = {
				test: { key: 'test', path: '/test.js' } as CommandEntry
			}

			const result = aggregateCommandPermissions(commands)

			expect(result.get('test')?.guildOverrides).toBeInstanceOf(Map)
			expect(result.get('test')?.guildOverrides.size).toBe(0)
		})

		it('should handle empty commands object', () => {
			const result = aggregateCommandPermissions({})
			expect(result.size).toBe(0)
		})
	})

	describe('aggregateContextPermissions', () => {
		it('should aggregate permissions from context menu entries', () => {
			const contextMenus: Record<string, ContextEntry> = {
				'Ban User': {
					key: 'Ban User',
					path: '/context/ban.js',
					type: 'user',
					defaultMemberPermissions: PermissionFlagsBits.BanMembers.toString()
				} as ContextEntry
			}

			const result = aggregateContextPermissions(contextMenus)

			expect(result.has('Ban User')).toBe(true)
			expect(result.get('Ban User')?.defaultMemberPermissions).toBe(PermissionFlagsBits.BanMembers)
		})

		it('should handle context menus without permissions', () => {
			const contextMenus: Record<string, ContextEntry> = {
				'User Info': {
					key: 'User Info',
					path: '/context/info.js',
					type: 'user'
				} as ContextEntry
			}

			const result = aggregateContextPermissions(contextMenus)

			expect(result.get('User Info')?.defaultMemberPermissions).toBeNull()
		})

		it('should handle empty context menus object', () => {
			const result = aggregateContextPermissions({})
			expect(result.size).toBe(0)
		})
	})

	describe('setGuildPermissionOverride', () => {
		it('should set guild-specific permission override', () => {
			const permissions = new Map([
				[
					'ban',
					{
						defaultMemberPermissions: PermissionFlagsBits.BanMembers,
						permissionNames: ['BanMembers'],
						guildOverrides: new Map<string, bigint>()
					}
				]
			])

			setGuildPermissionOverride(permissions, 'ban', 'guild-123', PermissionFlagsBits.Administrator)

			expect(permissions.get('ban')?.guildOverrides.get('guild-123')).toBe(PermissionFlagsBits.Administrator)
		})

		it('should warn when command not found', () => {
			const permissions = new Map()

			setGuildPermissionOverride(permissions, 'nonexistent', 'guild-123', 0n)

			expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('not found'))
		})

		it('should allow multiple guild overrides', () => {
			const permissions = new Map([
				[
					'test',
					{
						defaultMemberPermissions: null,
						permissionNames: [],
						guildOverrides: new Map<string, bigint>()
					}
				]
			])

			setGuildPermissionOverride(permissions, 'test', 'guild-1', PermissionFlagsBits.BanMembers)
			setGuildPermissionOverride(permissions, 'test', 'guild-2', PermissionFlagsBits.KickMembers)

			expect(permissions.get('test')?.guildOverrides.size).toBe(2)
		})
	})

	describe('getEffectivePermissions', () => {
		it('should return default permissions when no guild override', () => {
			const permissions = new Map([
				[
					'ban',
					{
						defaultMemberPermissions: PermissionFlagsBits.BanMembers,
						permissionNames: ['BanMembers'],
						guildOverrides: new Map<string, bigint>()
					}
				]
			])

			const result = getEffectivePermissions(permissions, 'ban')

			expect(result).toBe(PermissionFlagsBits.BanMembers)
		})

		it('should return guild override when present', () => {
			const permissions = new Map([
				[
					'ban',
					{
						defaultMemberPermissions: PermissionFlagsBits.BanMembers,
						permissionNames: ['BanMembers'],
						guildOverrides: new Map([['guild-123', PermissionFlagsBits.Administrator]])
					}
				]
			])

			const result = getEffectivePermissions(permissions, 'ban', 'guild-123')

			expect(result).toBe(PermissionFlagsBits.Administrator)
		})

		it('should fallback to default when guild has no override', () => {
			const permissions = new Map([
				[
					'ban',
					{
						defaultMemberPermissions: PermissionFlagsBits.BanMembers,
						permissionNames: ['BanMembers'],
						guildOverrides: new Map([['other-guild', PermissionFlagsBits.Administrator]])
					}
				]
			])

			const result = getEffectivePermissions(permissions, 'ban', 'guild-123')

			expect(result).toBe(PermissionFlagsBits.BanMembers)
		})

		it('should return null for unknown command', () => {
			const permissions = new Map()

			const result = getEffectivePermissions(permissions, 'unknown')

			expect(result).toBeNull()
		})
	})

	describe('hasRequiredPermissions', () => {
		it('should return true when user has all required permissions', () => {
			const userPerms = PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers
			const required = PermissionFlagsBits.BanMembers

			expect(hasRequiredPermissions(userPerms, required)).toBe(true)
		})

		it('should return false when user missing permissions', () => {
			const userPerms = PermissionFlagsBits.KickMembers
			const required = PermissionFlagsBits.BanMembers

			expect(hasRequiredPermissions(userPerms, required)).toBe(false)
		})

		it('should return true when no permissions required', () => {
			expect(hasRequiredPermissions(0n, null)).toBe(true)
		})

		it('should handle multiple required permissions', () => {
			const userPerms = PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers
			const required = PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers

			expect(hasRequiredPermissions(userPerms, required)).toBe(true)
		})

		it('should return false when missing one of multiple required', () => {
			const userPerms = PermissionFlagsBits.BanMembers
			const required = PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers

			expect(hasRequiredPermissions(userPerms, required)).toBe(false)
		})
	})

	describe('getMissingPermissions', () => {
		it('should return empty array when user has all permissions', () => {
			const userPerms = PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers
			const required = PermissionFlagsBits.BanMembers

			expect(getMissingPermissions(userPerms, required)).toEqual([])
		})

		it('should return missing permission names', () => {
			const userPerms = 0n
			const required = PermissionFlagsBits.BanMembers

			const missing = getMissingPermissions(userPerms, required)
			expect(missing).toContain('BanMembers')
		})

		it('should return empty array when no permissions required', () => {
			expect(getMissingPermissions(0n, null)).toEqual([])
		})

		it('should return multiple missing permissions', () => {
			const userPerms = 0n
			const required = PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers

			const missing = getMissingPermissions(userPerms, required)
			expect(missing).toContain('BanMembers')
			expect(missing).toContain('KickMembers')
		})

		it('should only return actually missing permissions', () => {
			const userPerms = PermissionFlagsBits.BanMembers
			const required = PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers

			const missing = getMissingPermissions(userPerms, required)
			expect(missing).not.toContain('BanMembers')
			expect(missing).toContain('KickMembers')
		})
	})

	describe('combinePermissions', () => {
		it('should combine multiple permission bitfields', () => {
			const result = combinePermissions(PermissionFlagsBits.BanMembers, PermissionFlagsBits.KickMembers)

			expect(result).toBe(PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers)
		})

		it('should handle null values', () => {
			const result = combinePermissions(PermissionFlagsBits.BanMembers, null)

			expect(result).toBe(PermissionFlagsBits.BanMembers)
		})

		it('should handle undefined values', () => {
			const result = combinePermissions(PermissionFlagsBits.BanMembers, undefined)

			expect(result).toBe(PermissionFlagsBits.BanMembers)
		})

		it('should return 0n for empty input', () => {
			expect(combinePermissions()).toBe(0n)
		})

		it('should return 0n for all null/undefined', () => {
			expect(combinePermissions(null, undefined, null)).toBe(0n)
		})

		it('should deduplicate overlapping permissions', () => {
			const result = combinePermissions(
				PermissionFlagsBits.BanMembers,
				PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers
			)

			// Should be same as just BanMembers | KickMembers
			expect(result).toBe(PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers)
		})
	})
})
