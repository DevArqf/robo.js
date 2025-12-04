import type { APIUser, APIGuild, APIChannel, Snowflake } from 'discord-api-types/v10'

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
}

/**
 * Isolated state for a session
 */
export interface SessionState {
	guilds: Map<Snowflake, MockGuild>
	channels: Map<Snowflake, MockChannel>
	users: Map<Snowflake, MockUser>
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
 * Recorded action from bot (for test assertions)
 */
export interface RecordedAction {
	timestamp: number
	type: string
	data: unknown
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
	users: SerializedMockUser[]
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
