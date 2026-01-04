/**
 * Tests for interaction routing
 *
 * Verifies that:
 * - handleInteraction routes to the correct handler based on type
 * - Command interactions route to executeCommandHandler
 * - Autocomplete interactions route to executeAutocompleteHandler
 * - Context menu interactions route to executeContextHandler
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock the handler modules before importing interactions
jest.unstable_mockModule('../src/core/handlers/command.js', () => ({
	executeCommandHandler: jest.fn()
}))

jest.unstable_mockModule('../src/core/handlers/autocomplete.js', () => ({
	executeAutocompleteHandler: jest.fn()
}))

jest.unstable_mockModule('../src/core/handlers/context.js', () => ({
	executeContextHandler: jest.fn()
}))

// Import the mocked modules
const { executeCommandHandler } = (await import('../src/core/handlers/command.js')) as {
	executeCommandHandler: jest.Mock
}
const { executeAutocompleteHandler } = (await import('../src/core/handlers/autocomplete.js')) as {
	executeAutocompleteHandler: jest.Mock
}
const { executeContextHandler } = (await import('../src/core/handlers/context.js')) as {
	executeContextHandler: jest.Mock
}

// Import the module under test
const { handleInteraction } = await import('../src/core/interactions.js')

// Mock interaction factory
function createMockInteraction(overrides = {}) {
	return {
		commandName: 'test',
		isChatInputCommand: jest.fn().mockReturnValue(true),
		isAutocomplete: jest.fn().mockReturnValue(false),
		isContextMenuCommand: jest.fn().mockReturnValue(false),
		reply: jest.fn(),
		deferReply: jest.fn(),
		...overrides
	}
}

describe('Interaction Router', () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe('handleInteraction', () => {
		it('should route command interactions to executeCommandHandler', async () => {
			const interaction = createMockInteraction()

			await handleInteraction(interaction as any, 'command', 'ping')

			expect(executeCommandHandler).toHaveBeenCalledWith(interaction, 'ping')
			expect(executeAutocompleteHandler).not.toHaveBeenCalled()
			expect(executeContextHandler).not.toHaveBeenCalled()
		})

		it('should route autocomplete interactions to executeAutocompleteHandler', async () => {
			const interaction = createMockInteraction({
				isChatInputCommand: jest.fn().mockReturnValue(false),
				isAutocomplete: jest.fn().mockReturnValue(true),
				respond: jest.fn()
			})

			await handleInteraction(interaction as any, 'autocomplete', 'search')

			expect(executeAutocompleteHandler).toHaveBeenCalledWith(interaction, 'search')
			expect(executeCommandHandler).not.toHaveBeenCalled()
			expect(executeContextHandler).not.toHaveBeenCalled()
		})

		it('should route context menu interactions to executeContextHandler', async () => {
			const interaction = createMockInteraction({
				isChatInputCommand: jest.fn().mockReturnValue(false),
				isContextMenuCommand: jest.fn().mockReturnValue(true),
				targetId: '123456789'
			})

			await handleInteraction(interaction as any, 'context', 'Get User Info')

			expect(executeContextHandler).toHaveBeenCalledWith(interaction, 'Get User Info')
			expect(executeCommandHandler).not.toHaveBeenCalled()
			expect(executeAutocompleteHandler).not.toHaveBeenCalled()
		})

		it('should pass the key to the handler', async () => {
			const interaction = createMockInteraction()

			await handleInteraction(interaction as any, 'command', 'user info')

			expect(executeCommandHandler).toHaveBeenCalledWith(interaction, 'user info')
		})

		it('should handle subcommand keys', async () => {
			const interaction = createMockInteraction()

			await handleInteraction(interaction as any, 'command', 'config settings view')

			expect(executeCommandHandler).toHaveBeenCalledWith(interaction, 'config settings view')
		})
	})
})
