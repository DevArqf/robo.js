/**
 * Ping Command Integration Test
 *
 * Tests the /ping slash command that replies with "Pong!".
 */
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import {
	startMockRobo,
	dispatchInteraction,
	expectAction,
	getChannelMessages
} from '@robojs/mock/testing'
import type { MockRoboHandle } from '@robojs/mock/testing'

const __filename = fileURLToPath(import.meta.url)

describe('ping command', () => {
	let bot: MockRoboHandle

	beforeAll(async () => {
		// Start a bot connected to the mock server
		bot = await startMockRobo({
			name: 'ping-tests',
			testFilePath: __filename
		})
	}, 60000)

	afterAll(async () => {
		await bot.stop()
	})

	it('should respond with Pong!', async () => {
		const channelId = bot.channels[0].id

		// Trigger slash command interaction
		await dispatchInteraction(bot.sessionId, {
			type: 2, // APPLICATION_COMMAND
			data: {
				name: 'ping',
				type: 1 // CHAT_INPUT
			},
			guild_id: bot.guildId,
			channel_id: channelId
		})

		// Bot should respond with "Pong!"
		await expectAction(bot.sessionId, {
			description: 'Bot should reply with Pong!',
			type: 'interaction_response',
			expected: {
				response_data: {
					content: 'Pong!'
				}
			},
			timeout: 5000
		})
	})

	it('should have response message appear in channel', async () => {
		const channelId = bot.channels[0].id

		// Trigger slash command interaction
		await dispatchInteraction(bot.sessionId, {
			type: 2, // APPLICATION_COMMAND
			data: {
				name: 'ping',
				type: 1 // CHAT_INPUT
			},
			guild_id: bot.guildId,
			channel_id: channelId
		})

		// Wait for the interaction response
		await expectAction(bot.sessionId, {
			description: 'Bot should reply with Pong!',
			type: 'interaction_response',
			expected: {
				response_data: {
					content: 'Pong!'
				}
			},
			timeout: 5000
		})

		// Verify the message appears in the channel's message list
		const messages = await getChannelMessages(bot.sessionId, channelId)
		const pongMessage = messages.find((m) => m.content === 'Pong!' && m.author?.bot === true)
		expect(pongMessage).toBeDefined()
		expect(pongMessage?.content).toBe('Pong!')
	})
})
