/**
 * Tests for CLI extensions
 *
 * Verifies that:
 * - Dev extension adds --force flag
 * - Build extension adds --force flag
 * - Force flag sets DISCORD_FORCE_REGISTER env variable
 * - Invite command generates correct OAuth2 URL
 * - Invite command handles missing CLIENT_ID
 * - Permissions are correctly aggregated from metadata
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

// Helper for typed mocks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fn = jest.fn as any

// Import dev and build extensions
const { config: devConfig, before: devBefore } = await import('../../src/robo/cli/extend/dev.js')
const { config: buildConfig, before: buildBefore } = await import('../../src/robo/cli/extend/build.js')

// Import from 'robo.js' to use the mocked module
const roboMock = (await import('robo.js')) as unknown as {
	Env: {
		load: jest.Mock
	}
	env: {
		get: jest.Mock
	}
	Mode: {
		get: jest.Mock
	}
	Manifest: {
		metadata: jest.Mock
	}
	color: {
		bold: (s: string) => string
		blue: (s: string) => string
		green: (s: string) => string
		underline: (s: string) => string
	}
	composeColors: (...fns: Array<(s: string) => string>) => (s: string) => string
}

const { Env, env, Mode, Manifest } = roboMock

// Create mock logger for tests
function createMockLogger() {
	return {
		debug: fn(),
		info: fn(),
		warn: fn(),
		error: fn(),
		log: fn()
	}
}

describe('CLI Extensions', () => {
	let originalEnv: string | undefined

	beforeEach(() => {
		jest.clearAllMocks()
		originalEnv = process.env.DISCORD_FORCE_REGISTER
		delete process.env.DISCORD_FORCE_REGISTER
	})

	afterEach(() => {
		if (originalEnv !== undefined) {
			process.env.DISCORD_FORCE_REGISTER = originalEnv
		} else {
			delete process.env.DISCORD_FORCE_REGISTER
		}
	})

	describe('dev extension', () => {
		describe('config', () => {
			it('should define --force option', () => {
				expect(devConfig.options).toBeDefined()
				expect(devConfig.options).toHaveLength(1)

				const forceOption = devConfig.options?.[0]
				expect(forceOption).toMatchObject({
					alias: '-f',
					name: '--force',
					type: 'boolean'
				})
			})

			it('should have description for --force option', () => {
				const forceOption = devConfig.options?.[0]
				expect(forceOption?.description).toContain('Force')
			})
		})

		describe('before hook', () => {
			it('should set DISCORD_FORCE_REGISTER when --force is true', async () => {
				const ctx = {
					options: { force: true },
					logger: createMockLogger()
				}

				await devBefore(ctx as any)

				expect(process.env.DISCORD_FORCE_REGISTER).toBe('true')
				expect(ctx.logger.debug).toHaveBeenCalledWith(expect.stringContaining('Force registration'))
			})

			it('should not set DISCORD_FORCE_REGISTER when --force is false', async () => {
				const ctx = {
					options: { force: false },
					logger: createMockLogger()
				}

				await devBefore(ctx as any)

				expect(process.env.DISCORD_FORCE_REGISTER).toBeUndefined()
				expect(ctx.logger.debug).not.toHaveBeenCalled()
			})

			it('should not set DISCORD_FORCE_REGISTER when --force is undefined', async () => {
				const ctx = {
					options: {},
					logger: createMockLogger()
				}

				await devBefore(ctx as any)

				expect(process.env.DISCORD_FORCE_REGISTER).toBeUndefined()
			})
		})
	})

	describe('build extension', () => {
		describe('config', () => {
			it('should define --force option', () => {
				expect(buildConfig.options).toBeDefined()
				expect(buildConfig.options).toHaveLength(1)

				const forceOption = buildConfig.options?.[0]
				expect(forceOption).toMatchObject({
					alias: '-f',
					name: '--force',
					type: 'boolean'
				})
			})

			it('should have description for --force option', () => {
				const forceOption = buildConfig.options?.[0]
				expect(forceOption?.description).toContain('Force')
			})
		})

		describe('before hook', () => {
			it('should set DISCORD_FORCE_REGISTER when --force is true', async () => {
				const ctx = {
					options: { force: true },
					logger: createMockLogger()
				}

				await buildBefore(ctx as any)

				expect(process.env.DISCORD_FORCE_REGISTER).toBe('true')
				expect(ctx.logger.debug).toHaveBeenCalledWith(expect.stringContaining('Force registration'))
			})

			it('should not set DISCORD_FORCE_REGISTER when --force is false', async () => {
				const ctx = {
					options: { force: false },
					logger: createMockLogger()
				}

				await buildBefore(ctx as any)

				expect(process.env.DISCORD_FORCE_REGISTER).toBeUndefined()
			})

			it('should not set DISCORD_FORCE_REGISTER when --force is undefined', async () => {
				const ctx = {
					options: {},
					logger: createMockLogger()
				}

				await buildBefore(ctx as any)

				expect(process.env.DISCORD_FORCE_REGISTER).toBeUndefined()
			})
		})
	})

	describe('invite command', () => {
		let inviteCommand: (ctx: { logger: ReturnType<typeof createMockLogger> }) => Promise<void>
		let inviteConfig: { description: string; options?: Array<{ name: string }> }

		beforeEach(async () => {
			// Reset mocks
			Mode.get.mockReturnValue('development')
			Env.load.mockResolvedValue(undefined)
			env.get.mockReturnValue('123456789012345678')
			Manifest.metadata.mockReturnValue(null)

			// Re-import to get fresh module
			const inviteModule = await import('../../src/robo/cli/commands/invite.js')
			inviteCommand = inviteModule.default
			inviteConfig = inviteModule.config
		})

		describe('config', () => {
			it('should have description', () => {
				expect(inviteConfig.description).toBeDefined()
				expect(inviteConfig.description).toContain('invite')
			})

			it('should define --help option', () => {
				expect(inviteConfig.options).toBeDefined()
				const helpOption = inviteConfig.options?.find((opt) => opt.name === '--help')
				expect(helpOption).toBeDefined()
			})
		})

		describe('command execution', () => {
			it('should error when DISCORD_CLIENT_ID is missing', async () => {
				env.get.mockReturnValue(undefined)

				const logger = createMockLogger()
				await inviteCommand({ logger })

				expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('DISCORD_CLIENT_ID'))
			})

			it('should load environment before checking client ID', async () => {
				const logger = createMockLogger()
				await inviteCommand({ logger })

				expect(Env.load).toHaveBeenCalled()
			})

			it('should get client ID from env', async () => {
				const logger = createMockLogger()
				await inviteCommand({ logger })

				expect(env.get).toHaveBeenCalledWith('discord.clientId')
			})

			it('should get Discord metadata from manifest', async () => {
				const logger = createMockLogger()
				await inviteCommand({ logger })

				expect(Manifest.metadata).toHaveBeenCalledWith('discordjs')
			})

			it('should generate invite link with default scopes', async () => {
				env.get.mockReturnValue('123456789012345678')
				Manifest.metadata.mockReturnValue(null)

				const logger = createMockLogger()
				await inviteCommand({ logger })

				// Check log output contains invite link with client_id and default scopes
				const logCalls = logger.log.mock.calls.flat().join('\n')
				expect(logCalls).toContain('123456789012345678')
				expect(logCalls).toContain('bot')
				expect(logCalls).toContain('applications.commands')
			})

			it('should use scopes from metadata when available', async () => {
				env.get.mockReturnValue('123456789012345678')
				Manifest.metadata.mockReturnValue({
					namespace: 'discordjs',
					scopes: {
						required: ['bot', 'applications.commands', 'identify']
					}
				})

				const logger = createMockLogger()
				await inviteCommand({ logger })

				const logCalls = logger.log.mock.calls.flat().join('\n')
				expect(logCalls).toContain('identify')
			})

			it('should warn when no permissions found', async () => {
				env.get.mockReturnValue('123456789012345678')
				Manifest.metadata.mockReturnValue(null)

				const logger = createMockLogger()
				await inviteCommand({ logger })

				expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('No permissions'))
			})

			it('should aggregate permissions from metadata', async () => {
				env.get.mockReturnValue('123456789012345678')
				Manifest.metadata.mockReturnValue({
					namespace: 'discordjs',
					permissions: {
						bot: ['SendMessages', 'ReadMessageHistory']
					}
				})

				const logger = createMockLogger()
				await inviteCommand({ logger })

				// Verify no warning about missing permissions
				const warnCalls = logger.warn.mock.calls.flat().join('\n')
				expect(warnCalls).not.toContain('No permissions found')
			})

			it('should output invite link in box format', async () => {
				env.get.mockReturnValue('123456789012345678')
				Manifest.metadata.mockReturnValue(null)

				const logger = createMockLogger()
				await inviteCommand({ logger })

				// Check for box characters in output
				const logCalls = logger.log.mock.calls.flat().join('\n')
				expect(logCalls).toContain('═')
				expect(logCalls).toContain('discord.com/oauth2/authorize')
			})
		})
	})
})
