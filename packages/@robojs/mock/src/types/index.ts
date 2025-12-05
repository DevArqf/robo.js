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
	interactions: Map<Snowflake, MockInteraction>
	attachments: Map<Snowflake, StoredAttachment> // Phase 4E: File storage
	pollVotes: Map<Snowflake, Map<Snowflake, number[]>> // Phase 4G: messageId -> userId -> answerIds[]
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

// ============================================================================
// Thread Types (Phase 4D)
// ============================================================================

/**
 * Thread metadata (nested in thread channel)
 */
export interface MockThreadMetadata {
	archived: boolean
	auto_archive_duration: 60 | 1440 | 4320 | 10080 // Minutes until auto-archive
	archive_timestamp: string // ISO 8601
	locked: boolean
	invitable?: boolean // Private threads only - whether non-mods can add members
	create_timestamp?: string // ISO 8601
	last_activity_timestamp?: string // ISO 8601 - tracks last message for auto-archive
}

/**
 * Thread member representation
 */
export interface MockThreadMember {
	id?: Snowflake // Thread ID (only in certain endpoints)
	user_id?: Snowflake // User ID (only in certain endpoints)
	join_timestamp: string // ISO 8601
	flags: number // User's notification settings
}

/**
 * Thread channel data (extends MockChannel)
 * Types: 10 = ANNOUNCEMENT_THREAD, 11 = PUBLIC_THREAD, 12 = PRIVATE_THREAD
 */
export interface MockThread extends MockChannel {
	type: 10 | 11 | 12
	parentId: Snowflake // Required for threads (parent text/announcement channel)
	ownerId: Snowflake // User who created the thread
	threadMetadata: MockThreadMetadata
	memberCount: number // Approximate count (max 50)
	messageCount: number // Approximate count
	totalMessageSent?: number // Total messages ever sent (including deleted)
	lastMessageId?: Snowflake | null
}

/**
 * Configuration for creating a mock thread
 */
export interface MockThreadConfig {
	id?: Snowflake
	name: string
	type: 10 | 11 | 12
	parentId: Snowflake
	ownerId?: Snowflake // Defaults to bot user
	autoArchiveDuration?: 60 | 1440 | 4320 | 10080
	invitable?: boolean // For private threads
	rateLimitPerUser?: number
}

/**
 * Options for dispatching a thread create event
 */
export interface DispatchThreadCreateOptions {
	name: string
	parentChannelId: Snowflake
	type?: 10 | 11 | 12 // Default: 11 (PUBLIC_THREAD)
	messageId?: Snowflake // If creating thread from a message
	autoArchiveDuration?: 60 | 1440 | 4320 | 10080
	invitable?: boolean
	user?: MockUserConfig
}

/**
 * Options for dispatching a thread update event
 */
export interface DispatchThreadUpdateOptions {
	threadId: Snowflake
	name?: string
	archived?: boolean
	locked?: boolean
	autoArchiveDuration?: 60 | 1440 | 4320 | 10080
	invitable?: boolean
	rateLimitPerUser?: number
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
	attachments: MockAttachment[]
	embeds: unknown[]
	pinned: boolean
	type: number
	// Phase 3I: APIMessage completeness fields
	call?: MockMessageCall
	interaction_metadata?: MockMessageInteractionMetadata
	interaction?: MockMessageInteraction // Deprecated, kept for backwards compatibility
	message_snapshots?: MockMessageSnapshot[]
	resolved?: unknown
	// Phase 4F: Components V2
	flags?: number
	components?: unknown[]
	// Phase 4G: Polls
	poll?: MockPoll
}

// ============================================================================
// Phase 4G: Poll Types
// ============================================================================

/**
 * Poll layout types
 * @see https://discord.com/developers/docs/resources/poll#layout-type
 */
export enum PollLayoutType {
	Default = 1
}

/**
 * Poll media object (question or answer content)
 */
export interface MockPollMedia {
	text?: string
	emoji?: {
		id?: Snowflake | null
		name?: string | null
		animated?: boolean
	}
}

/**
 * Poll answer option
 */
export interface MockPollAnswer {
	answer_id: number // 1-indexed
	poll_media: MockPollMedia
}

/**
 * Vote count for a poll answer
 */
export interface MockPollAnswerCount {
	id: number // answer_id
	count: number
	me_voted: boolean
}

/**
 * Poll results (vote counts)
 */
export interface MockPollResults {
	is_finalized: boolean
	answer_counts: MockPollAnswerCount[]
}

