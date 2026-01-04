/**
 * Utility HMR Integration Tests
 *
 * Tests dependency-aware hot module replacement.
 * Verifies that changes to utility files trigger HMR for dependent handlers.
 */
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals'
import { startMockRobo, dispatchInteraction, expectAction, clearSessionActions, sleep } from '@robojs/mock/testing'
import type { MockRoboHandle } from '@robojs/mock/testing'
import { TempFileManager } from '../utils/temp-file-manager.js'

const __filename = fileURLToPath(import.meta.url)

describe('Utility HMR', () => {
	let bot: MockRoboHandle
	let files: TempFileManager

	beforeAll(async () => {
		bot = await startMockRobo({
			name: 'utility-hmr',
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
				await bot.waitForHmrReload!(20000, hmrCountBefore)
			} catch {
				// HMR might not trigger if files didn't actually change
			}
			// Extra wait for graph to stabilize
			await sleep(1000)
		}
		await clearSessionActions(bot.sessionId)
	})

	it('should hot-reload handler when utility file changes', async () => {
		const channelId = bot.channels[0].id

		// Verify initial state (ping returns 'Pong!' from the utility chain)
		await dispatchInteraction(bot.sessionId, {
			type: 2,
			data: { name: 'ping', type: 1 },
			guild_id: bot.guildId,
			channel_id: channelId
		})
		await expectAction(bot.sessionId, {
			description: 'Ping uses utility, returns Pong!',
			type: 'interaction_response',
			expected: { response_data: { content: 'Pong!' } },
			timeout: 5000
		})

		// Modify ONLY the utility file (not the handler)
		await clearSessionActions(bot.sessionId)
		const hmrCountStep2 = bot.getHmrCount!()
		await files.modify('src/utils/ping-message.ts', (content) =>
			content.replace("'Pong!'", "'Utility Hot Pong!'")
		)

		// Wait for dependency-aware HMR to reload the ping handler
		await bot.waitForHmrReload!(15000, hmrCountStep2)

		// Step 3: Verify the handler reflects the utility change
		await dispatchInteraction(bot.sessionId, {
			type: 2,
			data: { name: 'ping', type: 1 },
			guild_id: bot.guildId,
			channel_id: channelId
		})
		await expectAction(bot.sessionId, {
			description: 'Ping reflects utility change',
			type: 'interaction_response',
			expected: { response_data: { content: 'Utility Hot Pong!' } },
			timeout: 5000
		})
	}, 60000)

	it('should propagate deep dependency changes through the chain', async () => {
		const channelId = bot.channels[0].id

		// Verify initial state - dependency chain is:
		// ping.ts -> ping-message.ts -> deeper.ts
		await clearSessionActions(bot.sessionId)
		await dispatchInteraction(bot.sessionId, {
			type: 2,
			data: { name: 'ping', type: 1 },
			guild_id: bot.guildId,
			channel_id: channelId
		})
		await expectAction(bot.sessionId, {
			description: 'Initial ping returns Pong! via utility chain',
			type: 'interaction_response',
			expected: { response_data: { content: 'Pong!' } },
			timeout: 5000
		})

		// Modify ONLY deeper.ts (the deep dependency, 2 levels down)
		await clearSessionActions(bot.sessionId)
		const hmrCountStep2 = bot.getHmrCount!()
		await files.modify('src/utils/deeper.ts', (content) =>
			content.replace('return text', "return '[DEEP] ' + text")
		)

		// Wait for HMR to propagate through the chain
		await bot.waitForHmrReload!(20000, hmrCountStep2)

		// Step 3: Verify the handler reflects the deep dependency change
		await dispatchInteraction(bot.sessionId, {
			type: 2,
			data: { name: 'ping', type: 1 },
			guild_id: bot.guildId,
			channel_id: channelId
		})
		await expectAction(bot.sessionId, {
			description: 'Ping reflects deep dependency change',
			type: 'interaction_response',
			expected: { response_data: { content: '[DEEP] Pong!' } },
			timeout: 5000
		})
	}, 90000)

	it('should reload multiple handlers when shared utility changes', async () => {
		const channelId = bot.channels[0].id

		// Ensure clean state by verifying ping returns original value first
		await clearSessionActions(bot.sessionId)
		await dispatchInteraction(bot.sessionId, {
			type: 2,
			data: { name: 'ping', type: 1 },
			guild_id: bot.guildId,
			channel_id: channelId
		})
		// First check current state (don't assert yet, just consume)
		await sleep(1000)
		await clearSessionActions(bot.sessionId)

		// Create another command that also uses the utility
		const hmrCountStep2 = bot.getHmrCount!()
		await files.createTemp(
			'src/commands/ping2.ts',
			`
import { createCommandConfig } from '@robojs/discordjs'
import type { ChatInputCommandInteraction } from 'discord.js'
import { getPingMessage } from '../utils/ping-message.js'

export const config = createCommandConfig({
	description: 'Second ping command using shared utility'
} as const)

export default (interaction: ChatInputCommandInteraction) => {
	interaction.reply('ping2: ' + getPingMessage())
}
`
		)
		await bot.waitForHmrReload!(15000, hmrCountStep2)
		await sleep(500)

		// Verify both commands work with utility
		await clearSessionActions(bot.sessionId)
		await dispatchInteraction(bot.sessionId, {
			type: 2,
			data: { name: 'ping', type: 1 },
			guild_id: bot.guildId,
			channel_id: channelId
		})
		await expectAction(bot.sessionId, {
			description: 'First ping uses utility',
			type: 'interaction_response',
			expected: { response_data: { content: 'Pong!' } },
			timeout: 5000
		})

		await clearSessionActions(bot.sessionId)
		await dispatchInteraction(bot.sessionId, {
			type: 2,
			data: { name: 'ping2', type: 1 },
			guild_id: bot.guildId,
			channel_id: channelId
		})
		await expectAction(bot.sessionId, {
			description: 'Second ping uses utility',
			type: 'interaction_response',
			expected: { response_data: { content: 'ping2: Pong!' } },
			timeout: 5000
		})

		// Modify the shared utility
		await clearSessionActions(bot.sessionId)
		const hmrCountStep3 = bot.getHmrCount!()
		await files.modify('src/utils/ping-message.ts', (content) =>
			content.replace("'Pong!'", "'SHARED UPDATE!'")
		)
		await bot.waitForHmrReload!(15000, hmrCountStep3)

		// Step 4: Verify BOTH handlers reflect the utility change
		await dispatchInteraction(bot.sessionId, {
			type: 2,
			data: { name: 'ping', type: 1 },
			guild_id: bot.guildId,
			channel_id: channelId
		})
		await expectAction(bot.sessionId, {
			description: 'First ping reflects shared utility change',
			type: 'interaction_response',
			expected: { response_data: { content: 'SHARED UPDATE!' } },
			timeout: 5000
		})

		await clearSessionActions(bot.sessionId)
		await dispatchInteraction(bot.sessionId, {
			type: 2,
			data: { name: 'ping2', type: 1 },
			guild_id: bot.guildId,
			channel_id: channelId
		})
		await expectAction(bot.sessionId, {
			description: 'Second ping reflects shared utility change',
			type: 'interaction_response',
			expected: { response_data: { content: 'ping2: SHARED UPDATE!' } },
			timeout: 5000
		})
	}, 90000)
})
