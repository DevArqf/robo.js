export { Session } from './session.js'
export { SessionManager } from './manager.js'
export { InMemoryStorage } from './storage.js'
export { ActionRecorder } from './recorder.js'
export {
	// Class
	MockServerState,
	// Factory functions
	createSessionState,
	createMockUser,
	createMockGuild,
	createMockChannel,
	createMockMessage,
	// Helper functions (backward compatibility)
	addGuildToSession,
	addChannelToGuild,
	createDefaultGuildWithChannel,
	// Serialization functions
	serializeSessionState,
	serializeMockGuild,
	serializeMockChannel,
	serializeMockUser,
	serializeMockMessage,
	serializeMockInteraction
} from './state.js'
export type { StateOptions } from './state.js'
