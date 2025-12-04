/**
 * @robojs/mock - Discord Gateway mock server for automated testing
 *
 * @example
 * ```typescript
 * import { sessionManager, Session, SessionManager } from '@robojs/mock'
 *
 * // Create a session for testing
 * const session = await sessionManager.create({ name: 'my-test' })
 * console.log(`Use token: ${session.token}`)
 *
 * // Check session state
 * const state = session.state
 *
 * // Clean up
 * await sessionManager.delete(session.id)
 * ```
 */

// Core exports
export { Session, SessionManager, InMemoryStorage } from './session/index.js'
export { sessionManager } from './core/manager.js'
export { mockLogger } from './core/logger.js'

// Utility exports
export {
	generateSnowflake,
	snowflakeToTimestamp,
	timestampToSnowflake,
	generateSessionId,
	generateInteractionToken,
	generateGatewaySessionId,
	createMockToken,
	parseMockToken,
	TOKEN_PREFIX
} from './utils/index.js'

// State helpers
export {
	createSessionState,
	createMockUser,
	createMockGuild,
	createMockChannel,
	serializeSessionState,
	serializeMockGuild,
	serializeMockChannel,
	serializeMockUser
} from './session/state.js'

// Auth exports
export { createAuthMiddleware, NoOpAuthProvider, ApiKeyAuthProvider } from './auth/index.js'

// Type exports
export type {
	Session as ISession,
	SessionState,
	ConnectionState,
	CreateSessionOptions,
	SessionConfig,
	SessionManagerOptions,
	SessionStorage,
	MockGuild,
	MockGuildConfig,
	MockChannel,
	MockChannelConfig,
	MockUser,
	MockUserConfig,
	AuthProvider,
	AuthResult,
	RecordedAction,
	SerializedSessionState,
	SerializedMockGuild,
	SerializedMockChannel,
	SerializedMockUser
} from './types/index.js'
