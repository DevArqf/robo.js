/**
 * Init Hook - Early Mock Mode Detection
 *
 * This hook runs during Robo.start() BEFORE prepare hooks to:
 * 1. Detect if running in mock mode (via ROBO_MOCK_MODE env var)
 * 2. Store the pre-generated session ID for the start hook
 *
 * The mock CLI command sets ROBO_MOCK_MODE=true and ROBO_MOCK_SESSION_ID
 * before calling Robo.start(). This init hook picks up those values
 * and prepares for session creation in the start hook.
 */
import type { InitContext } from 'robo.js'

/**
 * Global state for mock mode.
 * Set by CLI command, read by start hook.
 */
export interface MockModeState {
	/** Whether running in mock mode */
	enabled: boolean
	/** Pre-generated session ID */
	sessionId: string | null
	/** Session name (usually project folder name) */
	sessionName: string | null
}

// Module-level state shared between init and start hooks
let mockModeState: MockModeState = {
	enabled: false,
	sessionId: null,
	sessionName: null
}

/**
 * Gets the current mock mode state.
 * Used by the start hook to check if it should create a session.
 */
export function getMockModeState(): MockModeState {
	return mockModeState
}

/**
 * Resets the mock mode state.
 * Called on shutdown to clean up.
 */
export function resetMockModeState(): void {
	mockModeState = {
		enabled: false,
		sessionId: null,
		sessionName: null
	}
}

/**
 * Init hook - Detects mock mode from environment variables.
 */
export default async function initHook(context: InitContext): Promise<void> {
	const { logger } = context

	// Check if running in mock mode
	const isMockMode = process.env.ROBO_MOCK_MODE === 'true'

	if (!isMockMode) {
		logger.debug('Not in mock mode, skipping init')
		return
	}

	// Get pre-generated session ID and name from environment
	const sessionId = process.env.ROBO_MOCK_SESSION_ID ?? null
	const sessionName = process.env.ROBO_MOCK_SESSION_NAME ?? null

	if (!sessionId) {
		logger.warn('ROBO_MOCK_MODE is set but ROBO_MOCK_SESSION_ID is missing')
	}

	// Store state for start hook
	mockModeState = {
		enabled: true,
		sessionId,
		sessionName
	}

	logger.debug(`Mock mode initialized with session: ${sessionName ?? sessionId}`)
}
