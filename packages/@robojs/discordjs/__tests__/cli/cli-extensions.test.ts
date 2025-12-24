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

// Import invite command (at top-level to avoid timeout issues in beforeEach)
const { default: inviteCommand, config: inviteConfig } = await import('../../src/robo/cli/commands/invite.js')

// Import from 'robo.js' to use the mocked module
const roboMock = (await import('robo.js')) as unknown as {
	Env: {
		load: jest.Mock<() => Promise<void>>
		data: jest.Mock<() => Record<string, string | undefined>>
	}
	Mode: {
		get: jest.Mock<() => string>
	}
	Manifest: {
		metadata: jest.Mock<(namespace: string) => unknown>
	}
	color: {
		bold: (s: string) => string
		blue: (s: string) => string
		green: (s: string) => string
		underline: (s: string) => string
	}
	composeColors: (...fns: Array<(s: string) => string>) => (s: string) => string
}

const { Env, Mode, Manifest } = roboMock

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
		beforeEach(() => {
			// Reset mocks
			Mode.get.mockReturnValue('development')
			Env.load.mockResolvedValue(undefined)
			Env.data.mockReturnValue({ DISCORD_CLIENT_ID: '123456789012345678' })
			Manifest.metadata.mockReturnValue(null)
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
				Env.data.mockReturnValue({})

				const logger = createMockLogger()
				await inviteCommand({ logger } as Parameters<typeof inviteCommand>[0])

				expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('DISCORD_CLIENT_ID'))
			})

			it('should load environment before checking client ID', async () => {
				const logger = createMockLogger()
				await inviteCommand({ logger } as Parameters<typeof inviteCommand>[0])

				expect(Env.load).toHaveBeenCalled()
			})

			it('should get client ID from Env.data()', async () => {
				const logger = createMockLogger()
				await inviteCommand({ logger } as Parameters<typeof inviteCommand>[0])

				expect(Env.data).toHaveBeenCalled()
			})

			it('should get Discord metadata from manifest', async () => {
				const logger = createMockLogger()
				await inviteCommand({ logger } as Parameters<typeof inviteCommand>[0])

				expect(Manifest.metadata).toHaveBeenCalledWith('discordjs')
			})

			it('should generate invite link with default scopes', async () => {
				Env.data.mockReturnValue({ DISCORD_CLIENT_ID: '123456789012345678' })
				Manifest.metadata.mockReturnValue(null)

				const logger = createMockLogger()
				await inviteCommand({ logger } as Parameters<typeof inviteCommand>[0])

				// Check log output contains invite link with client_id and default scopes
				const logCalls = logger.log.mock.calls.flat().join('\n')
				expect(logCalls).toContain('123456789012345678')
				expect(logCalls).toContain('bot')
				expect(logCalls).toContain('applications.commands')
			})

			it('should use scopes from metadata when available', async () => {
				Env.data.mockReturnValue({ DISCORD_CLIENT_ID: '123456789012345678' })
				Manifest.metadata.mockReturnValue({
					namespace: 'discordjs',
					scopes: {
						required: ['bot', 'applications.commands', 'identify']
					}
				})

				const logger = createMockLogger()
				await inviteCommand({ logger } as Parameters<typeof inviteCommand>[0])

				const logCalls = logger.log.mock.calls.flat().join('\n')
				expect(logCalls).toContain('identify')
			})

			it('should warn when no permissions found', async () => {
				Env.data.mockReturnValue({ DISCORD_CLIENT_ID: '123456789012345678' })
				Manifest.metadata.mockReturnValue(null)

				const logger = createMockLogger()
				await inviteCommand({ logger } as Parameters<typeof inviteCommand>[0])

				expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('No permissions'))
			})

			it('should aggregate permissions from metadata', async () => {
				Env.data.mockReturnValue({ DISCORD_CLIENT_ID: '123456789012345678' })
				Manifest.metadata.mockReturnValue({
					namespace: 'discordjs',
					permissions: {
						bot: ['SendMessages', 'ReadMessageHistory']
					}
				})

				const logger = createMockLogger()
				await inviteCommand({ logger } as Parameters<typeof inviteCommand>[0])

				// Verify no warning about missing permissions
				const warnCalls = logger.warn.mock.calls.flat().join('\n')
				expect(warnCalls).not.toContain('No permissions found')
			})

			it('should output invite link in box format', async () => {
				Env.data.mockReturnValue({ DISCORD_CLIENT_ID: '123456789012345678' })
				Manifest.metadata.mockReturnValue(null)

				const logger = createMockLogger()
				await inviteCommand({ logger } as Parameters<typeof inviteCommand>[0])

				// Check for box characters in output
				const logCalls = logger.log.mock.calls.flat().join('\n')
				expect(logCalls).toContain('═')
				expect(logCalls).toContain('discord.com/oauth2/authorize')
			})
		})
	})
})
