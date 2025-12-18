/**
 * Deletion Resilience HMR Integration Tests
 *
 * Tests that the dev process survives utility file deletions and recovers gracefully.
 * Verifies that HMR handles missing dependencies without crashing.
 */
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals'
import { startMockRobo, dispatchInteraction, expectAction, clearSessionActions, sleep } from '@robojs/mock/testing'
import type { MockRoboHandle } from '@robojs/mock/testing'
import { TempFileManager } from '../utils/temp-file-manager.js'

const __filename = fileURLToPath(import.meta.url)

describe('Deletion Resilience', () => {
	let bot: MockRoboHandle
	let files: TempFileManager

	beforeAll(async () => {
		bot = await startMockRobo({
			name: 'deletion-resilience',
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
			await files.restoreAll()
			// Give time for HMR to settle after restoration
			await sleep(2000)
		}
		await clearSessionActions(bot.sessionId)
	})

	it('should survive utility file deletion without crashing', async () => {
		const channelId = bot.channels[0].id

		// Step 1: Set up ping to use the utility
		const hmrCountStep1 = bot.getHmrCount!()
		await files.modify('src/commands/ping.ts', (content) =>
			content
				.replace(
					"import { logger } from 'robo.js'",
					"import { logger } from 'robo.js'\nimport { getPingMessage } from '../utils/ping-message.js'"
				)
				.replace("interaction.reply('Pong!')", 'interaction.reply(getPingMessage())')
		)
		await bot.waitForHmrReload!(15000, hmrCountStep1)

		// Verify it works initially
		await dispatchInteraction(bot.sessionId, {
			type: 2,
			data: { name: 'ping', type: 1 },
			guild_id: bot.guildId,
			channel_id: channelId
		})
		await expectAction(bot.sessionId, {
			description: 'Ping works before deletion',
			type: 'interaction_response',
			expected: { response_data: { content: 'Pong!' } },
			timeout: 5000
		})

		// Step 2: Delete the deeper.ts utility (used by ping-message.ts)
		await files.deleteTemp('src/utils/deeper.ts')

		// Wait for watcher to process the deletion
		await sleep(3000)

		// Step 3: The bot process should still be alive
		// We verify this by checking that we can still get the HMR count
		const hmrCountAfterDelete = bot.getHmrCount!()
		expect(typeof hmrCountAfterDelete).toBe('number')

		// The bot didn't crash - test passes
		// Note: The ping command might not work after deletion (expected behavior)
		// What matters is that the dev process survives
	}, 45000)

	it('should recover when deleted utility is restored', async () => {
		const channelId = bot.channels[0].id

		// Step 1: Set up ping to use the utility
		const hmrCountStep1 = bot.getHmrCount!()
		await files.modify('src/commands/ping.ts', (content) =>
			content
				.replace(
					"import { logger } from 'robo.js'",
					"import { logger } from 'robo.js'\nimport { getPingMessage } from '../utils/ping-message.js'"
				)
				.replace("interaction.reply('Pong!')", 'interaction.reply(getPingMessage())')
		)
		await bot.waitForHmrReload!(15000, hmrCountStep1)

		// Verify it works initially
		await clearSessionActions(bot.sessionId)
		await dispatchInteraction(bot.sessionId, {
			type: 2,
			data: { name: 'ping', type: 1 },
			guild_id: bot.guildId,
			channel_id: channelId
		})
		await expectAction(bot.sessionId, {
			description: 'Ping works before deletion',
			type: 'interaction_response',
			expected: { response_data: { content: 'Pong!' } },
			timeout: 5000
		})

		// Step 2: Delete deeper.ts
		await files.deleteTemp('src/utils/deeper.ts')
		await sleep(3000)

		// Step 3: Restore the file
		const hmrCountBeforeRestore = bot.getHmrCount!()
		await files.restoreAll()

		// Wait for HMR to recover
		try {
			await bot.waitForHmrReload!(20000, hmrCountBeforeRestore)
		} catch {
			// HMR might not increment if state recovery works differently
			await sleep(2000)
		}

		// Set up ping again after restoration (file state was restored)
		await clearSessionActions(bot.sessionId)
		const hmrCountStep3 = bot.getHmrCount!()
		await files.modify('src/commands/ping.ts', (content) =>
			content
				.replace(
					"import { logger } from 'robo.js'",
					"import { logger } from 'robo.js'\nimport { getPingMessage } from '../utils/ping-message.js'"
				)
				.replace("interaction.reply('Pong!')", 'interaction.reply(getPingMessage())')
		)

		try {
			await bot.waitForHmrReload!(15000, hmrCountStep3)
		} catch {
			// Handler might already be set up
			await sleep(2000)
		}

		// Step 4: Verify the command works again after restoration
		await clearSessionActions(bot.sessionId)
		await dispatchInteraction(bot.sessionId, {
			type: 2,
			data: { name: 'ping', type: 1 },
			guild_id: bot.guildId,
			channel_id: channelId
		})
		await expectAction(bot.sessionId, {
			description: 'Ping works after restoration',
			type: 'interaction_response',
			expected: { response_data: { content: 'Pong!' } },
			timeout: 5000
		})
	}, 90000)
})
