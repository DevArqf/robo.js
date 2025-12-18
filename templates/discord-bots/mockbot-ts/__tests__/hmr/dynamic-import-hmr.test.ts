/**
 * Dynamic Import HMR Integration Tests
 *
 * Tests hot module replacement for modules loaded via dynamic imports.
 * Verifies that changes to dynamically imported modules trigger HMR.
 */
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals'
import { startMockRobo, dispatchInteraction, expectAction, clearSessionActions } from '@robojs/mock/testing'
import type { MockRoboHandle } from '@robojs/mock/testing'
import { TempFileManager } from '../utils/temp-file-manager.js'

const __filename = fileURLToPath(import.meta.url)

describe('Dynamic Import HMR', () => {
	let bot: MockRoboHandle
	let files: TempFileManager

	beforeAll(async () => {
		bot = await startMockRobo({
			name: 'dynamic-import-hmr',
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
			try {
				await bot.waitForHmrReload!(15000, hmrCountBefore)
			} catch {
				// HMR might not trigger if files didn't actually change
			}
		}
		await clearSessionActions(bot.sessionId)
	})

	it('should hot-reload handler when dynamically imported module changes', async () => {
		const channelId = bot.channels[0].id

		// Step 1: Verify the lazy command works with initial content
		await dispatchInteraction(bot.sessionId, {
			type: 2,
			data: { name: 'lazy', type: 1 },
			guild_id: bot.guildId,
			channel_id: channelId
		})
		await expectAction(bot.sessionId, {
			description: 'Lazy command returns initial message',
			type: 'interaction_response',
			expected: { response_data: { content: 'Lazy loaded!' } },
			timeout: 5000
		})

		// Step 2: Modify the dynamically imported module
		await clearSessionActions(bot.sessionId)
		const hmrCountBefore = bot.getHmrCount!()
		await files.modify('src/utils/lazy.ts', (content) =>
			content.replace("'Lazy loaded!'", "'Hot lazy module!'")
		)

		// Wait for HMR to detect the dynamic import dependency
		await bot.waitForHmrReload!(15000, hmrCountBefore)

		// Step 3: Verify the handler reflects the change
		await dispatchInteraction(bot.sessionId, {
			type: 2,
			data: { name: 'lazy', type: 1 },
			guild_id: bot.guildId,
			channel_id: channelId
		})
		await expectAction(bot.sessionId, {
			description: 'Lazy command reflects dynamic import change',
			type: 'interaction_response',
			expected: { response_data: { content: 'Hot lazy module!' } },
			timeout: 5000
		})
	}, 45000)

	it('should handle command with multiple dynamic imports', async () => {
		const channelId = bot.channels[0].id

		// Step 1: Create a utility module to be dynamically imported alongside lazy.ts
		const hmrCountStep1 = bot.getHmrCount!()
		await files.createTemp(
			'src/utils/lazy-extra.ts',
			`
export function getExtraMessage(): string {
	return ' [extra]'
}
`
		)
		await bot.waitForHmrReload!(15000, hmrCountStep1)

		// Step 2: Modify the lazy command to use both dynamic imports
		const hmrCountStep2 = bot.getHmrCount!()
		await files.modify('src/commands/lazy.ts', (content) =>
			content
				.replace(
					"const { getLazyMessage } = await import('../utils/lazy.js')",
					"const { getLazyMessage } = await import('../utils/lazy.js')\n\tconst { getExtraMessage } = await import('../utils/lazy-extra.js')"
				)
				.replace('interaction.reply(getLazyMessage())', 'interaction.reply(getLazyMessage() + getExtraMessage())')
		)
		await bot.waitForHmrReload!(15000, hmrCountStep2)

		// Verify the command works with both imports
		await clearSessionActions(bot.sessionId)
		await dispatchInteraction(bot.sessionId, {
			type: 2,
			data: { name: 'lazy', type: 1 },
			guild_id: bot.guildId,
			channel_id: channelId
		})
		await expectAction(bot.sessionId, {
			description: 'Lazy command uses both dynamic imports',
			type: 'interaction_response',
			expected: { response_data: { content: 'Lazy loaded! [extra]' } },
			timeout: 5000
		})

		// Step 3: Modify only the second dynamic import
		await clearSessionActions(bot.sessionId)
		const hmrCountStep3 = bot.getHmrCount!()
		await files.modify('src/utils/lazy-extra.ts', (content) =>
			content.replace("' [extra]'", "' [HOT EXTRA]'")
		)
		await bot.waitForHmrReload!(15000, hmrCountStep3)

		// Step 4: Verify the handler reflects the change
		await dispatchInteraction(bot.sessionId, {
			type: 2,
			data: { name: 'lazy', type: 1 },
			guild_id: bot.guildId,
			channel_id: channelId
		})
		await expectAction(bot.sessionId, {
			description: 'Lazy command reflects second dynamic import change',
			type: 'interaction_response',
			expected: { response_data: { content: 'Lazy loaded! [HOT EXTRA]' } },
			timeout: 5000
		})
	}, 90000)
})
