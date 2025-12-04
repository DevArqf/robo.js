import type { Snowflake } from 'discord-api-types/v10'

// ============================================================================
// Session Types
// ============================================================================

/**
 * Represents an isolated test session with its own state
 */
export interface Session {
	id: string
	token: string
	name?: string
	createdAt: number
	expiresAt: number
	state: SessionState
	connections: Map<string, ConnectionState>
	readonly isExpired: boolean
	readonly isEnding: boolean
}

/**
 * Isolated state for a session
 */
export interface SessionState {
	guilds: Map<Snowflake, MockGuild>
	channels: Map<Snowflake, MockChannel>
	dmChannels: Map<Snowflake, MockChannel> // By recipient user ID
	users: Map<Snowflake, MockUser>
	messages: Map<Snowflake, MockMessage>
	botUser: MockUser
	applicationId: Snowflake
	sequence: number
}

/**
 * WebSocket connection state
 */
export interface ConnectionState {
	id: string
	sessionId: string
	identified: boolean
	token: string | null
	intents: number
	sequence: number
	lastAckSequence: number | null
	lastHeartbeat: number
	heartbeatInterval: number
	missedHeartbeats: number
}

// ============================================================================
// Session Configuration
// ============================================================================

/**
 * Options for creating a new session
 */
export interface CreateSessionOptions {
	name?: string
	ttl?: number
	config?: SessionConfig
}

/**
 * Configuration for session initial state
 */
export interface SessionConfig {
	guilds?: MockGuildConfig[]
	users?: MockUserConfig[]
	botUser?: MockUserConfig
	applicationId?: Snowflake
	/** Maximum number of recorded actions before LRU eviction (default: 10000) */
	maxActions?: number
}

/**
 * Options for SessionManager
 */
export interface SessionManagerOptions {
	defaultTTL?: number
	cleanupIntervalMs?: number
	storage?: SessionStorage
}

// ============================================================================
// Mock Entity Types
// ============================================================================

/**
 * Mock guild data
 */
export interface MockGuild {
	id: Snowflake
	name: string
	ownerId: Snowflake
	channels: Snowflake[]
	members: Snowflake[]
	roles: Snowflake[]
}

/**
 * Configuration for creating a mock guild
 */
export interface MockGuildConfig {
	id?: Snowflake
	name?: string
	ownerId?: Snowflake
	channels?: MockChannelConfig[]
}

/**
 * Mock channel data
 */
export interface MockChannel {
	id: Snowflake
	guildId?: Snowflake
	name: string
	type: number
	parentId?: Snowflake | null
}

/**
 * Mock message data
 */
export interface MockMessage {
	id: Snowflake
	channelId: Snowflake
	guildId?: Snowflake
	authorId: Snowflake
	content: string
	timestamp: string
	editedTimestamp: string | null
	tts: boolean
	mentionEveryone: boolean
	mentions: Snowflake[]
	mentionRoles: Snowflake[]
	attachments: unknown[]
	embeds: unknown[]
	pinned: boolean
	type: number
}

/**
 * Configuration for creating a mock message
 */
export interface MockMessageConfig {
	id?: Snowflake
	channelId: Snowflake
	guildId?: Snowflake
	authorId: Snowflake
	content?: string
	embeds?: unknown[]
	attachments?: unknown[]
	tts?: boolean
	type?: number
}

/**
 * Configuration for creating a mock channel
 */
export interface MockChannelConfig {
	id?: Snowflake
	name?: string
	type?: number
	parentId?: Snowflake | null
}

/**
 * Mock user data
 */
export interface MockUser {
	id: Snowflake
	username: string
	discriminator: string
	globalName: string | null
	avatar: string | null
	bot: boolean
}

/**
 * Configuration for creating a mock user
 */
export interface MockUserConfig {
	id?: Snowflake
	username?: string
	discriminator?: string
	globalName?: string | null
	avatar?: string | null
	bot?: boolean
}

