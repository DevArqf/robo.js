import { getServerEngine } from '@robojs/server'
import type { NodeEngine } from '@robojs/server/engines.js'
import type { StartContext } from 'robo.js'
import { getStageBridge } from '../core/stage-bridge.js'
import { startVoiceGateway, VOICE_GATEWAY_PORT } from '../core/voice-gateway.js'
import { mockLogger } from '../core/logger.js'
import { getMockModeState } from './init.js'
import { sessionManager } from '../core/manager.js'
import { getStageUIUrl } from '../utils/server.js'
import { resolveBotUser } from '../utils/bot-user-resolver.js'
import { DEFAULT_MOCK_PLUGIN_CONFIG, type MockPluginConfig } from '../types/plugin.js'
import { registerWebSocketHandlers, areHandlersRegistered, markHandlersRegistered } from './prepare.js'
import type { Session } from '../session/session.js'

/**
 * Global reference to the mock mode session.
 * Used for shutdown cleanup and summary.
 */
let mockModeSession: Session | null = null

/**
 * Gets the current mock mode session (if any).
 * Used by the CLI command for shutdown handling.
 */
export function getMockModeSession(): Session | null {
	return mockModeSession
}

/**
 * Clears the mock mode session reference.
 * Called during cleanup.
 */
export function clearMockModeSession(): void {
	mockModeSession = null
}

/**
 * Lifecycle hook: Called when the Robo starts
 * Starts Voice Gateway server and creates mock mode session.
 *
 * Note: WebSocket handlers are registered in the prepare hook (prepare.ts)
 * to ensure they're ready before @robojs/discordjs tries to connect.
 */
export default async (context: StartContext<MockPluginConfig>) => {
	const { pluginConfig } = context
	const config = { ...DEFAULT_MOCK_PLUGIN_CONFIG, ...pluginConfig }

	// WebSocket handlers should already be registered in prepare hook.
	// If not (e.g., server engine wasn't ready), register them now as fallback.
	if (!areHandlersRegistered()) {
		const engine = getServerEngine<NodeEngine>()
		if (!engine) {
			mockLogger.error('Server engine not available - @robojs/server may not be installed')
			return
		}
		mockLogger.debug('Registering WebSocket handlers in start hook (fallback)')
		registerWebSocketHandlers(engine)
		markHandlersRegistered()
	}

	// Initialize the stage bridge (connects session events to stage server)
	getStageBridge()

	// Start Voice Gateway server on separate port
	// @discordjs/voice connects to: ws://host:50001/?v=4
	try {
		await startVoiceGateway(VOICE_GATEWAY_PORT)
	} catch (error) {
		// Voice gateway is optional - log warning but don't fail startup
		mockLogger.warn(`Failed to start Voice Gateway: ${(error as Error).message}`)
	}

	mockLogger.info('Gateway WebSocket server ready')
	mockLogger.info('Stage WebSocket server ready')

	// Handle mock mode session creation
	const mockModeState = getMockModeState()
	if (mockModeState.enabled && mockModeState.sessionId) {
		mockLogger.debug('Creating mock mode session...')

		// Resolve bot user using fallback chain:
		// 1. Explicit config from defaultSessionConfig.botUser
		// 2. Fetch from Discord API using real token
		// 3. Default "MockBot"
		const resolvedBotUser = await resolveBotUser(config.defaultSessionConfig?.botUser)
		mockLogger.info(`Bot identity: ${resolvedBotUser.config.username} (${resolvedBotUser.source})`)

		// Merge resolved bot user with session config
		const sessionConfig = {
			...config.defaultSessionConfig,
			botUser: resolvedBotUser.config
		}

		// Create the session with the pre-generated ID
		mockModeSession = await sessionManager.create({
			id: mockModeState.sessionId,
			name: mockModeState.sessionName ?? undefined,
			config: sessionConfig
		})

		// Log the Stage UI URL for easy access
		const stageUrl = getStageUIUrl(mockModeSession.token)
		mockLogger.info(`Stage UI: ${stageUrl}`)
	}
}
