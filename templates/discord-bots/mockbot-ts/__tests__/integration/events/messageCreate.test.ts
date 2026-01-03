/**
 * Message Create Event Integration Test
 *
 * Tests the messageCreate event handler that echoes messages.
 */
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import {
	startMockRobo,
	clearSessionActions,
	dispatchEvent,
	expectAction,
	generateSnowflake
} from '@robojs/mock/testing'
import type { MockRoboHandle } from '@robojs/mock/testing'

const __filename = fileURLToPath(import.meta.url)

describe('messageCreate event', () => {
	let bot: MockRoboHandle

	beforeAll(async () => {
		// Start a bot connected to the mock server
		bot = await startMockRobo({
			name: 'messageCreate-tests',
			testFilePath: __filename
		})
	}, 60000)

	afterAll(async () => {
		await bot.stop()
	})

	beforeEach(async () => {
		await clearSessionActions(bot.sessionId)
	})

	it('should echo received messages', async () => {
		const channelId = bot.channels[0].id
		const messageId = generateSnowflake()
		const userId = generateSnowflake()

		// Dispatch a MESSAGE_CREATE event
		await dispatchEvent(bot.sessionId, 'MESSAGE_CREATE', {
			id: messageId,
			channel_id: channelId,
			guild_id: bot.guildId,
			content: 'Hello, bot!',
			author: {
				id: userId,
				username: 'TestUser',
				discriminator: '0000',
				avatar: null,
				bot: false
			},
			timestamp: new Date().toISOString(),
			edited_timestamp: null,
			tts: false,
			mention_everyone: false,
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: []
		})

		// Wait for bot to respond with echo
		await expectAction(bot.sessionId, {
			description: 'Bot should reply with echo message containing original content',
			type: 'message_sent',
			expected: {
				content: expect.stringContaining('Hello, bot!')
			},
			timeout: 5000
		})
	})

	it('should include message count in reply', async () => {
		const channelId = bot.channels[0].id
		const messageId = generateSnowflake()
		const userId = generateSnowflake()

		// Send another message
		await dispatchEvent(bot.sessionId, 'MESSAGE_CREATE', {
			id: messageId,
			channel_id: channelId,
			guild_id: bot.guildId,
			content: 'Another message',
			author: {
				id: userId,
				username: 'TestUser',
				discriminator: '0000',
				avatar: null,
				bot: false
			},
			timestamp: new Date().toISOString(),
			edited_timestamp: null,
			tts: false,
			mention_everyone: false,
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: []
		})

		// Bot should include count in reply
			await expectAction(bot.sessionId, {
				description: 'Bot should include count in reply',
				type: 'message_sent',
				expected: {
				content: expect.stringMatching(/Counter:\s*\d+\s*\|\s*Another message/)
				},
				timeout: 5000
			})
		})
})
