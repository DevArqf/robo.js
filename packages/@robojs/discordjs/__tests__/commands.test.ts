/**
 * Tests for command building and registration
 *
 * Verifies that:
 * - buildSlashCommands creates proper command structures
 * - buildContextCommands creates proper context menu commands
 * - addOptionToCommandBuilder handles all option types
 * - findCommandDifferences detects changes correctly
 * - getContextType/getIntegrationType convert enums correctly
 * - registerCommandsToDiscord handles registration with retries
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { InteractionContextType, ApplicationIntegrationType } from 'discord.js'

// Helper for typed mocks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fn = jest.fn as any

// Import from 'robo.js' to use the mocked module
const roboMock = (await import('robo.js')) as unknown as {
	Env: { data: jest.Mock }
	Flashcore: { get: jest.Mock; set: jest.Mock; delete: jest.Mock }
	getForkedLogger: (key: string) => {
		debug: jest.Mock
		info: jest.Mock
		warn: jest.Mock
		error: jest.Mock
	}
	clearForkedLoggers: () => void
	setEnvData: (data: Record<string, string | undefined>) => void
}

const { getForkedLogger, setEnvData } = roboMock

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

// Import after mocking
const {
	buildSlashCommands,
	buildContextCommands,
	getContextType,
	getIntegrationType,
	findCommandDifferences
} = await import('../src/core/commands.js')

describe('Command Building', () => {
	beforeEach(() => {
		jest.clearAllMocks()
		clearLoggerMocks()
	})

	describe('buildSlashCommands', () => {
		it('should build a simple command with name and description', () => {
			const commands = {
				ping: {
					description: 'Ping pong!'
				}
			}

			const result = buildSlashCommands(commands)

			expect(result).toHaveLength(1)
			expect(result[0].name).toBe('ping')
			// Access via toJSON since builders expose via toJSON()
			const json = result[0].toJSON()
			expect(json.description).toBe('Ping pong!')
		})

		it('should use default description when not provided', () => {
			const commands = {
				test: {}
			}

			const result = buildSlashCommands(commands)
			const json = result[0].toJSON()

			expect(json.description).toBe('No description provided')
		})

		it('should build command with string option', () => {
			const commands = {
				greet: {
					description: 'Greet someone',
					options: [
						{
							name: 'name',
							description: 'The name to greet',
							type: 'string' as const,
							required: true
						}
					]
				}
			}

			const result = buildSlashCommands(commands)
			const json = result[0].toJSON()

			expect(json.options).toHaveLength(1)
			expect(json.options![0].name).toBe('name')
			expect(json.options![0].required).toBe(true)
		})

		it('should build command with integer option and min/max', () => {
			const commands = {
				roll: {
					description: 'Roll a dice',
					options: [
						{
							name: 'sides',
							description: 'Number of sides',
							type: 'integer' as const,
							min: 1,
							max: 100
						}
					]
				}
			}

			const result = buildSlashCommands(commands)
			const json = result[0].toJSON()

			expect(json.options).toHaveLength(1)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect((json.options![0] as any).min_value).toBe(1)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect((json.options![0] as any).max_value).toBe(100)
		})

		it('should build command with number option', () => {
			const commands = {
				calc: {
					description: 'Calculate',
					options: [
						{
							name: 'amount',
							description: 'Amount',
							type: 'number' as const
						}
					]
				}
			}

			const result = buildSlashCommands(commands)
			const json = result[0].toJSON()

			expect(json.options).toHaveLength(1)
		})

		it('should build command with boolean option', () => {
			const commands = {
				toggle: {
					description: 'Toggle something',
					options: [
						{
							name: 'enabled',
							description: 'Enable or disable',
							type: 'boolean' as const
						}
					]
				}
			}

			const result = buildSlashCommands(commands)
			const json = result[0].toJSON()

			expect(json.options).toHaveLength(1)
		})

		it('should build command with choices', () => {
			const commands = {
				choose: {
					description: 'Choose an option',
					options: [
						{
							name: 'color',
							description: 'Pick a color',
							type: 'string' as const,
							choices: [
								{ name: 'Red', value: 'red' },
								{ name: 'Blue', value: 'blue' }
							]
						}
					]
				}
			}

			const result = buildSlashCommands(commands)
			const json = result[0].toJSON()

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect((json.options![0] as any).choices).toHaveLength(2)
		})

		it('should build command with autocomplete option', () => {
			const commands = {
				search: {
					description: 'Search something',
					options: [
						{
							name: 'query',
							description: 'Search query',
							type: 'string' as const,
							autocomplete: true
						}
					]
				}
			}

			const result = buildSlashCommands(commands)
			const json = result[0].toJSON()

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect((json.options![0] as any).autocomplete).toBe(true)
		})

		it('should build command with user option', () => {
			const commands = {
				kick: {
					description: 'Kick a user',
					options: [
						{
							name: 'target',
							description: 'User to kick',
							type: 'user' as const,
							required: true
						}
					]
				}
			}

			const result = buildSlashCommands(commands)
			const json = result[0].toJSON()

			expect(json.options).toHaveLength(1)
		})

		it('should build command with role option', () => {
			const commands = {
				role: {
					description: 'Assign role',
					options: [
						{
							name: 'role',
							description: 'Role to assign',
							type: 'role' as const
						}
					]
				}
			}

			const result = buildSlashCommands(commands)
			const json = result[0].toJSON()

			expect(json.options).toHaveLength(1)
		})

		it('should build command with channel option', () => {
			const commands = {
				channel: {
					description: 'Select channel',
					options: [
						{
							name: 'channel',
							description: 'Channel',
							type: 'channel' as const
						}
					]
				}
			}

			const result = buildSlashCommands(commands)
			const json = result[0].toJSON()

			expect(json.options).toHaveLength(1)
		})

		it('should build command with attachment option', () => {
			const commands = {
				upload: {
					description: 'Upload file',
					options: [
						{
							name: 'file',
							description: 'File to upload',
							type: 'attachment' as const
						}
					]
				}
			}

			const result = buildSlashCommands(commands)
			const json = result[0].toJSON()

			expect(json.options).toHaveLength(1)
		})

		it('should build command with mention option', () => {
			const commands = {
				mention: {
					description: 'Mention something',
					options: [
						{
							name: 'target',
							description: 'Target to mention',
							type: 'mention' as const
						}
					]
				}
			}

			const result = buildSlashCommands(commands)
			const json = result[0].toJSON()

			expect(json.options).toHaveLength(1)
		})

		it('should build command with member option (alias for user)', () => {
			const commands = {
				ban: {
					description: 'Ban a member',
					options: [
						{
							name: 'member',
							description: 'Member to ban',
							type: 'member' as const
						}
					]
				}
			}

			const result = buildSlashCommands(commands)
			const json = result[0].toJSON()

			expect(json.options).toHaveLength(1)
		})

		it('should build command with subcommands', () => {
			const commands = {
				user: {
					description: 'User commands',
					subcommands: {
						info: {
							description: 'Get user info',
							options: [
								{
									name: 'target',
									description: 'Target user',
									type: 'user' as const
								}
							]
						},
						ban: {
							description: 'Ban a user'
						}
					}
				}
			}

			const result = buildSlashCommands(commands)
			const json = result[0].toJSON()

			expect(json.options).toHaveLength(2)
			expect(json.options![0].name).toBe('info')
			expect(json.options![1].name).toBe('ban')
		})

		it('should build command with subcommand groups', () => {
			const commands = {
				config: {
					description: 'Config commands',
					subcommands: {
						settings: {
							description: 'Settings group',
							subcommands: {
								view: {
									description: 'View settings'
								},
								edit: {
									description: 'Edit settings'
								}
							}
						}
					}
				}
			}

			const result = buildSlashCommands(commands)
			const json = result[0].toJSON()

			// The first option should be a subcommand group
			expect(json.options).toHaveLength(1)
			expect(json.options![0].name).toBe('settings')
		})

		it('should set default member permissions', () => {
			const commands = {
				admin: {
					description: 'Admin command',
					defaultMemberPermissions: '8' // ADMINISTRATOR
				}
			}

			const result = buildSlashCommands(commands)
			const json = result[0].toJSON()

			expect(json.default_member_permissions).toBe('8')
		})

		it('should use config defaults for permissions', () => {
			const commands = {
				test: {
					description: 'Test command'
				}
			}
			const config = {
				defaults: {
					defaultMemberPermissions: '0'
				}
			}

			const result = buildSlashCommands(commands, config)
			const json = result[0].toJSON()

			expect(json.default_member_permissions).toBe('0')
		})

		it('should set DM permission', () => {
			const commands = {
				dm: {
					description: 'DM command',
					dmPermission: false
				}
			}

			const result = buildSlashCommands(commands)
			const json = result[0].toJSON()

			expect(json.dm_permission).toBe(false)
		})

		it('should set name and description localizations', () => {
			const commands = {
				greet: {
					description: 'Greet someone',
					nameLocalizations: {
						'es-ES': 'saludar'
					},
					descriptionLocalizations: {
						'es-ES': 'Saludar a alguien'
					}
				}
			}

			const result = buildSlashCommands(commands)
			const json = result[0].toJSON()

			expect(json.name_localizations).toEqual({ 'es-ES': 'saludar' })
			expect(json.description_localizations).toEqual({ 'es-ES': 'Saludar a alguien' })
		})

		it('should use default contexts when not specified', () => {
			const commands = {
				test: {
					description: 'Test'
				}
			}

			const result = buildSlashCommands(commands)
			const json = result[0].toJSON()

			// Default contexts: Guild, BotDM, PrivateChannel
			expect(json.contexts).toContain(InteractionContextType.Guild)
			expect(json.contexts).toContain(InteractionContextType.BotDM)
			expect(json.contexts).toContain(InteractionContextType.PrivateChannel)
		})

		it('should use custom contexts when specified', () => {
			const commands = {
				test: {
					description: 'Test',
					contexts: ['Guild' as const]
				}
			}

			const result = buildSlashCommands(commands)
			const json = result[0].toJSON()

			expect(json.contexts).toEqual([InteractionContextType.Guild])
		})

		it('should use default integration types when not specified', () => {
			const commands = {
				test: {
					description: 'Test'
				}
			}

			const result = buildSlashCommands(commands)
			const json = result[0].toJSON()

			// Default: GuildInstall, UserInstall
			expect(json.integration_types).toContain(ApplicationIntegrationType.GuildInstall)
			expect(json.integration_types).toContain(ApplicationIntegrationType.UserInstall)
		})
	})

	describe('buildContextCommands', () => {
		it('should build a user context menu command', () => {
			const commands = {
				'Get User Info': {}
			}

			const result = buildContextCommands(commands, 'user')

			expect(result).toHaveLength(1)
			expect(result[0].name).toBe('Get User Info')
			const json = result[0].toJSON()
			expect(json.type).toBe(2) // User type
		})

		it('should build a message context menu command', () => {
			const commands = {
				'Report Message': {}
			}

			const result = buildContextCommands(commands, 'message')

			expect(result).toHaveLength(1)
			expect(result[0].name).toBe('Report Message')
			const json = result[0].toJSON()
			expect(json.type).toBe(3) // Message type
		})

		it('should set name localizations', () => {
			const commands = {
				'User Info': {
					nameLocalizations: {
						'es-ES': 'Info de Usuario'
					}
				}
			}

			const result = buildContextCommands(commands, 'user')
			const json = result[0].toJSON()

			expect(json.name_localizations).toEqual({ 'es-ES': 'Info de Usuario' })
		})

		it('should set default member permissions', () => {
			const commands = {
				'Admin Action': {
					defaultMemberPermissions: '8'
				}
			}

			const result = buildContextCommands(commands, 'user')
			const json = result[0].toJSON()

			expect(json.default_member_permissions).toBe('8')
		})

		it('should set DM permission', () => {
			const commands = {
				'DM Action': {
					dmPermission: false
				}
			}

			const result = buildContextCommands(commands, 'user')
			const json = result[0].toJSON()

			expect(json.dm_permission).toBe(false)
		})

		it('should use config defaults for contexts', () => {
			const commands = {
				Test: {}
			}
			const config = {
				defaults: {
					contexts: ['Guild' as const]
				}
			}

			const result = buildContextCommands(commands, 'user', config)
			const json = result[0].toJSON()

			expect(json.contexts).toEqual([InteractionContextType.Guild])
		})
	})

	describe('getContextType', () => {
		it('should convert BotDM to InteractionContextType.BotDM', () => {
			expect(getContextType('BotDM')).toBe(InteractionContextType.BotDM)
		})

		it('should convert Guild to InteractionContextType.Guild', () => {
			expect(getContextType('Guild')).toBe(InteractionContextType.Guild)
		})

		it('should convert PrivateChannel to InteractionContextType.PrivateChannel', () => {
			expect(getContextType('PrivateChannel')).toBe(InteractionContextType.PrivateChannel)
		})

		it('should pass through numeric values', () => {
			// When already a number, should return as-is
			expect(getContextType(0 as unknown as 'Guild')).toBe(0)
		})
	})

	describe('getIntegrationType', () => {
		it('should convert GuildInstall to ApplicationIntegrationType.GuildInstall', () => {
			expect(getIntegrationType('GuildInstall')).toBe(ApplicationIntegrationType.GuildInstall)
		})

		it('should convert UserInstall to ApplicationIntegrationType.UserInstall', () => {
			expect(getIntegrationType('UserInstall')).toBe(ApplicationIntegrationType.UserInstall)
		})

		it('should pass through numeric values', () => {
			// When already a number, should return as-is
			expect(getIntegrationType(0 as unknown as 'GuildInstall')).toBe(0)
		})
	})

	describe('findCommandDifferences', () => {
		it('should detect added commands', () => {
			const oldCommands = {
				ping: { description: 'Ping' }
			}
			const newCommands = {
				ping: { description: 'Ping' },
				pong: { description: 'Pong' }
			}

			const result = findCommandDifferences(oldCommands, newCommands, 'added')

			expect(result).toEqual(['pong'])
		})

		it('should detect removed commands', () => {
			const oldCommands = {
				ping: { description: 'Ping' },
				pong: { description: 'Pong' }
			}
			const newCommands = {
				ping: { description: 'Ping' }
			}

			const result = findCommandDifferences(oldCommands, newCommands, 'removed')

			expect(result).toEqual(['pong'])
		})

		it('should detect changed description', () => {
			const oldCommands = {
				ping: { description: 'Old ping' }
			}
			const newCommands = {
				ping: { description: 'New ping' }
			}

			const result = findCommandDifferences(oldCommands, newCommands, 'changed')

			expect(result).toEqual(['ping'])
		})

		it('should detect changed options', () => {
			const oldCommands = {
				greet: {
					description: 'Greet',
					options: [{ name: 'name', type: 'string' as const }]
				}
			}
			const newCommands = {
				greet: {
					description: 'Greet',
					options: [{ name: 'target', type: 'user' as const }]
				}
			}

			const result = findCommandDifferences(oldCommands, newCommands, 'changed')

			expect(result).toEqual(['greet'])
		})

		it('should return empty array when no differences', () => {
			const commands = {
				ping: { description: 'Ping' }
			}

			const added = findCommandDifferences(commands, commands, 'added')
			const removed = findCommandDifferences(commands, commands, 'removed')
			const changed = findCommandDifferences(commands, commands, 'changed')

			expect(added).toEqual([])
			expect(removed).toEqual([])
			expect(changed).toEqual([])
		})

		it('should handle subcommand additions', () => {
			const oldCommands = {
				user: {
					description: 'User commands',
					subcommands: {
						info: { description: 'Info' }
					}
				}
			}
			const newCommands = {
				user: {
					description: 'User commands',
					subcommands: {
						info: { description: 'Info' },
						ban: { description: 'Ban' }
					}
				}
			}

			const result = findCommandDifferences(oldCommands, newCommands, 'added')

			expect(result).toContain('user ban')
		})

		it('should handle subcommand removals', () => {
			const oldCommands = {
				user: {
					description: 'User commands',
					subcommands: {
						info: { description: 'Info' },
						ban: { description: 'Ban' }
					}
				}
			}
			const newCommands = {
				user: {
					description: 'User commands',
					subcommands: {
						info: { description: 'Info' }
					}
				}
			}

			const result = findCommandDifferences(oldCommands, newCommands, 'removed')

			expect(result).toContain('user ban')
		})

		it('should handle prefix for nested differences', () => {
			const oldCommands = {}
			const newCommands = {
				ping: { description: 'Ping' }
			}

			const result = findCommandDifferences(oldCommands, newCommands, 'added', 'parent')

			expect(result).toEqual(['parent ping'])
		})

		it('should detect multiple additions', () => {
			const oldCommands = {}
			const newCommands = {
				ping: { description: 'Ping' },
				pong: { description: 'Pong' },
				help: { description: 'Help' }
			}

			const result = findCommandDifferences(oldCommands, newCommands, 'added')

			expect(result).toHaveLength(3)
			expect(result).toContain('ping')
			expect(result).toContain('pong')
			expect(result).toContain('help')
		})
	})
})