/**
 * Poll object attached to a message
 * @see https://discord.com/developers/docs/resources/poll#poll-object
 */
export interface MockPoll {
	question: MockPollMedia
	answers: MockPollAnswer[]
	expiry: string | null // ISO8601 timestamp when poll ends
	allow_multiselect: boolean
	layout_type: PollLayoutType
	results?: MockPollResults
}

/**
 * Configuration for creating a poll (used in message creation)
 */
export interface MockPollConfig {
	question: {
		text: string
		emoji?: MockPollMedia['emoji']
	}
	answers: Array<{
		poll_media: MockPollMedia
	}>
	duration?: number // Hours until expiry (1, 4, 8, 24, 72, 168)
	allow_multiselect?: boolean
	layout_type?: PollLayoutType
}

// ============================================================================
// Phase 4E: Attachment Types
// ============================================================================

/**
 * Discord attachment flags (bitfield)
 * @see https://discord.com/developers/docs/resources/message#attachment-object-attachment-flags
 */
export const AttachmentFlags = {
	/** This attachment has been edited using the remix feature on mobile */
	IS_REMIX: 1 << 2 // 4
} as const

/**
 * Validation constants for attachments
 */
export const AttachmentLimits = {
	/** Maximum description (alt text) length in characters */
	MAX_DESCRIPTION_LENGTH: 1024,
	/** Maximum files per message */
	MAX_FILES_PER_MESSAGE: 10,
	/** Maximum total file size per message in bytes (25MB) */
	MAX_TOTAL_SIZE: 25 * 1024 * 1024,
	/** Spoiler filename prefix */
	SPOILER_PREFIX: 'SPOILER_'
} as const

/**
 * Attachment metadata as returned in API responses
 */
export interface MockAttachment {
	id: Snowflake
	filename: string
	title?: string
	description?: string // Alt text for accessibility (max 1024 chars)
	content_type?: string
	size: number
	url: string
	proxy_url: string
	width?: number // For images
	height?: number // For images
	duration_secs?: number // For audio
	waveform?: string // For audio (base64)
	ephemeral?: boolean
	flags?: number
	/** Computed from filename starting with SPOILER_ */
	spoiler?: boolean
}

/**
 * Attachment data stored in session state (includes binary data)
 */
export interface StoredAttachment {
	id: Snowflake
	channelId: Snowflake
	messageId: Snowflake
	filename: string
	contentType: string
	size: number
	data: Uint8Array
	width?: number
	height?: number
}

/**
 * Attachment metadata from payload_json (used during upload)
 */
export interface AttachmentPayload {
	id: number // Index matching files[n], not a snowflake
	filename?: string
	description?: string
	title?: string
}

// ============================================================================
// Phase 3I: APIMessage Completeness Types
// ============================================================================

/**
 * Voice/video call info for DM messages (MessageType.Call = 3)
 */
export interface MockMessageCall {
	participants: Snowflake[]
	ended_timestamp?: string | null
}

/**
 * Interaction metadata for messages created from interaction responses
 * Replaces the deprecated `interaction` field
 */
export interface MockMessageInteractionMetadata {
	id: Snowflake
	type: number
	user: MockUser
	authorizing_integration_owners?: Record<number, Snowflake>
	original_response_message_id?: Snowflake
	target_user?: MockUser
	target_message_id?: Snowflake
}

/**
 * Deprecated interaction reference (kept for backwards compatibility)
 */
export interface MockMessageInteraction {
	id: Snowflake
	type: number
	name: string
	user: MockUser
}

/**
 * Message snapshot for forwarded messages
 */
export interface MockMessageSnapshot {
	message: MockMessageSnapshotContent
}

/**
 * Content of a forwarded message snapshot
 */
export interface MockMessageSnapshotContent {
	type: number
	content: string
	embeds: unknown[]
	attachments: unknown[]
	timestamp: string
	edited_timestamp: string | null
	flags?: number
	mentions: MockUser[]
	mention_roles: Snowflake[]
	sticker_items?: unknown[]
	components?: unknown[]
}

// ============================================================================
// Mock Interaction Types (Phase 3A)
// ============================================================================

/**
 * Mock interaction data (slash commands, buttons, modals, etc.)
 */
