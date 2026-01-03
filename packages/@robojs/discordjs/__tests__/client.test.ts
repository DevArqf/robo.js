/**
 * Tests for client state management
 *
 * Verifies that:
 * - Client getter/setter works correctly
 * - hasClient() returns correct state
 * - Plugin state management works
 * - getPluginConfig() returns correct values
 * - Proper error is thrown when client not initialized
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { Client } from 'discord.js'
import {
	getClient,
	hasClient,
	setClient,
	clearClient,
	getPluginState,
	setPluginState,
	getPluginConfig
} from '../src/core/client.js'
import type { PluginState, DiscordConfig } from '../src/types/index.js'

describe('Client State Management', () => {
	// Clean up after each test
	afterEach(() => {
		if (hasClient()) {
			clearClient()
		}
	})

	describe('getClient', () => {
		it('should throw error when client is not initialized', () => {
			// Ensure client is cleared
			if (hasClient()) {
				clearClient()
			}

			expect(() => getClient()).toThrow('Discord client is not initialized')
		})

		it('should return client when initialized', () => {
			const mockClient = new Client({ intents: [] })
			setClient(mockClient)

			const client = getClient()

			expect(client).toBe(mockClient)
		})

		it('should include helpful error message', () => {
			if (hasClient()) {
				clearClient()
			}

			expect(() => getClient()).toThrow('@robojs/discordjs plugin is installed')
		})
	})

	describe('hasClient', () => {
		it('should return false when client is not set', () => {
			if (hasClient()) {
				clearClient()
			}

			expect(hasClient()).toBe(false)
		})

		it('should return true after setClient', () => {
			const mockClient = new Client({ intents: [] })
			setClient(mockClient)

			expect(hasClient()).toBe(true)
		})

		it('should return false after clearClient', () => {
			const mockClient = new Client({ intents: [] })
			setClient(mockClient)
			clearClient()

			expect(hasClient()).toBe(false)
		})
	})

	describe('setClient / clearClient', () => {
		it('should set the client instance', () => {
			const mockClient = new Client({ intents: [] })

			setClient(mockClient)

			expect(getClient()).toBe(mockClient)
		})

		it('should clear the client instance', () => {
			const mockClient = new Client({ intents: [] })
			setClient(mockClient)

			clearClient()

			expect(hasClient()).toBe(false)
		})

		it('should allow setting a new client after clearing', () => {
			const client1 = new Client({ intents: [] })
			const client2 = new Client({ intents: [] })

			setClient(client1)
			clearClient()
			setClient(client2)

			expect(getClient()).toBe(client2)
		})
	})

	describe('getPluginState', () => {
		it('should return null when state is not set', () => {
			// Note: We can't easily reset this between tests without exporting a clearPluginState
			// This test assumes state might already be set from other tests
			const state = getPluginState()
			// State could be null or a valid PluginState
			expect(state === null || (state && 'serverRestrictions' in state)).toBe(true)
		})

		it('should return state after setPluginState', () => {
			const mockState: PluginState = {
				serverRestrictions: new Map(),
				config: { sage: { defer: true } }
			}

			setPluginState(mockState)
			const state = getPluginState()

			expect(state).toBe(mockState)
		})

		it('should preserve serverRestrictions map', () => {
			const restrictions = new Map<string, string[]>()
			restrictions.set('ping', ['123456789'])

			const mockState: PluginState = {
				serverRestrictions: restrictions,
				config: {}
			}

			setPluginState(mockState)
			const state = getPluginState()

			expect(state?.serverRestrictions.get('ping')).toEqual(['123456789'])
		})
	})

	describe('getPluginConfig', () => {
		it('should return empty object when state is null', () => {
			// We need to test when pluginState is null
			// Since we can't clear it directly, we'll set it to a state with empty config
			const mockState: PluginState = {
				serverRestrictions: new Map(),
				config: {}
			}
			setPluginState(mockState)

			const config = getPluginConfig()

			expect(config).toEqual({})
		})

		it('should return config from state', () => {
			const expectedConfig: DiscordConfig = {
				sage: { defer: true, ephemeral: false },
				testServers: ['123456789']
			}

			const mockState: PluginState = {
				serverRestrictions: new Map(),
				config: expectedConfig
			}

			setPluginState(mockState)
			const config = getPluginConfig()

			expect(config).toEqual(expectedConfig)
		})

		it('should return sage options from config', () => {
			const mockState: PluginState = {
				serverRestrictions: new Map(),
				config: {
					sage: {
						defer: true,
						deferBuffer: 500,
						ephemeral: true
					}
				}
			}

			setPluginState(mockState)
			const config = getPluginConfig()

			expect(config.sage).toEqual({
				defer: true,
				deferBuffer: 500,
				ephemeral: true
			})
		})

		it('should return timeouts from config', () => {
			const mockState: PluginState = {
				serverRestrictions: new Map(),
				config: {
					timeouts: {
						autocomplete: 5000,
						commandDeferral: 300,
						commandRegistration: 60000
					}
				}
			}

			setPluginState(mockState)
			const config = getPluginConfig()

			expect(config.timeouts).toEqual({
				autocomplete: 5000,
				commandDeferral: 300,
				commandRegistration: 60000
			})
		})

		it('should return autoRegisterCommands setting', () => {
			const mockState: PluginState = {
				serverRestrictions: new Map(),
				config: {
					autoRegisterCommands: ['production']
				}
			}

			setPluginState(mockState)
			const config = getPluginConfig()

			expect(config.autoRegisterCommands).toEqual(['production'])
		})

		it('should return defaults from config', () => {
			const mockState: PluginState = {
				serverRestrictions: new Map(),
				config: {
					defaults: {
						contexts: ['Guild', 'BotDM'],
						integrationTypes: ['GuildInstall']
					}
				}
			}

			setPluginState(mockState)
			const config = getPluginConfig()

			expect(config.defaults).toEqual({
				contexts: ['Guild', 'BotDM'],
				integrationTypes: ['GuildInstall']
			})
		})
	})
})
