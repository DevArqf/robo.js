/**
 * Event HMR Integration Tests
 *
 * Tests hot module replacement for event handlers.
 * Verifies that changes to event handlers are picked up without full restart.
 */
import { fileURLToPath } from 'node:url'
import { describe, it, beforeAll, afterAll, afterEach } from '@jest/globals'
import { startMockRobo, clearSessionActions, sleep } from '@robojs/mock/testing'
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
		await files.restoreAll()
		// Wait for any HMR from restore to settle
		await sleep(1000)
		await clearSessionActions(bot.sessionId)
	})

	it('should hot-reload modified event handler', async () => {
		// This test verifies that HMR works for event handler files
		// The key thing being tested is that HMR happens without crashing

		// Capture HMR count BEFORE modifying file
		const hmrCountBefore = bot.getHmrCount!()

		// Modify the event handler
		await files.modify('src/events/messageCreate/example.ts', (content) =>
			content.replace("'Hello, world!'", "'Hot Hello!'")
		)

		// Wait for HMR reload - this verifies HMR was detected for event handlers
		await bot.waitForHmrReload!(15000, hmrCountBefore)

		// If we get here, HMR was successful for the event handler
		// The bot process survived and detected the change
	}, 30000)

	it('should handle adding new event handler', async () => {
		// This test verifies that HMR detects new event handler files

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

		// If we get here, HMR detected and processed the new event handler file
	}, 30000)

	it('should document module state reset behavior', async () => {
		// This test documents that module-level state (like counters) resets after HMR
		// because the module is completely reloaded

		// Capture HMR count BEFORE modifying file
		const hmrCountBefore = bot.getHmrCount!()

		// Make a trivial change to trigger HMR (add a comment)
		await files.modify('src/events/messageCreate/example.ts', (content) => content + '\n// HMR state test')

		// Wait for HMR reload
		await bot.waitForHmrReload!(15000, hmrCountBefore)

		// If we get here, the module was reloaded
		// The documentation behavior: any module-level state would be reset
		// because HMR fully reloads the module with a new import
	}, 30000)
})