export interface MockInteraction {
	id: Snowflake
	applicationId: Snowflake
	type: number // InteractionType enum value
	token: string
	channelId: Snowflake
	guildId?: Snowflake
	userId: Snowflake
	commandName?: string // For APPLICATION_COMMAND
	commandId?: Snowflake
	options?: MockInteractionOption[]
	createdAt: number
	expiresAt: number // 15 minutes from creation
	// Response tracking (Phase 3B)
	response?: MockInteractionResponse
	respondedAt?: number
	// For MESSAGE_COMPONENT interactions (Phase 3C - buttons, Phase 3D - selects)
	customId?: string // Button/select/modal custom_id
	componentType?: number // 2 = button, 3 = string select, 5-8 = entity selects
	messageId?: Snowflake // ID of message the component was on
	values?: string[] // Selected values (Phase 3D - select menus only)
	// For MODAL_SUBMIT interactions (Phase 3E)
	modalFields?: Record<string, string> // { field_custom_id: value }
	// For context menu commands (Phase 3G)
	targetId?: Snowflake // Target user/message ID
	contextMenuType?: 2 | 3 // 2=USER, 3=MESSAGE
	// For tracking response messages (Phase 3H)
	responseMessageId?: Snowflake // ID of message created by initial response (type 4/7)
	followupMessageIds?: Snowflake[] // IDs of followup messages sent via webhook
}

/**
 * Stored response for an interaction (Phase 3B)
 */
export interface MockInteractionResponse {
	type: number // InteractionResponseType enum
	timestamp: number
	data?: InteractionResponseData
}

/**
 * Response data (content, embeds, components, flags)
 */
export interface InteractionResponseData {
	content?: string
	embeds?: unknown[]
	components?: unknown[]
	flags?: number // 64 = ephemeral
	tts?: boolean
	allowed_mentions?: unknown
}

/**
 * Interaction option value
 */
export interface MockInteractionOption {
	name: string
	type: number // ApplicationCommandOptionType
	value?: string | number | boolean
	options?: MockInteractionOption[] // For subcommands
	focused?: boolean // For autocomplete
}

/**
 * Options for dispatching a slash command
 */
export interface DispatchSlashCommandOptions {
	commandName: string
	options?: Record<string, string | number | boolean>
	user?: MockUserConfig
	channelId?: string
	guildId?: string
}

/**
 * Options for dispatching a button click (Phase 3C)
 */
export interface DispatchButtonClickOptions {
	customId: string // Required: button's custom_id
	messageId: Snowflake // Required: message with the button
	user?: MockUserConfig // User who clicked (optional)
	channelId?: string // Channel (optional, derived from message)
	guildId?: string // Guild (optional, derived from message)
}

/**
 * Options for dispatching a select menu interaction (Phase 3D)
 */
export interface DispatchSelectMenuOptions {
	customId: string // Required: select menu's custom_id
	messageId: Snowflake // Required: message with the select menu
	values: string[] // Required: selected values
	componentType?: number // Optional: 3=String, 5=User, 6=Role, 7=Mentionable, 8=Channel (default: 3)
	user?: MockUserConfig // User who selected (optional)
	channelId?: string // Channel (optional, derived from message)
	guildId?: string // Guild (optional, derived from message)
}

/**
 * Options for dispatching a modal submit interaction (Phase 3E)
 */
export interface DispatchModalSubmitOptions {
	customId: string // Required: modal's custom_id
	fields: Record<string, string> // Required: { field_custom_id: value }
	messageId?: Snowflake // Optional: message that triggered the modal (links to original interaction)
	user?: MockUserConfig // User who submitted (optional)
	channelId?: string // Channel (optional, uses first available if not specified)
	guildId?: string // Guild (optional, derived from channel)
}

/**
 * Options for dispatching an autocomplete interaction (Phase 3F)
 */
export interface DispatchAutocompleteOptions {
	/** Command name being typed */
	commandName: string
	/** The option being autocompleted (must have focused: true) */
	focusedOption: {
		name: string
		/** Current partial value user has typed */
		value: string
		/** Option type (3=STRING, 4=INTEGER, 10=NUMBER) - defaults to STRING */
		type?: number
	}
	/** Other options already filled in (optional) */
	options?: Record<string, string | number | boolean>
	/** User triggering autocomplete */
	user?: MockUserConfig
	/** Channel ID (auto-resolved if not provided) */
	channelId?: string
	/** Guild ID (auto-resolved if not provided) */
	guildId?: string
}

/**
 * Options for dispatching a context menu interaction (Phase 3G)
 */
