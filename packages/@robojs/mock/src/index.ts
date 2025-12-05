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
export { Session, SessionManager, InMemoryStorage, MockServerState, ActionRecorder, RecordingPlayer } from './session/index.js'
export type { StateOptions } from './session/index.js'
export { sessionManager } from './core/manager.js'
export { mockLogger } from './core/logger.js'
export { GatewayServer, getGatewayServer, closeGatewayServer } from './core/gateway.js'

// Discord Gateway exports
export {
	GatewayOpcodes,
	GatewayCloseCodes,
	DEFAULT_HEARTBEAT_INTERVAL,
	GATEWAY_VERSION
} from './discord/opcodes.js'
export {
	buildHelloPayload,
	buildHeartbeatAckPayload,
	isValidIdentifyPayload,
	buildInteractionCreatePayload,
	buildButtonInteractionPayload,
	buildSelectMenuInteractionPayload,
	buildModalSubmitInteractionPayload,
	buildAutocompleteInteractionPayload,
	buildContextMenuInteractionPayload,
	// Thread payload builders (Phase 4D)
	mockThreadToAPIChannel,
	buildThreadCreatePayload,
	buildThreadUpdatePayload,
	buildThreadDeletePayload,
	buildThreadListSyncPayload,
	buildThreadMemberUpdatePayload,
	buildThreadMembersUpdatePayload
} from './discord/payloads.js'
export type {
	GatewayPayload,
	HelloPayloadData,
	IdentifyPayloadData,
	InteractionCreatePayloadOptions,
	ButtonInteractionPayloadOptions,
	SelectMenuInteractionPayloadOptions,
	ModalSubmitInteractionPayloadOptions,
	AutocompleteInteractionPayloadOptions,
	ContextMenuInteractionPayloadOptions,
	// Thread payload types (Phase 4D)
	ThreadCreatePayloadOptions,
	ThreadUpdatePayloadOptions,
	ThreadDeletePayloadOptions,
	ThreadListSyncPayloadOptions,
	ThreadMemberUpdatePayloadOptions,
	ThreadMembersUpdatePayloadOptions
} from './discord/payloads.js'

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
	createDefaultGuildWithChannel,
	createMockUser,
	createMockGuild,
	createMockChannel,
	createMockMessage,
	serializeSessionState,
	serializeMockGuild,
	serializeMockChannel,
	serializeMockUser,
	serializeMockMessage,
	serializeMockInteraction,
	// Thread helpers (Phase 4D)
	createMockThread,
	serializeMockThread
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
	MockMessage,
	MockMessageConfig,
	MockInteraction,
	MockInteractionOption,
	DispatchSlashCommandOptions,
	DispatchButtonClickOptions,
	DispatchSelectMenuOptions,
	DispatchModalSubmitOptions,
	DispatchAutocompleteOptions,
	DispatchContextMenuOptions,
	AuthProvider,
	AuthResult,
	ActionType,
	RecordedAction,
	RecordActionOptions,
	SerializedSessionState,
	SerializedMockGuild,
	SerializedMockChannel,
	SerializedMockUser,
	SerializedMockMessage,
	SerializedMockInteraction,
	// Session Recording types (Phase 4A)
	SessionRecording,
	RecordingMetadata,
	// Replay types (Phase 4B)
	ValidationMode,
	ReplayOptions,
	ReplayState,
	ReplayResult,
	ValidationResult,
	ValidationMismatch,
	// Thread types (Phase 4D)
	MockThread,
	MockThreadConfig,
	MockThreadMetadata,
	MockThreadMember,
	DispatchThreadCreateOptions,
	SerializedMockThread
} from './types/index.js'
