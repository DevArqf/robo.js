/**
 * Event HMR Integration Tests
 *
 * Tests hot module replacement for event handlers.
 * Verifies that changes to event handlers are picked up without full restart.
 */
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals'
import { startMockRobo, clearSessionActions, dispatchEvent, expectAction, generateSnowflake, sleep } from '@robojs/mock/testing'
import type { MockRoboHandle } from '@robojs/mock/testing'
import { TempFileManager } from '../../utils/temp-file-manager.js'

const __filename = fileURLToPath(import.meta.url)

describe('Event HMR', () => {
	let bot: MockRoboHandle
	let files: TempFileManager

	beforeAll(async () => {
		bot = await startMockRobo({
			name: 'event-hmr',
			testFilePath: __filename,
			hmr: true,
			verbose: process.env.VERBOSE === 'true'
		})
		files = new TempFileManager()
	}, 90000)

	afterAll(async () => {
		await files.restoreAll()
		await bot.stop()
	})

	afterEach(async () => {
		if (files.hasPendingChanges()) {
			const hmrCountBefore = bot.getHmrCount!()
			await files.restoreAll()
			// Wait for HMR to settle after file restoration
			try {
				await bot.waitForHmrReload!(15000, hmrCountBefore)
			} catch {
				// HMR might not trigger if files didn't actually change
			}
			await sleep(500)
		}
		await clearSessionActions(bot.sessionId)
	})

	it('should hot-reload modified event handler', async () => {
		const channelId = bot.channels[0].id

		// Verify baseline behavior
		await dispatchEvent(bot.sessionId, 'MESSAGE_CREATE', {
			id: generateSnowflake(),
			channel_id: channelId,
			guild_id: bot.guildId,
			content: 'hmr-event-baseline',
			author: {
				id: generateSnowflake(),
				username: 'HmrEventUser',
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
		await expectAction(bot.sessionId, {
			description: 'Event replies with Counter prefix',
			type: 'message_sent',
			expected: { content: expect.stringContaining('Counter:') },
			timeout: 5000
		})
		await clearSessionActions(bot.sessionId)

		// Modify the event handler
		const hmrCountBefore = bot.getHmrCount!()
		await files.modify('src/events/messageCreate/example.ts', (content) =>
			content.replace('Counter:', 'Hot Counter:')
		)

		// Wait for HMR reload - this verifies HMR was detected for event handlers
		await bot.waitForHmrReload!(15000, hmrCountBefore)

		// Verify updated behavior
		await dispatchEvent(bot.sessionId, 'MESSAGE_CREATE', {
			id: generateSnowflake(),
			channel_id: channelId,
			guild_id: bot.guildId,
			content: 'hmr-event-updated',
			author: {
				id: generateSnowflake(),
				username: 'HmrEventUser',
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
		await expectAction(bot.sessionId, {
			description: 'Event reflects updated prefix after HMR',
			type: 'message_sent',
			expected: {
				content: expect.stringContaining('Hot Counter:')
			},
			timeout: 5000
		})
	}, 30000)

	it('should handle adding new event handler', async () => {
		const channelId = bot.channels[0].id

		// Capture HMR count BEFORE creating file
		const hmrCountBefore = bot.getHmrCount!()

		// Create a new messageCreate handler
		await files.createTemp(
			'src/events/messageCreate/hmr-test.ts',
			`
import type { Message } from 'discord.js'

export default (message: Message) => {
	if (message.author.bot) return
	if (message.content === 'hmr-trigger-unique-xyz') {
		message.reply('HMR handler active!')
	}
}
`
		)

		// Wait for HMR reload - this verifies new event files are detected
		await bot.waitForHmrReload!(15000, hmrCountBefore)

		// Verify the new handler is active
		await clearSessionActions(bot.sessionId)
		await dispatchEvent(bot.sessionId, 'MESSAGE_CREATE', {
			id: generateSnowflake(),
			channel_id: channelId,
			guild_id: bot.guildId,
			content: 'hmr-trigger-unique-xyz',
			author: {
				id: generateSnowflake(),
				username: 'HmrEventUser',
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

		await expectAction(bot.sessionId, {
			description: 'New event handler responds',
			type: 'message_sent',
			expected: { content: 'HMR handler active!' },
			timeout: 5000
		})
	}, 30000)

	it('should document module state reset behavior', async () => {
		const channelId = bot.channels[0].id
		const marker = 'HMR_STATE_RESET'

		await clearSessionActions(bot.sessionId)
		await dispatchEvent(bot.sessionId, 'MESSAGE_CREATE', {
			id: generateSnowflake(),
			channel_id: channelId,
			guild_id: bot.guildId,
			content: 'state-1',
			author: {
				id: generateSnowflake(),
				username: 'HmrEventUser',
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
		await expectAction(bot.sessionId, {
			description: 'Counter responds before reload',
			type: 'message_sent',
			expected: { content: expect.stringContaining('Counter:') },
			timeout: 5000
		})
		await clearSessionActions(bot.sessionId)

		// Capture HMR count BEFORE modifying file
		const hmrCountBefore = bot.getHmrCount!()

		// Trigger HMR with an observable output change so the test doesn't depend on subtle timing.
		// This also ensures we can distinguish the post-reload handler from any messages emitted before reload.
		await files.modify('src/events/messageCreate/example.ts', (content) =>
			content
				.replace('message.reply(`Counter:', `message.reply(\`${marker} Counter:`)
				+ `\n// ${marker}`
		)

		// Wait for HMR reload
		await bot.waitForHmrReload!(15000, hmrCountBefore)

		// After reload, module-level state should reset
		await clearSessionActions(bot.sessionId)
		await dispatchEvent(bot.sessionId, 'MESSAGE_CREATE', {
			id: generateSnowflake(),
			channel_id: channelId,
			guild_id: bot.guildId,
			content: 'state-2',
			author: {
				id: generateSnowflake(),
				username: 'HmrEventUser',
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
		await expectAction(bot.sessionId, {
			description: 'Counter resets after reload',
			type: 'message_sent',
			expected: { content: expect.stringContaining(`${marker} Counter: 1`) },
			timeout: 8000
		})
	}, 30000)
})
