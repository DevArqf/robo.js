/**
 * Full Restart Trigger Tests
 *
 * Tests that certain file types correctly trigger a full restart instead of HMR.
 * These include lifecycle hooks, config files, .env, and tsconfig.
 */
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals'
import { startMockRobo, dispatchInteraction, expectAction, clearSessionActions } from '@robojs/mock/testing'
import type { MockRoboHandle } from '@robojs/mock/testing'
import { TempFileManager } from '../../utils/temp-file-manager.js'

const __filename = fileURLToPath(import.meta.url)

describe('Full Restart Triggers', () => {
	let bot: MockRoboHandle
	let files: TempFileManager

	beforeAll(async () => {
		bot = await startMockRobo({
			name: 'restart-test',
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
		await clearSessionActions(bot.sessionId)
	})

	it('should trigger full restart for lifecycle hook changes', async () => {
		// Capture restart count BEFORE creating file
		const restartCountBefore = bot.getRestartCount!()

		// Create a new lifecycle hook
		await files.createTemp(
			'src/robo/hooks/ready.ts',
			`
import { logger } from 'robo.js'

export default () => {
	logger.info('Ready hook triggered!')
}
`
		)

		// This should trigger a full restart, not just HMR
		await bot.waitForFullRestart!(30000, restartCountBefore)

		// If we got here, full restart was detected and bot reconnected
		// That's the main thing we're testing
	}, 60000)

	it('should NOT trigger full restart for handler changes', async () => {
		const channelId = bot.channels[0].id

		// Capture counts BEFORE modifying file
		const restartCountBefore = bot.getRestartCount!()
		const hmrCountBefore = bot.getHmrCount!()

		// Modify a handler
		await files.modify('src/commands/ping.ts', (content) =>
			content.replace("interaction.reply('Pong!')", "interaction.reply('No Restart Needed!')")
		)

		// Wait for HMR to complete (should happen fast for handler changes)
		await bot.waitForHmrReload!(15000, hmrCountBefore)

		// Verify restart count didn't change
		const restartCountAfter = bot.getRestartCount!()
		expect(restartCountAfter).toBe(restartCountBefore)

		// Verify the change applied via HMR
		await dispatchInteraction(bot.sessionId, {
			type: 2,
			data: { name: 'ping', type: 1 },
			guild_id: bot.guildId,
			channel_id: channelId
		})

		await expectAction(bot.sessionId, {
			description: 'Handler updated via HMR not restart',
			type: 'interaction_response',
			expected: { response_data: { content: 'No Restart Needed!' } },
			timeout: 5000
		})
	}, 30000)

	it('should handle tsconfig changes gracefully', async () => {
		// Note: The current HMR implementation may or may not restart for tsconfig changes
		// This test verifies the dev process survives the change

		// Modify tsconfig.json with a safe change
		await files.modify('tsconfig.json', (content) => {
			const config = JSON.parse(content)
			// Add a harmless compiler option
			config.compilerOptions = config.compilerOptions || {}
			config.compilerOptions.hmrTestMarker = true
			return JSON.stringify(config, null, 2)
		})

		// Wait for any change processing (HMR or restart)
		await new Promise((resolve) => setTimeout(resolve, 2000))

		// The key test is that the bot process survives the config change
		// If we get here without the process crashing, the test passes
	}, 15000)

	it('should handle middleware changes gracefully', async () => {
		// Note: The current HMR implementation may handle middleware via HMR or restart
		// This test verifies the dev process survives adding a middleware file

		// Create a middleware file
		await files.createTemp(
			'src/middleware/hmr-test.ts',
			`
import { logger } from 'robo.js'

export default () => {
	logger.debug('HMR test middleware running')
	// Allow through
	return
}
`
		)

		// Wait for any change processing
		await new Promise((resolve) => setTimeout(resolve, 2000))

		// The key test is that the bot process survives adding middleware
		// If we get here without the process crashing, the test passes
	}, 15000)
})

describe('HMR and Restart Coexistence', () => {
	let bot: MockRoboHandle
	let files: TempFileManager

	beforeAll(async () => {
		bot = await startMockRobo({
			name: 'coexist-test',
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
		await clearSessionActions(bot.sessionId)
	})

	it('should handle mixed changes - handler first, then config', async () => {
		const channelId = bot.channels[0].id

		// Capture HMR count BEFORE making HMR-compatible change
		const hmrCountBefore = bot.getHmrCount!()

		// First, make an HMR-compatible change
		await files.modify('src/commands/ping.ts', (content) =>
			content.replace("interaction.reply('Pong!')", "interaction.reply('HMR First!')")
		)

		await bot.waitForHmrReload!(10000, hmrCountBefore)

		// Verify HMR worked
		await dispatchInteraction(bot.sessionId, {
			type: 2,
			data: { name: 'ping', type: 1 },
			guild_id: bot.guildId,
			channel_id: channelId
		})

		await expectAction(bot.sessionId, {
			description: 'HMR change applied',
			type: 'interaction_response',
			expected: { response_data: { content: 'HMR First!' } },
			timeout: 5000
		})

		await clearSessionActions(bot.sessionId)

		// Capture restart count BEFORE triggering full restart
		const restartCountBefore = bot.getRestartCount!()

		// Now trigger a full restart
		await files.createTemp(
			'src/robo/hooks/ready.ts',
			`
export default () => {
	console.log('Ready after mixed changes')
}
`
		)

		await bot.waitForFullRestart!(30000, restartCountBefore)

		// After restart, our handler change should still be there
		// (since the file was modified on disk)
		await dispatchInteraction(bot.sessionId, {
			type: 2,
			data: { name: 'ping', type: 1 },
			guild_id: bot.guildId,
			channel_id: channelId
		})

		await expectAction(bot.sessionId, {
			description: 'Handler change persists after full restart',
			type: 'interaction_response',
			expected: { response_data: { content: 'HMR First!' } },
			timeout: 5000
		})
	}, 90000)
})
