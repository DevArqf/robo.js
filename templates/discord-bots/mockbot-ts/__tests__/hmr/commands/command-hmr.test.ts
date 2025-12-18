/**
 * Command HMR Integration Tests
 *
 * Tests hot module replacement for slash commands.
 * Verifies that changes to command handlers are picked up without full restart.
 */
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals'
import { startMockRobo, dispatchInteraction, expectAction, clearSessionActions } from '@robojs/mock/testing'
import type { MockRoboHandle } from '@robojs/mock/testing'
import { TempFileManager } from '../../utils/temp-file-manager.js'

const __filename = fileURLToPath(import.meta.url)

describe('Command HMR', () => {
	let bot: MockRoboHandle
	let files: TempFileManager

	beforeAll(async () => {
		// Start with HMR mode enabled
		bot = await startMockRobo({
			name: 'cmd-hmr',
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
		// Check if there are changes to restore
		if (files.hasPendingChanges()) {
			const hmrCountBefore = bot.getHmrCount!()
			await files.restoreAll()
			// Wait for HMR to settle after file restoration
			try {
				await bot.waitForHmrReload!(10000, hmrCountBefore)
			} catch {
				// HMR might not trigger if files didn't actually change, that's okay
			}
		}
		// Clear actions between tests
		await clearSessionActions(bot.sessionId)
	})

	it('should hot-reload modified command response', async () => {
		const channelId = bot.channels[0].id

		// 1. Verify original response
		await dispatchInteraction(bot.sessionId, {
			type: 2, // APPLICATION_COMMAND
			data: { name: 'ping', type: 1 }, // CHAT_INPUT
			guild_id: bot.guildId,
			channel_id: channelId
		})
		await expectAction(bot.sessionId, {
			description: 'Original ping responds with Pong!',
			type: 'interaction_response',
			expected: { response_data: { content: 'Pong!' } },
			timeout: 5000
		})

		// Clear actions before modifying
		await clearSessionActions(bot.sessionId)

		// 2. Capture HMR count BEFORE modifying file
		const hmrCountBefore = bot.getHmrCount!()

		// 3. Modify command file to return different response
		await files.modify('src/commands/ping.ts', (content) =>
			content.replace("interaction.reply('Pong!')", "interaction.reply('Hot Pong!')")
		)

		// 4. Wait for HMR to complete, using count captured before modification
		await bot.waitForHmrReload!(10000, hmrCountBefore)

		// 4. Verify new response
		await dispatchInteraction(bot.sessionId, {
			type: 2,
			data: { name: 'ping', type: 1 },
			guild_id: bot.guildId,
			channel_id: channelId
		})
		await expectAction(bot.sessionId, {
			description: 'Modified ping responds with Hot Pong!',
			type: 'interaction_response',
			expected: { response_data: { content: 'Hot Pong!' } },
			timeout: 5000
		})
	}, 30000)

	it('should handle syntax errors gracefully', async () => {
		// This test verifies that the dev process survives a syntax error
		// The key behavior: bot doesn't crash when a file has syntax errors

		// Introduce a syntax error
		await files.modify('src/commands/ping.ts', (content) => content + '\n invalid syntax {')

		// Wait for the watcher to process (compilation will fail)
		await new Promise((resolve) => setTimeout(resolve, 2000))

		// The bot process should still be running (not crashed)
		// Verify by checking we can still communicate with it
		const hmrCountAfterError = bot.getHmrCount!()

		// Restore the file - this triggers HMR with valid code
		await files.restoreAll()

		// Wait for HMR after restore
		try {
			await bot.waitForHmrReload!(15000, hmrCountAfterError)
		} catch {
			// HMR detection might fail, but we just need the bot to survive
		}

		// Give time for handler to reload
		await new Promise((resolve) => setTimeout(resolve, 1000))

		// If we get here without timing out or crashing, the test passes
		// The dev mode handled the syntax error gracefully
	}, 30000)

	it('should hot-reload newly added command', async () => {
		const channelId = bot.channels[0].id

		// Capture HMR count before creating file
		const hmrCountBefore = bot.getHmrCount!()

		// Create a new command file
		await files.createTemp(
			'src/commands/hmr-new.ts',
			`
import { createCommandConfig } from '@robojs/discordjs'
import type { ChatInputCommandInteraction } from 'discord.js'

export const config = createCommandConfig({
	description: 'New HMR test command'
} as const)

export default (interaction: ChatInputCommandInteraction) => {
	interaction.reply('New Command Works!')
}
`
		)

		// Wait for HMR to pick up the new file
		await bot.waitForHmrReload!(10000, hmrCountBefore)

		// Dispatch interaction for the new command
		await dispatchInteraction(bot.sessionId, {
			type: 2,
			data: { name: 'hmr-new', type: 1 },
			guild_id: bot.guildId,
			channel_id: channelId
		})

		await expectAction(bot.sessionId, {
			description: 'New command responds',
			type: 'interaction_response',
			expected: { response_data: { content: 'New Command Works!' } },
			timeout: 5000
		})
	}, 30000)

	it('should handle multiple rapid changes', async () => {
		// This test verifies that HMR can handle rapid successive file changes
		// without crashing or getting into a bad state

		// Capture HMR count before rapid changes
		const hmrCountBefore = bot.getHmrCount!()

		// Make multiple rapid changes
		await files.modify('src/commands/ping.ts', (content) =>
			content.replace("interaction.reply('Pong!')", "interaction.reply('Change 1')")
		)

		// Wait briefly then make another change
		await new Promise((resolve) => setTimeout(resolve, 300))

		await files.modify('src/commands/ping.ts', (content) =>
			content.replace("interaction.reply('Change 1')", "interaction.reply('Change 2')")
		)

		// Wait for HMR to settle (may trigger one or multiple reloads)
		await bot.waitForHmrReload!(15000, hmrCountBefore)

		// If we get here, HMR handled the rapid changes without crashing
		// The bot process survived multiple quick file modifications
	}, 30000)
})