export interface DispatchContextMenuOptions {
	/** Command name (e.g., "Get Info", "Report Message") */
	commandName: string
	/** Target user ID (for USER commands) or message ID (for MESSAGE commands) */
	targetId: Snowflake
	/** Context menu type: 2=USER, 3=MESSAGE */
	contextMenuType: 2 | 3
	/** User who invoked the command */
	user?: MockUserConfig
	/** Channel ID (required for MESSAGE commands, optional for USER in guild) */
	channelId?: string
	/** Guild ID (optional, derived from channel/target) */
	guildId?: string
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
	attachments?: MockAttachment[]
	tts?: boolean
	type?: number
	// Phase 3I: APIMessage completeness config fields
	call?: MockMessageCall
	interactionMetadata?: MockMessageInteractionMetadata
	messageSnapshots?: MockMessageSnapshot[]
	resolved?: unknown
	// Phase 4F: Components V2
	flags?: number
	components?: unknown[]
	// Phase 4G: Polls
	poll?: MockPollConfig
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
	// Thread actions (Phase 4D)
	| 'thread_created'
	| 'thread_updated'
	| 'thread_deleted'
	| 'thread_member_added'
	| 'thread_member_removed'
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
// Session Recording Types (Phase 4A)
// ============================================================================

/**
 * Complete session recording with metadata for replay
 */
export interface SessionRecording {
	/** Recording format version */
	version: 1
	/** Metadata about the session */
	metadata: RecordingMetadata
	/** Initial session configuration for replay */
	initialConfig: SessionConfig
	/** All recorded actions in order */
	actions: RecordedAction[]
}

/**
 * Metadata for a session recording
 */
export interface RecordingMetadata {
	/** Session ID */
	sessionId: string
	/** Optional session name */
	sessionName?: string
	/** Session start timestamp (ms) */
	startTime: number
	/** Session end/export timestamp (ms) */
	endTime: number
	/** Duration in milliseconds */
	duration: number
	/** Total number of actions recorded */
	actionCount: number
	/** Bot user info */
	botUser: {
		id: string
		username: string
	}
	/** Application ID */
	applicationId: string
	/** Recording creation timestamp (ISO 8601) */
	recordedAt: string
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
	interactions: SerializedMockInteraction[]
	attachments: SerializedStoredAttachment[] // Phase 4E
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

export interface SerializedMockThread extends SerializedMockChannel {
	type: 10 | 11 | 12
	parentId: string // Required for threads
	ownerId: string
	threadMetadata: {
		archived: boolean
		auto_archive_duration: number
		archive_timestamp: string
		locked: boolean
		invitable?: boolean
		create_timestamp?: string
		last_activity_timestamp?: string
	}
	memberCount: number
	messageCount: number
	totalMessageSent?: number
	lastMessageId?: string | null
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
	attachments: SerializedMockAttachment[]
	embeds: unknown[]
	pinned: boolean
	type: number
}

/**
 * Serialized attachment metadata
 */
export interface SerializedMockAttachment {
	id: string
	filename: string
	title?: string
	description?: string
	content_type?: string
	size: number
	url: string
	proxy_url: string
	width?: number
	height?: number
	duration_secs?: number
	waveform?: string
	ephemeral?: boolean
	flags?: number
}

/**
 * Serialized stored attachment (binary data as base64)
 */
export interface SerializedStoredAttachment {
	id: string
	channelId: string
	messageId: string
	filename: string
	contentType: string
	size: number
	data: string // Base64 encoded
	width?: number
	height?: number
}

export interface SerializedMockInteraction {
	id: string
	applicationId: string
	type: number
	token: string
	channelId: string
	guildId?: string
	userId: string
	commandName?: string
	commandId?: string
	options?: MockInteractionOption[]
	createdAt: number
	expiresAt: number
	// Response tracking (Phase 3B)
	response?: MockInteractionResponse
	respondedAt?: number
	// For MESSAGE_COMPONENT interactions (Phase 3C)
	customId?: string
	componentType?: number
	messageId?: string
	values?: string[] // Phase 3D - select menus
	// For MODAL_SUBMIT interactions (Phase 3E)
	modalFields?: Record<string, string>
	// For context menu commands (Phase 3G)
	targetId?: string
	contextMenuType?: 2 | 3
	// For tracking response messages (Phase 3H)
	responseMessageId?: string
	followupMessageIds?: string[]
}

// ============================================================================
// Replay Types (Phase 4B)
// ============================================================================

/**
 * Validation mode for comparing bot responses during replay
 */
export type ValidationMode = 'strict' | 'flexible' | 'type-only'

/**
 * Options for replaying a recorded session
 */
export interface ReplayOptions {
	/** Speed multiplier (1 = real-time, 2 = 2x speed, 0 = instant). Default: 1 */
	speed?: number
	/** Whether to validate bot responses against recording. Default: false */
	validate?: boolean
	/** Validation strictness mode. Default: 'flexible' */
	validationMode?: ValidationMode
	/** Timeout in ms for waiting on bot responses. Default: 5000 */
	responseTimeout?: number
	/** Callback for progress updates (for UI integration) */
	onProgress?: (state: ReplayState) => void
	/** Callback when replay completes */
	onComplete?: (result: ReplayResult) => void
}

/**
 * Real-time playback state for UI binding (Phase 5J compatible)
 */
export interface ReplayState {
	/** Current playback mode */
	mode: 'idle' | 'playing' | 'paused' | 'completed'
	/** Current time in ms since recording start */
	currentTime: number
	/** Total recording duration in ms */
	duration: number
	/** Current action index being replayed */
	currentIndex: number
	/** Total number of actions to replay */
	totalActions: number
	/** Current playback speed multiplier */
	speed: number
	/** The action currently being replayed */
	currentAction?: RecordedAction
}

/**
 * Result of a replay operation
 */
export interface ReplayResult {
	/** Whether replay completed successfully */
	success: boolean
	/** Number of actions that were replayed */
	actionsReplayed: number
	/** Actual duration of replay in ms */
	duration: number
	/** Validation results if validation was enabled */
	validation?: ValidationResult
}

/**
 * Results of validating bot responses during replay
 */
export interface ValidationResult {
	/** Whether all validations passed */
	passed: boolean
	/** Number of responses that matched */
	matched: number
	/** Number of responses that did not match */
	mismatched: number
	/** Number of extra responses not in recording */
	extra: number
	/** Number of expected responses that were missing */
	missing: number
	/** Details of each mismatch */
	mismatches: ValidationMismatch[]
}

/**
 * Details of a single validation mismatch
 */
export interface ValidationMismatch {
	/** Index of the action in the recording */
	index: number
	/** The expected action from the recording */
	expected: RecordedAction
	/** The actual action received (null if missing) */
	actual: RecordedAction | null
	/** Human-readable reason for the mismatch */
	reason: string
}

// ============================================================================
// Phase 4F: Components V2 Types
// ============================================================================

/**
 * Discord message flags (bitfield)
 * @see https://discord.com/developers/docs/resources/message#message-object-message-flags
 */
export const MessageFlags = {
	/** Message has been published to subscribed channels */
	Crossposted: 1 << 0,
	/** Message originated from a message in another channel */
	IsCrosspost: 1 << 1,
	/** Do not include embeds when serializing this message */
	SuppressEmbeds: 1 << 2,
	/** Source message for this crosspost has been deleted */
	SourceMessageDeleted: 1 << 3,
	/** Message came from the urgent message system */
	Urgent: 1 << 4,
	/** Message has an associated thread */
	HasThread: 1 << 5,
	/** Message is only visible to the user who invoked the interaction */
	Ephemeral: 1 << 6,
	/** Message is an interaction response and the bot is "thinking" */
	Loading: 1 << 7,
	/** Message failed to mention some roles and add their members to the thread */
	FailedToMentionSomeRolesInThread: 1 << 8,
	/** Message will not trigger push and desktop notifications */
	SuppressNotifications: 1 << 12,
	/** Message is a voice message */
	IsVoiceMessage: 1 << 13,
	/** Message uses Components V2 format (replaces content/embeds) */
	IsComponentsV2: 1 << 15 // 32768
} as const

/**
 * Component types for V2 components
 * @see https://discord.com/developers/docs/interactions/message-components
 */
export const ComponentTypeV2 = {
	// V1 Components (existing)
	ActionRow: 1,
	Button: 2,
	StringSelect: 3,
	TextInput: 4,
	UserSelect: 5,
	RoleSelect: 6,
	MentionableSelect: 7,
	ChannelSelect: 8,
	// V2 Display Components
	Section: 9,
	TextDisplay: 10,
	Thumbnail: 11,
	MediaGallery: 12,
	File: 13,
	Separator: 14,
	ContentInventoryEntry: 16,
	Container: 17
} as const

/**
 * V2 validation limits
 */
export const ComponentsV2Limits = {
	/** Maximum total components (including nested) */
	MAX_COMPONENTS: 40,
	/** Maximum total text length across all TextDisplay components */
	MAX_TEXT_LENGTH: 4000,
	/** Maximum items in a MediaGallery */
	MAX_MEDIA_GALLERY_ITEMS: 10,
	/** Maximum TextDisplay components in a Section */
	MAX_SECTION_TEXT_COMPONENTS: 3
} as const

/**
 * Media item for V2 components (image/file reference)
 */
export interface UnfurledMediaItem {
	/** URL - can be attachment:// or https:// */
	url: string
}

/**
 * TextDisplay component - standalone markdown text
 */
export interface TextDisplayComponent {
	type: typeof ComponentTypeV2.TextDisplay
	id?: number
	content: string
}

/**
 * Thumbnail component - image accessory for Section
 */
export interface ThumbnailComponent {
	type: typeof ComponentTypeV2.Thumbnail
	id?: number
	media: UnfurledMediaItem
	description?: string
	spoiler?: boolean
}

/**
 * Button component reference for V2 (can be Section accessory)
 */
export interface ButtonComponentV2 {
	type: typeof ComponentTypeV2.Button
	id?: number
	style: number
	label?: string
	emoji?: { id?: string; name?: string; animated?: boolean }
	custom_id?: string
	url?: string
	disabled?: boolean
}

/**
 * Section component - text with optional accessory (thumbnail or button)
 */
export interface SectionComponent {
	type: typeof ComponentTypeV2.Section
	id?: number
	components: TextDisplayComponent[]
	accessory?: ThumbnailComponent | ButtonComponentV2
}

/**
 * Item in a MediaGallery
 */
export interface MediaGalleryItem {
	media: UnfurledMediaItem
	description?: string
	spoiler?: boolean
}

/**
 * MediaGallery component - grid of images (1-10)
 */
export interface MediaGalleryComponent {
	type: typeof ComponentTypeV2.MediaGallery
	id?: number
	items: MediaGalleryItem[]
}

/**
 * File component - single file display
 */
export interface FileComponent {
	type: typeof ComponentTypeV2.File
	id?: number
	file: UnfurledMediaItem
	spoiler?: boolean
}

/**
 * Separator component - horizontal divider
 */
export interface SeparatorComponent {
	type: typeof ComponentTypeV2.Separator
	id?: number
	divider?: boolean
	spacing?: 'small' | 'large'
}

/**
 * ActionRow component reference for V2 Container
 */
export interface ActionRowComponentV2 {
	type: typeof ComponentTypeV2.ActionRow
	id?: number
	components: unknown[]
}

/**
 * Container component - styled wrapper with optional accent color
 */
export interface ContainerComponent {
	type: typeof ComponentTypeV2.Container
	id?: number
	accent_color?: number
	spoiler?: boolean
	components: (
		| ActionRowComponentV2
		| TextDisplayComponent
		| SectionComponent
		| MediaGalleryComponent
		| FileComponent
		| SeparatorComponent
	)[]
}

/**
 * Union type for all V2 top-level components
 */
export type ComponentV2 =
	| ActionRowComponentV2
	| TextDisplayComponent
	| SectionComponent
	| MediaGalleryComponent
	| FileComponent
	| SeparatorComponent
	| ContainerComponent

/**
 * Validation result for Components V2
 */
export interface ComponentsV2ValidationResult {
	valid: boolean
	errors: string[]
}

/**
 * Discord API Error response format
 * Matches Discord's exact error structure for compatibility with Discord.js
 */
export interface DiscordAPIError {
	code: number
	message: string
	errors?: {
		[key: string]: {
			_errors: Array<{
				code: string
				message: string
			}>
		}
	}
}

/**
 * Creates a Discord-formatted error response for component validation failures
 */
export function createComponentValidationError(validationErrors: string[]): DiscordAPIError {
	return {
		code: 50035,
		message: 'Invalid Form Body',
		errors: {
			components: {
				_errors: validationErrors.map((msg) => ({
					code: 'COMPONENT_VALIDATION_FAILED',
					message: msg
				}))
			}
		}
	}
}

/**
 * Creates a Discord-formatted error for content/embeds conflict with V2
 */
export function createV2ConflictError(): DiscordAPIError {
	return {
		code: 50035,
		message: 'Invalid Form Body',
		errors: {
			components: {
				_errors: [
					{
						code: 'COMPONENT_VALIDATION_FAILED',
						message: 'Cannot use content or embeds with Components V2'
					}
				]
			}
		}
	}
}
