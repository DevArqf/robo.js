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
	config?: SessionConfig
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
	stickers: Map<Snowflake, MockSticker> // Phase 4I: Sticker storage
	webhooks: Map<Snowflake, MockWebhook> // Phase 4J: Webhook storage
	emojis: Map<Snowflake, MockEmoji> // Phase 4K: Emoji storage
	roles: Map<Snowflake, MockRole> // Phase 4L: Role storage
	guildMembers: Map<string, MockGuildMember> // Phase 4L: key = `${guildId}:${userId}`
	bans: Map<string, MockBan> // Phase 4L-B: key = `${guildId}:${userId}`
	commands: Map<Snowflake, MockApplicationCommand> // Phase 4M: Application commands
	invites: Map<string, MockInvite> // Phase 5A: Invite storage (key = code)
	scheduledEvents: Map<string, MockScheduledEvent> // Phase 5B: key = `${guildId}:${eventId}`
	autoModRules: Map<string, MockAutoModRule> // Phase 5C: key = `${guildId}:${ruleId}`
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
	/** Commands to seed in the session (for Stage UI testing) */
	commands?: MockApplicationCommandConfig[]
	/** Maximum number of recorded actions before LRU eviction (default: 10000) */
	maxActions?: number
	/**
	 * Whether to filter events based on declared intents.
	 * - false (default): All events sent regardless of intents
	 * - true: Events filtered by declared intents, MESSAGE_CONTENT stripped
	 *
	 * Useful for testing that your bot declares correct intents.
	 */
	enforceIntents?: boolean
	/**
	 * Privileged intents that are "approved" for this session.
	 * Only relevant when enforceIntents is true.
	 * Default: All privileged intents approved (for ease of testing)
	 *
	 * Use bigint values from GatewayIntentBits:
	 * - GuildMembers (1 << 1)
	 * - GuildPresences (1 << 8)
	 * - MessageContent (1 << 15)
	 */
	approvedPrivilegedIntents?: bigint
	/**
	 * Permission enforcement level for REST API calls.
	 * - 'none' (default): All actions succeed regardless of permissions
	 * - 'basic': Simple permission checks (requires the permission)
	 * - 'strict': Full Discord-accurate logic with hierarchy, context, owner bypass
	 *
	 * Useful for testing permission error handling in your bot.
	 */
	permissionEnforcement?: 'none' | 'basic' | 'strict'
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
	stickers: Snowflake[] // Phase 4I: Guild sticker IDs
	emojis: Snowflake[] // Phase 4K: Guild emoji IDs
	// Guild settings (Phase 6: Guild CRUD)
	description?: string | null
	afkChannelId?: Snowflake | null
	afkTimeout?: number // In seconds: 60, 300, 900, 1800, 3600
	systemChannelId?: Snowflake | null
	systemChannelFlags?: number
	verificationLevel?: number // GuildVerificationLevel
	defaultMessageNotifications?: number // GuildDefaultMessageNotifications
	explicitContentFilter?: number // GuildExplicitContentFilter
	mfaLevel?: number // GuildMFALevel
	icon?: string | null
	splash?: string | null
	banner?: string | null
	discoverySplash?: string | null // Phase 7: Discovery splash image hash
	premiumTier?: number // Phase 7: Server boost level (0-3)
	features?: string[] // Phase 7: Guild features array
}

/**
 * Configuration for creating a mock guild
 */
export interface MockGuildConfig {
	id?: Snowflake
	name?: string
	ownerId?: Snowflake
	channels?: MockChannelConfig[]
	stickers?: MockStickerConfig[] // Phase 4I
	emojis?: MockEmojiConfig[] // Phase 4K
}

/**
 * Mock channel data
 */
export interface MockChannel {
	id: Snowflake
	guildId?: Snowflake
	name: string
	type: number
	position?: number
	parentId?: Snowflake | null
	permissionOverwrites?: MockChannelOverwrite[] // Phase 4L
	topic?: string | null
	nsfw?: boolean
	bitrate?: number
	userLimit?: number
	rateLimitPerUser?: number
	status?: string | null // Voice channel status
	rtcRegion?: string | null // Voice channel region
	videoQualityMode?: number | null // Voice channel video quality (1 = auto, 2 = full)
	defaultAutoArchiveDuration?: number // Default thread auto-archive duration
}

/**
 * Mock voice state data (Phase 7)
 */