// ============================================================================
// Storage Interface
// ============================================================================

/**
 * Storage interface for session persistence
 * Default implementation is in-memory, can be swapped for Flashcore
 */
export interface SessionStorage {
	get(id: string): Session | undefined
	set(id: string, session: Session): void
	delete(id: string): boolean
	values(): IterableIterator<Session>
	clear(): void
	size: number
}

// ============================================================================
// Auth Provider Types
// ============================================================================

/**
 * Authentication provider interface for hosted deployments
 */
export interface AuthProvider {
	validateRequest(req: Request): Promise<AuthResult>
	onSessionCreated?(session: Session, auth: AuthResult): Promise<void>
	onSessionEnded?(session: Session, auth: AuthResult): Promise<void>
}

/**
 * Result of authentication validation
 */
export interface AuthResult {
	valid: boolean
	error?: string
	userId?: string
	metadata?: Record<string, unknown>
}

// ============================================================================
// Recorded Action Types (for test assertions)
// ============================================================================

/**
 * Action type classification for recorded actions
 */
export type ActionType =
	// REST API actions (for Phase 2D+)
	| 'message_sent'
	| 'message_edited'
	| 'message_deleted'
	| 'reaction_added'
	| 'reaction_removed'
	| 'interaction_response'
	| 'interaction_followup'
	| 'interaction_edit'
	| 'typing_started'
	| 'rest_request'
	// Gateway WebSocket actions (client → server)
	| 'gateway_message'
	| 'gateway_identify'
	| 'gateway_heartbeat'
	| 'gateway_presence_update'
	| 'gateway_voice_state_update'
	| 'gateway_resume'
	| 'gateway_request_guild_members'
	// Dispatched events (server → client, for debugging)
	| 'dispatch'

/**
 * Recorded action from bot (for test assertions)
 */
export interface RecordedAction {
	/** Unique action ID */
	id: string
	/** Unix timestamp in milliseconds */
	timestamp: number
	/** Action type classification */
	type: ActionType
	/** Full payload data */
	data: unknown
	/** For REST actions: endpoint path (e.g., "POST /channels/123/messages") */
	endpoint?: string
	/** For REST actions: HTTP method */
	method?: string
	/** For interaction responses: the interaction ID */
	interactionId?: string
	/** For interaction responses: the response type */
	responseType?: number
	/** ID of the event that triggered this action (for causal tracking) */
	triggeredBy?: string
}

/**
 * Options for recording an action
 */
export interface RecordActionOptions {
	endpoint?: string
	method?: string
	interactionId?: string
	responseType?: number
	triggeredBy?: string
}

// ============================================================================
// Serialized Types (for API responses)
// ============================================================================

/**
 * Serialized session state for API responses
 */
export interface SerializedSessionState {
	guilds: SerializedMockGuild[]
	channels: SerializedMockChannel[]
	dmChannels: SerializedMockChannel[]
	users: SerializedMockUser[]
	messages: SerializedMockMessage[]
	botUser: SerializedMockUser
	applicationId: string
	sequence: number
}

export interface SerializedMockGuild {
	id: string
	name: string
	ownerId: string
	channels: string[]
	members: string[]
	roles: string[]
}

export interface SerializedMockChannel {
	id: string
	guildId?: string
	name: string
	type: number
	parentId?: string | null
}

export interface SerializedMockUser {
	id: string
	username: string
	discriminator: string
	globalName: string | null
	avatar: string | null
	bot: boolean
}

export interface SerializedMockMessage {
	id: string
	channelId: string
	guildId?: string
	authorId: string
	content: string
	timestamp: string
	editedTimestamp: string | null
	tts: boolean
	mentionEveryone: boolean
	mentions: string[]
	mentionRoles: string[]
	attachments: unknown[]
	embeds: unknown[]
	pinned: boolean
	type: number
}
