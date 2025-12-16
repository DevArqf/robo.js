/**
 * Ready Event Integration Test
 *
 * Tests the ready event handler by verifying the bot connects successfully
 * and sets activity on startup.
 *
 * This demonstrates two approaches for testing lifecycle hooks:
 * 1. Historical Actions - Query actions that fired during startup
 * 2. Direct Client Access - Check client state directly
 */
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { startMockBot, getHistoricalActions } from '@robojs/mock/testing'
import type { MockBotHandle } from '@robojs/mock/testing'
import type { Client } from 'discord.js'

const __filename = fileURLToPath(import.meta.url)

describe('ready event', () => {
	let bot: MockBotHandle

	beforeAll(async () => {
		// Start a bot connected to the mock server - it should set activity on ready
		bot = await startMockBot({
			name: 'ready-tests',
			testFilePath: __filename
		})
	}, 60000)

	afterAll(async () => {
		await bot.stop()
	})

	it('should connect successfully and have a valid client', async () => {
		// The bot should be connected after startMockBot() returns
		expect(bot.sessionId).toBeDefined()
		expect(bot.token).toBeDefined()
		expect(bot.botUser).toBeDefined()
		expect(bot.botUser.username).toBe('MockBot')

		// The client should be available
		expect(bot.client).toBeDefined()
	})

	it('should have guilds and channels available', async () => {
		// Bot should have access to mock guilds and channels
		expect(bot.guilds).toBeDefined()
		expect(bot.guilds.length).toBeGreaterThan(0)
		expect(bot.channels).toBeDefined()
		expect(bot.channels.length).toBeGreaterThan(0)
		expect(bot.guildId).toBeDefined()
	})

	// =========================================================================
	// Approach 1: Historical Actions
	// Query actions that fired during bot startup (before test code runs)
	// =========================================================================

	it('should have set activity on ready (via historical actions)', async () => {
		// Get all presence update actions from the session history
		// This includes actions that fired during startup
		const presenceActions = await getHistoricalActions(bot.sessionId, {
			type: 'gateway_presence_update'
		})

		// The ready handler should have triggered a presence update
		expect(presenceActions.length).toBeGreaterThan(0)

		// Check the activity data
		// Note: Custom Status (type 4) uses 'state' field for the status text, not 'name'
		const lastPresence = presenceActions[presenceActions.length - 1]
		const data = lastPresence.data as { activities?: Array<{ name?: string; state?: string }> }
		const activity = data.activities?.[0]
		expect(activity).toBeDefined()
		// The status text could be in 'state' (Custom Status) or 'name' (other types)
		const statusText = activity?.state ?? activity?.name
		expect(statusText).toContain('Built with Robo.js')
	})

	// =========================================================================
	// Approach 2: Direct Client Access
	// Check the Discord.js client state directly
	// =========================================================================

	it('should have set activity on ready (via client state)', async () => {
		// Skip if client is not available (e.g., import failed in test environment)
		if (!bot.client) {
			console.log('Skipping client state test - client not available')
			return
		}

		// Cast to Discord.js Client to access presence
		const client = bot.client as Client

		// The client should have user presence set
		expect(client.user).toBeDefined()

		// Check the activity was set by the ready handler
		const activities = client.user?.presence.activities ?? []
		expect(activities.length).toBeGreaterThan(0)

		// For Custom Status (type 4), check the 'state' field
		const customActivity = activities.find(
			(a) => a.state?.includes('Built with Robo.js') || a.name?.includes('Built with Robo.js')
		)
		expect(customActivity).toBeDefined()
	})
})