export interface MockVoiceState {
	guild_id: Snowflake
	channel_id: Snowflake | null
	user_id: Snowflake
	member?: MockGuildMember
	session_id?: string
	deaf?: boolean
	mute?: boolean
	self_deaf?: boolean
	self_mute?: boolean
	self_stream?: boolean
	self_video?: boolean
	suppress?: boolean
	request_to_speak_timestamp?: string | null
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
	rateLimitPerUser?: number // Slowmode in seconds
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

// ============================================================================
// Forum & Media Channel Types (Phase 4H)
// ============================================================================

/**
 * Forum tag definition (available_tags on forum channels)
 * @see https://discord.com/developers/docs/resources/channel#forum-tag-object
 */
export interface MockForumTag {
	id: Snowflake
	name: string // Max 20 characters
	moderated: boolean // Only mods can apply this tag
	emoji_id: Snowflake | null // Custom emoji ID
	emoji_name: string | null // Unicode emoji name
}

/**
 * Default reaction emoji for forum posts
 */
export interface MockDefaultReaction {
	emoji_id: Snowflake | null
	emoji_name: string | null
}

/**
 * Forum sort order types
 */
export enum ForumSortOrderType {
	LatestActivity = 0,
	CreationDate = 1
}

/**
 * Forum layout types
 */
export enum ForumLayoutType {
	NotSet = 0,
	ListView = 1,
	GalleryView = 2
}

/**
 * Forum channel data (type 15) or Media channel data (type 16)
 * @see https://discord.com/developers/docs/resources/channel#channel-object-channel-structure
 */
export interface MockForumChannel extends MockChannel {
	type: 15 | 16 // GUILD_FORUM or GUILD_MEDIA
	topic?: string // Channel description/guidelines
	default_auto_archive_duration?: 60 | 1440 | 4320 | 10080
	default_thread_rate_limit_per_user?: number
	default_sort_order?: ForumSortOrderType | null
	default_forum_layout?: ForumLayoutType
	default_reaction_emoji?: MockDefaultReaction | null
	available_tags: MockForumTag[] // Max 20 tags
	template?: string // Post template/guidelines
}

/**
 * Forum thread (post) - extends thread with applied_tags
 */
export interface MockForumThread extends MockThread {
	applied_tags: Snowflake[] // Max 5 tag IDs from parent's available_tags
}

/**
 * Configuration for creating a mock forum channel
 */
export interface MockForumChannelConfig {
	id?: Snowflake
	guildId?: Snowflake
	name?: string
	type?: 15 | 16
	parentId?: Snowflake | null
	topic?: string
	available_tags?: Omit<MockForumTag, 'id'>[]
	default_auto_archive_duration?: 60 | 1440 | 4320 | 10080
	default_thread_rate_limit_per_user?: number
	default_sort_order?: ForumSortOrderType | null
	default_forum_layout?: ForumLayoutType
	default_reaction_emoji?: MockDefaultReaction | null
	template?: string
}

/**
 * Configuration for creating a forum post (thread with initial message)
 */
export interface MockForumPostConfig {
	name: string
	parentId: Snowflake // Forum/media channel ID
	ownerId?: Snowflake // Defaults to bot user
	autoArchiveDuration?: 60 | 1440 | 4320 | 10080
	rateLimitPerUser?: number
	applied_tags?: Snowflake[] // Max 5 tags
	message: {
		content?: string
		embeds?: unknown[]
		components?: unknown[]
		attachments?: unknown[]
	}
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
	// Phase 3B: Reactions
	reactions?: MockReaction[]
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
	// Phase 4I: Stickers
	sticker_items?: MockStickerItem[]
	// Phase 3: Message reference (for replies)
	message_reference?: {
		message_id?: Snowflake
		channel_id?: Snowflake
		guild_id?: Snowflake
	}
}

/**
 * Mock reaction data for messages
 */
export interface MockReaction {
	count: number
	count_details: {
		burst: number
		normal: number
	}
	me: boolean
	me_burst: boolean
	emoji: {
		id: Snowflake | null
		name: string
	}
	burst_colors: string[]
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
// Phase 4I: Sticker Types
// ============================================================================

/**
 * Sticker type enum
 * @see https://discord.com/developers/docs/resources/sticker#sticker-object-sticker-types
 */
export enum StickerType {
	Standard = 1, // Official Discord sticker
	Guild = 2 // Server sticker
}

/**
 * Sticker format type enum
 * @see https://discord.com/developers/docs/resources/sticker#sticker-object-sticker-format-types
 */
export enum StickerFormatType {
	PNG = 1,
	APNG = 2,
	Lottie = 3,
	GIF = 4
}

/**
 * Full sticker object
 * @see https://discord.com/developers/docs/resources/sticker#sticker-object
 */
export interface MockSticker {
	id: Snowflake
	pack_id?: Snowflake // For standard stickers
	name: string
	description: string | null
	tags: string // Comma-separated autocomplete tags
	type: StickerType
	format_type: StickerFormatType
	available: boolean
	guild_id?: Snowflake // For guild stickers
	user?: MockUser // Uploader (guild stickers only)
	sort_value?: number // Sort order in pack (standard stickers)
}

/**
 * Partial sticker object in messages (sticker_items)
 * @see https://discord.com/developers/docs/resources/sticker#sticker-item-object
 */
export interface MockStickerItem {
	id: Snowflake
	name: string
	format_type: StickerFormatType
}

/**
 * Configuration for creating a guild sticker
 */
export interface MockStickerConfig {
	id?: Snowflake
	name: string
	description?: string
	tags: string
	format_type?: StickerFormatType
}

/**
 * Sticker pack object (for standard stickers)
 * @see https://discord.com/developers/docs/resources/sticker#sticker-pack-object
 */
export interface MockStickerPack {
	id: Snowflake
	stickers: MockSticker[]
	name: string
	sku_id: Snowflake
	cover_sticker_id?: Snowflake
	description: string
	banner_asset_id?: Snowflake
}

/**
 * Validation constants for stickers
 * @see https://discord.com/developers/docs/resources/sticker
 */
export const StickerLimits = {
	/** Maximum stickers per guild (Nitro boost level 3) */
	MAX_GUILD_STICKERS: 60,
	/** Minimum sticker name length */
	MIN_NAME_LENGTH: 2,
	/** Maximum sticker name length */
	MAX_NAME_LENGTH: 30,
	/** Minimum sticker description length (when not empty) */
	MIN_DESCRIPTION_LENGTH: 2,
	/** Maximum sticker description length */
	MAX_DESCRIPTION_LENGTH: 100,
	/** Minimum sticker tags length */
	MIN_TAGS_LENGTH: 2,
	/** Maximum sticker tags length */
	MAX_TAGS_LENGTH: 200,
	/** Maximum stickers per message */
	MAX_STICKERS_PER_MESSAGE: 3
} as const

// ============================================================================
// Phase 4K: Emoji Types
// ============================================================================

/**
 * Full emoji object
 * @see https://discord.com/developers/docs/resources/emoji#emoji-object
 */
export interface MockEmoji {
	id: Snowflake | null // null for standard Unicode emoji
	name: string | null
	roles?: Snowflake[] // Roles allowed to use this emoji
	user?: MockUser // User that created this emoji
	require_colons?: boolean
	managed?: boolean // Whether this emoji is managed by an integration
	animated?: boolean
	available?: boolean // Whether this emoji can be used
}

/**
 * Configuration for creating a guild emoji
 */
export interface MockEmojiConfig {
	id?: Snowflake
	name: string
	image?: string // Base64 image data (for creation)
	roles?: Snowflake[]
	animated?: boolean
}

/**
 * Validation constants for emojis
 * @see https://discord.com/developers/docs/resources/emoji
 */
export const EmojiLimits = {
	/** Maximum emojis per guild (base level, increases with Nitro boosts) */
	MAX_GUILD_EMOJIS: 50,
	/** Maximum emoji name length */
	MAX_NAME_LENGTH: 32,
	/** Minimum emoji name length */
	MIN_NAME_LENGTH: 2,
	/** Regex pattern for valid emoji names (alphanumeric and underscores only) */
	NAME_PATTERN: /^[a-zA-Z0-9_]+$/
} as const

// ============================================================================
// Phase 4J: Webhook Types
// ============================================================================

/**
 * Webhook type enum
 * @see https://discord.com/developers/docs/resources/webhook#webhook-object-webhook-types
 */
export enum WebhookType {
	/** Incoming webhook - can post messages with custom name/avatar */
	Incoming = 1,
	/**
	 * Channel Follower webhook - automatically created when following an announcement channel.
	 *
	 * NOT YET IMPLEMENTED: ChannelFollower webhooks require:
	 * - POST /channels/:id/followers endpoint to create them
	 * - Announcement channel type (ChannelType.GuildAnnouncement = 5)
	 * - Cross-server message forwarding when announcements are published
	 * - source_guild and source_channel fields in the webhook object
	 *
	 * These webhooks are auto-created and managed by Discord, not user-created.
	 * The endpoint GET /webhooks/:id will return them, but creation is via following.
	 *
	 * @see https://discord.com/developers/docs/resources/channel#follow-announcement-channel
	 */
	ChannelFollower = 2,
	/** Application webhook - used by applications for interactions */
	Application = 3
}

/**
 * Full webhook object
 * @see https://discord.com/developers/docs/resources/webhook#webhook-object
 */
export interface MockWebhook {
	id: Snowflake
	type: WebhookType
	guild_id?: Snowflake
	channel_id: Snowflake
	user?: MockUser // Creator (not returned if fetching with token by non-owner)
	name: string | null
	avatar: string | null
	token?: string // Only returned to webhook creator or when fetching by token
	application_id: Snowflake | null
	// For ChannelFollower webhooks
	source_guild?: {
		id: Snowflake
		name: string
		icon: string | null
	}
	source_channel?: {
		id: Snowflake
		name: string
	}
	url?: string // Full webhook URL
}

/**
 * Configuration for creating a webhook
 */
export interface MockWebhookConfig {
	id?: Snowflake
	name: string
	avatar?: string | null
	channel_id?: Snowflake // For moving webhook to different channel
}

/**
 * Validation constants for webhooks
 * @see https://discord.com/developers/docs/resources/webhook
 */
export const WebhookLimits = {
	/** Maximum webhooks per channel */
	MAX_WEBHOOKS_PER_CHANNEL: 15,
	/** Maximum webhook name length */
	MAX_NAME_LENGTH: 80,
	/** Minimum webhook name length */
	MIN_NAME_LENGTH: 1
} as const

/**
 * Serialized webhook for API responses
 */
export interface SerializedMockWebhook {
	id: string
	type: WebhookType
	guild_id?: string
	channel_id: string
	user?: SerializedMockUser
	name: string | null
	avatar: string | null
	token?: string
	application_id: string | null
	source_guild?: {
		id: string
		name: string
		icon: string | null
	}
	source_channel?: {
		id: string
		name: string
	}
	url?: string
}

// ============================================================================
// Phase 4L: Role & Permission Types
// ============================================================================

/**
 * Overwrite type enum
 * @see https://discord.com/developers/docs/resources/channel#overwrite-object
 */
export enum OverwriteType {
	/** Role permission overwrite */
	Role = 0,
	/** Member permission overwrite */
	Member = 1
}

/**
 * Channel permission overwrite
 * @see https://discord.com/developers/docs/resources/channel#overwrite-object
 */
export interface MockChannelOverwrite {
	id: Snowflake // Role or user ID
	type: OverwriteType // 0=Role, 1=Member
	allow: string // Allowed permissions (bitfield as string)
	deny: string // Denied permissions (bitfield as string)
}

/**
 * Role tags for special roles
 * @see https://discord.com/developers/docs/topics/permissions#role-object-role-tags-structure
 */
export interface MockRoleTags {
	bot_id?: Snowflake // Bot this role belongs to
	integration_id?: Snowflake // Integration this role belongs to
	premium_subscriber?: null // Is boost role (null = yes, presence indicates true)
	subscription_listing_id?: Snowflake
	available_for_purchase?: null // Can be purchased (null = yes)
	guild_connections?: null // Guild connections role (null = yes)
}

/**
 * Full role object
 * @see https://discord.com/developers/docs/topics/permissions#role-object
 */
export interface MockRole {
	id: Snowflake
	guildId: Snowflake
	name: string
	color: number // RGB color (0 = no color)
	hoist: boolean // Show separately in member list
	icon?: string | null // Role icon hash
	unicodeEmoji?: string | null // Unicode emoji icon
	position: number // Position in hierarchy (0 = @everyone)
	permissions: string // Permission bitfield as string
	managed: boolean // Managed by integration
	mentionable: boolean // Can be mentioned
	tags?: MockRoleTags // Special role tags
	flags: number // Role flags bitfield
}

/**
 * Configuration for creating a role
 */
export interface MockRoleConfig {
	id?: Snowflake
	name?: string
	color?: number
	hoist?: boolean
	icon?: string | null
	unicodeEmoji?: string | null
	permissions?: string
	mentionable?: boolean
	position?: number
	managed?: boolean
	tags?: MockRoleTags
}

/**
 * Guild member data
 * @see https://discord.com/developers/docs/resources/guild#guild-member-object
 */
export interface MockGuildMember {
	userId: Snowflake
	guildId: Snowflake
	roles: Snowflake[] // Role IDs (excludes @everyone)
	nick?: string | null
	avatar?: string | null // Guild-specific avatar
	joinedAt: string // ISO 8601 timestamp
	premiumSince?: string | null // When user started boosting
	deaf: boolean
	mute: boolean
	pending: boolean // Has not passed membership screening
	communicationDisabledUntil?: string | null // Timeout expiry
	flags: number // Guild member flags
}

/**
 * Configuration for creating/updating a guild member
 */
export interface MockGuildMemberConfig {
	nick?: string | null
	roles?: Snowflake[]
	deaf?: boolean
	mute?: boolean
	communicationDisabledUntil?: string | null
}

/**
 * Validation constants for roles
 * @see https://discord.com/developers/docs/topics/permissions#role-object
 */
export const RoleLimits = {
	/** Maximum roles per guild */
	MAX_ROLES_PER_GUILD: 250,
	/** Minimum role name length */
	MIN_NAME_LENGTH: 1,
	/** Maximum role name length */
	MAX_NAME_LENGTH: 100,
	/** Maximum color value (0xFFFFFF) */
	MAX_COLOR_VALUE: 16777215
} as const

/**
 * Options for dispatching role create event
 */
export interface DispatchRoleCreateOptions {
	guildId: Snowflake
	role?: MockRoleConfig
}

/**
 * Options for dispatching role update event
 */
export interface DispatchRoleUpdateOptions {
	guildId: Snowflake
	roleId: Snowflake
	updates: Partial<MockRoleConfig>
}

/**
 * Options for dispatching role delete event
 */
export interface DispatchRoleDeleteOptions {
	guildId: Snowflake
	roleId: Snowflake
}

/**
 * Options for dispatching guild member add event
 */
export interface DispatchGuildMemberAddOptions {
	guildId: Snowflake
	userId?: Snowflake
	user?: MockUserConfig
	roles?: Snowflake[]
}

/**
 * Options for dispatching guild member update event
 */
export interface DispatchGuildMemberUpdateOptions {
	guildId: Snowflake
	userId: Snowflake
	updates: Partial<MockGuildMemberConfig>
}

/**
 * Options for dispatching guild member remove event
 */
export interface DispatchGuildMemberRemoveOptions {
	guildId: Snowflake
	userId: Snowflake
}

/**
 * Serialized role for API responses
 */
export interface SerializedMockRole {
	id: string
	guildId: string
	name: string
	color: number
	hoist: boolean
	icon?: string | null
	unicode_emoji?: string | null
	position: number
	permissions: string
	managed: boolean
	mentionable: boolean
	tags?: {
		bot_id?: string
		integration_id?: string
		premium_subscriber?: null
		subscription_listing_id?: string
		available_for_purchase?: null
		guild_connections?: null
	}
	flags: number
}

/**
 * Serialized guild member for API responses
 */
export interface SerializedMockGuildMember {
	user: SerializedMockUser
	nick?: string | null
	avatar?: string | null
	roles: string[]
	joined_at: string
	premium_since?: string | null
	deaf: boolean
	mute: boolean
	pending: boolean
	communication_disabled_until?: string | null
	flags: number
}

// ============================================================================
// Phase 4L-B: Ban Types
// ============================================================================

/**
 * A guild ban entry
 * @see https://discord.com/developers/docs/resources/guild#ban-object
 */
export interface MockBan {
	guildId: Snowflake
	userId: Snowflake
	reason?: string | null
	/** Timestamp when the ban was created */
	createdAt: string
}

/**
 * Configuration for creating a ban
 */
export interface MockBanConfig {
	reason?: string | null
	/** Number of seconds to delete messages for (0-604800, max 7 days) */
	deleteMessageSeconds?: number
}

/**
 * Options for dispatching guild ban add event
 */
export interface DispatchGuildBanAddOptions {
	guildId: Snowflake
	userId: Snowflake
	reason?: string | null
}

/**
 * Options for dispatching guild ban remove event
 */
export interface DispatchGuildBanRemoveOptions {
	guildId: Snowflake
	userId: Snowflake
}

/**
 * Serialized ban for API responses
 */
export interface SerializedMockBan {
	user: SerializedMockUser
	reason: string | null
}

/**
 * Validation constants for bans
 */
export const BanLimits = {
	/** Maximum delete_message_seconds (7 days in seconds) */
	MAX_DELETE_MESSAGE_SECONDS: 604800,
	/** Maximum reason length */
	MAX_REASON_LENGTH: 512
} as const

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
	sticker_items?: MockStickerItem[] // Phase 4I
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
	/** User IDs that are mentioned in this message */
	mentions?: Snowflake[]
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
	// Phase 4I: Stickers
	sticker_ids?: Snowflake[]
	// Phase 3: Message reference (for replies)
	message_reference?: {
		message_id?: Snowflake
		channel_id?: Snowflake
		guild_id?: Snowflake
	}
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
	| 'message_pinned'
	| 'message_unpinned'
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
	// Poll actions (Phase 4G)
	| 'poll_voters_fetched'
	| 'poll_expired'
	// Sticker actions (Phase 4I)
	| 'sticker_created'
	| 'sticker_updated'
	| 'sticker_deleted'
	// Webhook actions (Phase 4J)
	| 'webhook_created'
	| 'webhook_updated'
	| 'webhook_deleted'
	| 'webhook_executed'
	// Emoji actions (Phase 4K)
	| 'emoji_created'
	| 'emoji_updated'
	| 'emoji_deleted'
	// Role actions (Phase 4L)
	| 'role_created'
	| 'role_updated'
	| 'role_deleted'
	| 'role_positions_updated'
	// Guild member actions (Phase 4L)
	| 'guild_member_added'
	| 'guild_member_updated'
	| 'guild_member_removed'
	| 'member_role_added'
	| 'member_role_removed'
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
	// Invite actions (Phase 5A)
	| 'invite_created'
	| 'invite_deleted'
	// Scheduled event actions (Phase 5B)
	| 'scheduled_event_created'
	| 'scheduled_event_updated'
	| 'scheduled_event_deleted'
	// AutoMod actions (Phase 5C)
	| 'automod_rule_created'
	| 'automod_rule_updated'
	| 'automod_rule_deleted'

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
	webhooks: SerializedMockWebhook[] // Phase 4J
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

/**
 * Serialized forum tag (Phase 4H)
 */
export interface SerializedMockForumTag {
	id: string
	name: string
	moderated: boolean
	emoji_id: string | null
	emoji_name: string | null
}

/**
 * Serialized forum/media channel (Phase 4H)
 */
export interface SerializedMockForumChannel extends SerializedMockChannel {
	type: 15 | 16
	topic?: string
	default_auto_archive_duration?: number
	default_thread_rate_limit_per_user?: number
	default_sort_order?: number | null
	default_forum_layout?: number
	default_reaction_emoji?: {
		emoji_id: string | null
		emoji_name: string | null
	} | null
	available_tags: SerializedMockForumTag[]
	template?: string
}

/**
 * Serialized forum thread/post (Phase 4H)
 */
export interface SerializedMockForumThread extends SerializedMockThread {
	applied_tags: string[]
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
	MAX_SECTION_TEXT_COMPONENTS: 3,
	/** Minimum TextDisplay components in a Section */
	MIN_SECTION_TEXT_COMPONENTS: 1,
	/** Maximum description length for MediaGallery items and Thumbnails */
	MAX_MEDIA_DESCRIPTION_LENGTH: 1024
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

// ============================================================================
// Phase 4M: Application Command Types
// ============================================================================

/**
 * Application command type enum
 * @see https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-types
 */
export enum ApplicationCommandType {
	/** Slash command - appears in command menu */
	ChatInput = 1,
	/** User context menu command */
	User = 2,
	/** Message context menu command */
	Message = 3
}

/**
 * Application command option type enum
 * @see https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-type
 */
export enum ApplicationCommandOptionType {
	SubCommand = 1,
	SubCommandGroup = 2,
	String = 3,
	Integer = 4,
	Boolean = 5,
	User = 6,
	Channel = 7,
	Role = 8,
	Mentionable = 9,
	Number = 10,
	Attachment = 11
}

/**
 * Predefined choice for string/integer/number options
 * @see https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-choice-structure
 */
export interface MockApplicationCommandOptionChoice {
	name: string // 1-100 chars
	name_localizations?: Record<string, string>
	value: string | number // String: 1-100 chars, Number: Discord number limits
}

/**
 * Application command option
 * @see https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-structure
 */
export interface MockApplicationCommandOption {
	type: ApplicationCommandOptionType
	name: string // 1-32 chars, lowercase
	name_localizations?: Record<string, string>
	description: string // 1-100 chars
	description_localizations?: Record<string, string>
	required?: boolean // Default false
	choices?: MockApplicationCommandOptionChoice[] // Max 25
	options?: MockApplicationCommandOption[] // For subcommand/subcommand_group
	channel_types?: number[] // For channel type option
	min_value?: number // For integer/number
	max_value?: number // For integer/number
	min_length?: number // For string (0-6000)
	max_length?: number // For string (1-6000)
	autocomplete?: boolean // For string/integer/number (mutually exclusive with choices)
}

/**
 * Full application command object
 * @see https://discord.com/developers/docs/interactions/application-commands#application-command-object
 */
export interface MockApplicationCommand {
	id: Snowflake
	type: ApplicationCommandType
	application_id: Snowflake
	guild_id?: Snowflake // undefined = global command
	name: string // 1-32 chars, lowercase for CHAT_INPUT
	name_localizations?: Record<string, string> | null
	description: string // 1-100 chars for CHAT_INPUT, empty for USER/MESSAGE
	description_localizations?: Record<string, string> | null
	options?: MockApplicationCommandOption[] // Max 25
	default_member_permissions: string | null // Permission bitfield as string
	dm_permission?: boolean // Deprecated but still supported
	default_permission?: boolean // Deprecated - use default_member_permissions
	nsfw?: boolean
	integration_types?: number[] // Installation contexts
	contexts?: number[] // Interaction contexts
	version: Snowflake // Autoincrement snowflake for change tracking
}

/**
 * Configuration for creating an application command
 */
export interface MockApplicationCommandConfig {
	id?: Snowflake
	type?: ApplicationCommandType // Default: ChatInput
	name: string
	name_localizations?: Record<string, string> | null
	description?: string // Required for CHAT_INPUT
	description_localizations?: Record<string, string> | null
	options?: MockApplicationCommandOption[]
	default_member_permissions?: string | null
	dm_permission?: boolean
	nsfw?: boolean
	integration_types?: number[]
	contexts?: number[]
}

/**
 * Validation constants for application commands
 * @see https://discord.com/developers/docs/interactions/application-commands
 */
export const CommandLimits = {
	/** Maximum global commands per application */
	MAX_GLOBAL_COMMANDS: 100,
	/** Maximum guild commands per application per guild */
	MAX_GUILD_COMMANDS: 100,
	/** Minimum command name length */
	MIN_NAME_LENGTH: 1,
	/** Maximum command name length */
	MAX_NAME_LENGTH: 32,
	/** Minimum description length for CHAT_INPUT */
	MIN_DESCRIPTION_LENGTH: 1,
	/** Maximum description length */
	MAX_DESCRIPTION_LENGTH: 100,
	/** Maximum options per command */
	MAX_OPTIONS: 25,
	/** Maximum choices per option */
	MAX_CHOICES: 25,
	/** Maximum choice name length */
	MAX_CHOICE_NAME_LENGTH: 100,
	/** Maximum string choice value length */
	MAX_CHOICE_STRING_VALUE_LENGTH: 100,
	/** Maximum option description length */
	MAX_OPTION_DESCRIPTION_LENGTH: 100,
	/** Regex pattern for valid command names (CHAT_INPUT) - lowercase, alphanumeric, dashes, underscores */
	CHAT_INPUT_NAME_PATTERN: /^[-_\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32}$/u,
	/** Maximum string option min_length */
	MAX_STRING_MIN_LENGTH: 6000,
	/** Maximum string option max_length */
	MAX_STRING_MAX_LENGTH: 6000
} as const

/**
 * Serialized application command for API responses
 */
export interface SerializedMockApplicationCommand {
	id: string
	type: ApplicationCommandType
	application_id: string
	guild_id?: string
	name: string
	name_localizations?: Record<string, string> | null
	description: string
	description_localizations?: Record<string, string> | null
	options?: MockApplicationCommandOption[]
	default_member_permissions: string | null
	dm_permission?: boolean
	nsfw?: boolean
	integration_types?: number[]
	contexts?: number[]
	version: string
}

// ============================================================================
// Phase 5A: Invite Types
// ============================================================================

/**
 * Invite target type enum
 * @see https://discord.com/developers/docs/resources/invite#invite-object-invite-target-types
 */
export enum InviteTargetType {
	Stream = 1,
	EmbeddedApplication = 2
}

/**
 * Full invite object
 * @see https://discord.com/developers/docs/resources/invite#invite-object
 */
export interface MockInvite {
	code: string
	guildId: Snowflake
	channelId: Snowflake
	inviterId: Snowflake
	maxAge: number // 0 = never expires, default 86400
	maxUses: number // 0 = unlimited
	uses: number
	temporary: boolean
	createdAt: string // ISO timestamp
	expiresAt: string | null
	targetType?: InviteTargetType
	targetUserId?: Snowflake
	targetApplicationId?: Snowflake
}

/**
 * Configuration for creating an invite
 */
export interface MockInviteConfig {
	maxAge?: number
	maxUses?: number
	temporary?: boolean
	unique?: boolean
	targetType?: InviteTargetType
	targetUserId?: Snowflake
	targetApplicationId?: Snowflake
}

/**
 * Validation constants for invites
 * @see https://discord.com/developers/docs/resources/invite
 */
export const InviteLimits = {
	/** Maximum age in seconds (7 days) */
	MAX_AGE: 604800,
	/** Default max age in seconds (24 hours) */
	DEFAULT_MAX_AGE: 86400,
	/** Maximum uses (100, or 0 for unlimited) */
	MAX_USES: 100,
	/** Length of invite code */
	CODE_LENGTH: 8
} as const

/**
 * Serialized invite for API responses (basic)
 */
export interface SerializedMockInvite {
	code: string
	guild?: {
		id: string
		name: string
		icon: string | null
	}
	channel: {
		id: string
		name: string
		type: number
	} | null
	inviter?: SerializedMockUser
	target_type?: InviteTargetType
	target_user?: SerializedMockUser
	target_application?: {
		id: string
		name: string
		icon: string | null
	}
	approximate_member_count?: number
	approximate_presence_count?: number
	expires_at?: string | null
	guild_scheduled_event?: SerializedMockScheduledEvent
}

/**
 * Extended invite for guild/channel invite list (includes uses, max_uses, etc.)
 */
export interface SerializedMockExtendedInvite extends SerializedMockInvite {
	uses: number
	max_uses: number
	max_age: number
	temporary: boolean
	created_at: string
}

// ============================================================================
// Phase 5B: Scheduled Event Types
// ============================================================================

/**
 * Guild scheduled event privacy level
 * @see https://discord.com/developers/docs/resources/guild-scheduled-event#guild-scheduled-event-object-guild-scheduled-event-privacy-level
 */
export enum GuildScheduledEventPrivacyLevel {
	GuildOnly = 2
}

/**
 * Guild scheduled event status
 * @see https://discord.com/developers/docs/resources/guild-scheduled-event#guild-scheduled-event-object-guild-scheduled-event-status
 */
export enum GuildScheduledEventStatus {
	Scheduled = 1,
	Active = 2,
	Completed = 3,
	Canceled = 4
}

/**
 * Guild scheduled event entity type
 * @see https://discord.com/developers/docs/resources/guild-scheduled-event#guild-scheduled-event-object-guild-scheduled-event-entity-types
 */
export enum GuildScheduledEventEntityType {
	StageInstance = 1,
	Voice = 2,
	External = 3
}

/**
 * Entity metadata for external events
 */
export interface MockScheduledEventEntityMetadata {
	location?: string // Max 100 chars, required for EXTERNAL
}

/**
 * Full scheduled event object
 * @see https://discord.com/developers/docs/resources/guild-scheduled-event#guild-scheduled-event-object
 */
export interface MockScheduledEvent {
	id: Snowflake
	guildId: Snowflake
	channelId: Snowflake | null // Required for STAGE_INSTANCE/VOICE, null for EXTERNAL
	creatorId: Snowflake | null
	name: string
	description: string | null
	scheduledStartTime: string // ISO timestamp
	scheduledEndTime: string | null // Required for EXTERNAL
	privacyLevel: GuildScheduledEventPrivacyLevel
	status: GuildScheduledEventStatus
	entityType: GuildScheduledEventEntityType
	entityId: Snowflake | null
	entityMetadata: MockScheduledEventEntityMetadata | null
	image: string | null
	/** User IDs subscribed to this event */
	subscribers: Set<Snowflake>
}

/**
 * Configuration for creating a scheduled event
 */
export interface MockScheduledEventConfig {
	name: string
	privacyLevel: GuildScheduledEventPrivacyLevel
	scheduledStartTime: string
	entityType: GuildScheduledEventEntityType
	channelId?: Snowflake // Required for STAGE_INSTANCE/VOICE
	scheduledEndTime?: string // Required for EXTERNAL
	description?: string
	entityMetadata?: MockScheduledEventEntityMetadata
	image?: string
}

/**
 * Configuration for updating a scheduled event
 */
export interface MockScheduledEventUpdateConfig {
	name?: string
	privacyLevel?: GuildScheduledEventPrivacyLevel
	scheduledStartTime?: string
	scheduledEndTime?: string | null
	description?: string | null
	channelId?: Snowflake | null
	entityType?: GuildScheduledEventEntityType
	entityMetadata?: MockScheduledEventEntityMetadata | null
	status?: GuildScheduledEventStatus
	image?: string | null
}

/**
 * Validation constants for scheduled events
 * @see https://discord.com/developers/docs/resources/guild-scheduled-event
 */
export const ScheduledEventLimits = {
	/** Maximum name length */
	MAX_NAME_LENGTH: 100,
	/** Minimum name length */
	MIN_NAME_LENGTH: 1,
	/** Maximum description length */
	MAX_DESCRIPTION_LENGTH: 1000,
	/** Maximum location length for external events */
	MAX_LOCATION_LENGTH: 100,
	/** Maximum scheduled events per guild */
	MAX_EVENTS_PER_GUILD: 100
} as const

/**
 * Serialized scheduled event for API responses
 */
export interface SerializedMockScheduledEvent {
	id: string
	guild_id: string
	channel_id: string | null
	creator_id: string | null
	creator?: SerializedMockUser
	name: string
	description: string | null
	scheduled_start_time: string
	scheduled_end_time: string | null
	privacy_level: GuildScheduledEventPrivacyLevel
	status: GuildScheduledEventStatus
	entity_type: GuildScheduledEventEntityType
	entity_id: string | null
	entity_metadata: MockScheduledEventEntityMetadata | null
	user_count?: number
	image?: string | null
}

/**
 * Scheduled event user (subscriber)
 */
export interface MockScheduledEventUser {
	guildScheduledEventId: Snowflake
	user: MockUser
	member?: MockGuildMember
}

/**
 * Serialized scheduled event user
 */
export interface SerializedMockScheduledEventUser {
	guild_scheduled_event_id: string
	user: SerializedMockUser
	member?: SerializedMockGuildMember
}

/**
 * Options for dispatching scheduled event create
 */
export interface DispatchScheduledEventCreateOptions {
	guildId: Snowflake
	event: MockScheduledEventConfig
}

/**
 * Options for dispatching scheduled event update
 */
export interface DispatchScheduledEventUpdateOptions {
	guildId: Snowflake
	eventId: Snowflake
	updates: MockScheduledEventUpdateConfig
}

/**
 * Options for dispatching scheduled event delete
 */
export interface DispatchScheduledEventDeleteOptions {
	guildId: Snowflake
	eventId: Snowflake
}

/**
 * Options for dispatching scheduled event user add/remove
 */
export interface DispatchScheduledEventUserOptions {
	guildId: Snowflake
	eventId: Snowflake
	userId: Snowflake
}

// ============================================================================
// Phase 5C: Auto-Moderation Types
// ============================================================================

/**
 * Auto-moderation rule event type
 * @see https://discord.com/developers/docs/resources/auto-moderation#auto-moderation-rule-object-event-types
 */
export enum AutoModerationEventType {
	MessageSend = 1,
	MemberUpdate = 2
}

/**
 * Auto-moderation rule trigger type
 * @see https://discord.com/developers/docs/resources/auto-moderation#auto-moderation-rule-object-trigger-types
 */
export enum AutoModerationTriggerType {
	Keyword = 1,
	Spam = 3,
	KeywordPreset = 4,
	MentionSpam = 5,
	MemberProfile = 6
}

/**
 * Auto-moderation keyword preset type
 * @see https://discord.com/developers/docs/resources/auto-moderation#auto-moderation-rule-object-keyword-preset-types
 */
export enum AutoModerationKeywordPresetType {
	Profanity = 1,
	SexualContent = 2,
	Slurs = 3
}

/**
 * Auto-moderation action type
 * @see https://discord.com/developers/docs/resources/auto-moderation#auto-moderation-action-object-action-types
 */
export enum AutoModerationActionType {
	BlockMessage = 1,
	SendAlertMessage = 2,
	Timeout = 3,
	BlockMemberInteraction = 4
}

/**
 * Auto-moderation trigger metadata
 * @see https://discord.com/developers/docs/resources/auto-moderation#auto-moderation-rule-object-trigger-metadata
 */
export interface MockAutoModTriggerMetadata {
	keywordFilter?: string[] // Max 1000 entries, each max 60 chars
	regexPatterns?: string[] // Max 10 patterns, each max 260 chars
	presets?: AutoModerationKeywordPresetType[]
	allowList?: string[] // Max 100 entries for keywords, 1000 for presets
	mentionTotalLimit?: number // Max mentions (0-50)
	mentionRaidProtectionEnabled?: boolean
}

/**
 * Auto-moderation action metadata
 */
export interface MockAutoModActionMetadata {
	channelId?: Snowflake // For SendAlertMessage
	durationSeconds?: number // For Timeout (max 2419200 = 28 days)
	customMessage?: string // For BlockMessage (max 150 chars)
}

/**
 * Auto-moderation action
 * @see https://discord.com/developers/docs/resources/auto-moderation#auto-moderation-action-object
 */
export interface MockAutoModAction {
	type: AutoModerationActionType
	metadata?: MockAutoModActionMetadata
}

/**
 * Full auto-moderation rule object
 * @see https://discord.com/developers/docs/resources/auto-moderation#auto-moderation-rule-object
 */
export interface MockAutoModRule {
	id: Snowflake
	guildId: Snowflake
	name: string
	creatorId: Snowflake
	eventType: AutoModerationEventType
	triggerType: AutoModerationTriggerType
	triggerMetadata: MockAutoModTriggerMetadata
	actions: MockAutoModAction[]
	enabled: boolean
	exemptRoles: Snowflake[]
	exemptChannels: Snowflake[]
}

/**
 * Configuration for creating an auto-mod rule
 */
export interface MockAutoModRuleConfig {
	name: string
	eventType: AutoModerationEventType
	triggerType: AutoModerationTriggerType
	triggerMetadata?: MockAutoModTriggerMetadata
	actions: MockAutoModAction[]
	enabled?: boolean
	exemptRoles?: Snowflake[]
	exemptChannels?: Snowflake[]
}

/**
 * Configuration for updating an auto-mod rule
 */
export interface MockAutoModRuleUpdateConfig {
	name?: string
	eventType?: AutoModerationEventType
	triggerMetadata?: MockAutoModTriggerMetadata
	actions?: MockAutoModAction[]
	enabled?: boolean
	exemptRoles?: Snowflake[]
	exemptChannels?: Snowflake[]
}

/**
 * Validation constants for auto-moderation
 * @see https://discord.com/developers/docs/resources/auto-moderation
 */
export const AutoModLimits = {
	/** Maximum rules per guild (per trigger type) */
	MAX_RULES_PER_TRIGGER_TYPE: 6,
	/** Maximum keyword filter entries */
	MAX_KEYWORD_FILTER: 1000,
	/** Maximum keyword length */
	MAX_KEYWORD_LENGTH: 60,
	/** Maximum regex patterns */
	MAX_REGEX_PATTERNS: 10,
	/** Maximum regex pattern length */
	MAX_REGEX_LENGTH: 260,
	/** Maximum allow list entries (for keyword rules) */
	MAX_ALLOW_LIST_KEYWORD: 100,
	/** Maximum allow list entries (for preset rules) */
	MAX_ALLOW_LIST_PRESET: 1000,
	/** Maximum exempt roles */
	MAX_EXEMPT_ROLES: 20,
	/** Maximum exempt channels */
	MAX_EXEMPT_CHANNELS: 50,
	/** Maximum mention total limit */
	MAX_MENTION_TOTAL_LIMIT: 50,
	/** Maximum timeout duration in seconds (28 days) */
	MAX_TIMEOUT_DURATION: 2419200,
	/** Maximum custom message length */
	MAX_CUSTOM_MESSAGE_LENGTH: 150,
	/** Maximum rule name length */
	MAX_NAME_LENGTH: 100,
	/** Minimum rule name length */
	MIN_NAME_LENGTH: 1
} as const

/**
 * Serialized auto-mod rule for API responses
 */
export interface SerializedMockAutoModRule {
	id: string
	guild_id: string
	name: string
	creator_id: string
	event_type: AutoModerationEventType
	trigger_type: AutoModerationTriggerType
	trigger_metadata: {
		keyword_filter?: string[]
		regex_patterns?: string[]
		presets?: AutoModerationKeywordPresetType[]
		allow_list?: string[]
		mention_total_limit?: number
		mention_raid_protection_enabled?: boolean
	}
	actions: Array<{
		type: AutoModerationActionType
		metadata?: {
			channel_id?: string
			duration_seconds?: number
			custom_message?: string
		}
	}>
	enabled: boolean
	exempt_roles: string[]
	exempt_channels: string[]
}

/**
 * Auto-moderation action execution data
 * @see https://discord.com/developers/docs/events/gateway-events#auto-moderation-action-execution
 */
export interface MockAutoModActionExecution {
	guildId: Snowflake
	action: MockAutoModAction
	ruleId: Snowflake
	ruleTriggerType: AutoModerationTriggerType
	userId: Snowflake
	channelId?: Snowflake
	messageId?: Snowflake
	alertSystemMessageId?: Snowflake
	content: string
	matchedKeyword: string | null
	matchedContent: string | null
}

/**
 * Serialized auto-mod action execution for API responses
 */
export interface SerializedMockAutoModActionExecution {
	guild_id: string
	action: {
		type: AutoModerationActionType
		metadata?: {
			channel_id?: string
			duration_seconds?: number
			custom_message?: string
		}
	}
	rule_id: string
	rule_trigger_type: AutoModerationTriggerType
	user_id: string
	channel_id?: string
	message_id?: string
	alert_system_message_id?: string
	content: string
	matched_keyword: string | null
	matched_content: string | null
}

/**
 * Options for dispatching auto-mod rule create
 */
export interface DispatchAutoModRuleCreateOptions {
	guildId: Snowflake
	rule: MockAutoModRuleConfig
}

/**
 * Options for dispatching auto-mod rule update
 */
export interface DispatchAutoModRuleUpdateOptions {
	guildId: Snowflake
	ruleId: Snowflake
	updates: MockAutoModRuleUpdateConfig
}

/**
 * Options for dispatching auto-mod rule delete
 */
export interface DispatchAutoModRuleDeleteOptions {
	guildId: Snowflake
	ruleId: Snowflake
}

/**
 * Options for dispatching auto-mod action execution
 */
export interface DispatchAutoModActionExecutionOptions {
	guildId: Snowflake
	action: MockAutoModAction
	ruleId: Snowflake
	ruleTriggerType: AutoModerationTriggerType
	userId: Snowflake
	channelId?: Snowflake
	messageId?: Snowflake
	content: string
	matchedKeyword?: string
	matchedContent?: string
}

// ============================================================================
// Phase 5A: Stage WebSocket Protocol Types
// ============================================================================
export * from './stage.js'
