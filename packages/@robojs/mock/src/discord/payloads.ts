import { GatewayOpcodes, ChannelType, GuildDefaultMessageNotifications, GuildExplicitContentFilter, GuildMFALevel, GuildNSFWLevel, GuildPremiumTier, GuildVerificationLevel, MessageType } from 'discord-api-types/v10'
import type { APIUser, APIUnavailableGuild, APIChannel, APIDMChannel, APIRole, APIGuildMember, Snowflake, APIMessage } from 'discord-api-types/v10'
import { DEFAULT_HEARTBEAT_INTERVAL, GATEWAY_VERSION } from './opcodes.js'
import type { MockUser, MockGuild, MockChannel, MockMessage, SessionState } from '../types/index.js'

/**
 * Gateway payload structure
 */
export interface GatewayPayload {
	op: number
	d: unknown
	s?: number | null
	t?: string | null
}

/**
 * HELLO payload data
 */
export interface HelloPayloadData {
	heartbeat_interval: number
}

/**
 * IDENTIFY payload data (op 2)
 * Sent by client to authenticate with the Gateway
 */
export interface IdentifyPayloadData {
	token: string
	intents: number
	properties: {
		os: string
		browser: string
		device: string
	}
	compress?: boolean
	large_threshold?: number
	shard?: [number, number]
	presence?: unknown
}

/**
 * Validate that data is a valid IDENTIFY payload
 */
export function isValidIdentifyPayload(data: unknown): data is IdentifyPayloadData {
	if (!data || typeof data !== 'object') {
		return false
	}

	const d = data as Record<string, unknown>

	// Required: token (string)
	if (typeof d.token !== 'string' || d.token.length === 0) {
		return false
	}

	// Required: intents (number)
	if (typeof d.intents !== 'number') {
		return false
	}

	// Required: properties (object with os, browser, device)
	if (!d.properties || typeof d.properties !== 'object') {
		return false
	}

	const props = d.properties as Record<string, unknown>
	if (typeof props.os !== 'string' || typeof props.browser !== 'string' || typeof props.device !== 'string') {
		return false
	}

	return true
}

/**
 * Build a HELLO payload (op 10)
 * Sent by server immediately after WebSocket connection established
 */
export function buildHelloPayload(heartbeatInterval: number = DEFAULT_HEARTBEAT_INTERVAL): GatewayPayload {
	return {
		op: GatewayOpcodes.Hello,
		d: {
			heartbeat_interval: heartbeatInterval
		}
	}
}

/**
 * Build a HEARTBEAT_ACK payload (op 11)
 * Sent by server in response to client HEARTBEAT
 */
export function buildHeartbeatAckPayload(): GatewayPayload {
	return {
		op: GatewayOpcodes.HeartbeatAck,
		d: null
	}
}

// ============================================================================
// Type Conversions
// ============================================================================

/**
 * Convert MockUser to Discord APIUser format
 */
export function mockUserToAPIUser(user: MockUser): APIUser {
	return {
		id: user.id,
		username: user.username,
		discriminator: user.discriminator,
		global_name: user.globalName,
		avatar: user.avatar,
		bot: user.bot || undefined
	}
}

/**
 * Convert guild ID to APIUnavailableGuild format
 * Guilds are sent as unavailable in READY, then become available via GUILD_CREATE
 */
export function mockGuildToUnavailable(guildId: Snowflake): APIUnavailableGuild {
	return {
		id: guildId,
		unavailable: true
	}
}

// ============================================================================
// READY Payload (Phase 1D)
// ============================================================================

/**
 * Options for building a READY payload
 */
export interface ReadyPayloadOptions {
	sessionState: SessionState
	connectionSessionId: string
	gatewayUrl?: string
}

/**
 * READY payload data structure
 */
export interface ReadyPayloadData {
	v: number
	user: APIUser
	guilds: APIUnavailableGuild[]
	session_id: string
	resume_gateway_url: string
	application: {
		id: Snowflake
		flags: number
	}
}

/**
 * Build a READY payload (op 0, t: "READY")
 * Sent by server after successful IDENTIFY
 */
export function buildReadyPayload(options: ReadyPayloadOptions): GatewayPayload {
	const { sessionState, connectionSessionId, gatewayUrl = 'ws://localhost:8765' } = options

	// Convert bot user to API format
	const user = mockUserToAPIUser(sessionState.botUser)

	// Convert all guilds to unavailable format
	const guilds: APIUnavailableGuild[] = Array.from(sessionState.guilds.keys()).map(mockGuildToUnavailable)

	const data: ReadyPayloadData = {
		v: parseInt(GATEWAY_VERSION, 10),
		user,
		guilds,
		session_id: connectionSessionId,
		resume_gateway_url: gatewayUrl,
		application: {
			id: sessionState.applicationId,
			flags: 0
		}
	}

	return {
		op: GatewayOpcodes.Dispatch,
		s: 1,
		t: 'READY',
		d: data
	}
}

// ============================================================================
// GUILD_CREATE Payload (Phase 1E)
// ============================================================================

/**
 * Options for building a GUILD_CREATE payload
 */
export interface GuildCreatePayloadOptions {
	guild: MockGuild
	sessionState: SessionState
	sequence: number
}

/**
 * Convert MockChannel to Discord APIChannel format
 */
export function mockChannelToAPIChannel(channel: MockChannel): APIChannel {
	return {
		id: channel.id,
		type: channel.type as ChannelType,
		guild_id: channel.guildId,
		name: channel.name,
		position: 0,
		permission_overwrites: [],
		nsfw: false,
		topic: null,
		last_message_id: null,
		rate_limit_per_user: 0,
		parent_id: channel.parentId ?? null
	} as APIChannel
}

/**
 * Convert MockChannel (DM type) to Discord APIDMChannel format
 */
export function mockDMChannelToAPIDMChannel(channel: MockChannel, recipient: MockUser): APIDMChannel {
	return {
		id: channel.id,
		type: ChannelType.DM,
		recipients: [mockUserToAPIUser(recipient)],
		last_message_id: null
	}
}

/**
 * Build the @everyone role for a guild
 */
export function buildEveryoneRole(guildId: Snowflake): APIRole {
	return {
		id: guildId, // @everyone role has same ID as guild
		name: '@everyone',
		color: 0,
		hoist: false,
		position: 0,
		permissions: '1071698660929', // Default permissions
		managed: false,
		mentionable: false,
		flags: 0 as APIRole['flags']
	}
}

/**
 * Build a guild member object for a user
 */
export function buildGuildMember(user: MockUser, joinedAt: string): APIGuildMember {
	return {
		user: mockUserToAPIUser(user),
		roles: [],
		joined_at: joinedAt,
		deaf: false,
		mute: false,
		flags: 0 as APIGuildMember['flags']
	}
}

/**
 * Build a GUILD_CREATE payload (op 0, t: "GUILD_CREATE")
 * Sent by server after READY to make guilds "available"
 */
export function buildGuildCreatePayload(options: GuildCreatePayloadOptions): GatewayPayload {
	const { guild, sessionState, sequence } = options
	const joinedAt = new Date().toISOString()

	// Get channels for this guild
	const channels: APIChannel[] = guild.channels
		.map((channelId) => sessionState.channels.get(channelId))
		.filter((channel): channel is MockChannel => channel !== undefined)
		.map(mockChannelToAPIChannel)

	// Build roles (at minimum @everyone)
	const roles: APIRole[] = [buildEveryoneRole(guild.id)]

	// Build members (at minimum the bot user)
	const members: APIGuildMember[] = [buildGuildMember(sessionState.botUser, joinedAt)]

	// Add any additional members from the guild
	for (const memberId of guild.members) {
		if (memberId === sessionState.botUser.id) continue // Already added
		const user = sessionState.users.get(memberId)
		if (user) {
			members.push(buildGuildMember(user, joinedAt))
		}
	}

	const data = {
		// Core guild fields
		id: guild.id,
		name: guild.name,
		icon: null,
		icon_hash: null,
		splash: null,
		discovery_splash: null,
		owner_id: guild.ownerId,
		afk_channel_id: null,
		afk_timeout: 300,
		widget_enabled: false,
		widget_channel_id: null,
		verification_level: GuildVerificationLevel.None,
		default_message_notifications: GuildDefaultMessageNotifications.AllMessages,
		explicit_content_filter: GuildExplicitContentFilter.Disabled,
		roles,
		emojis: [],
		features: [],
		mfa_level: GuildMFALevel.None,
		application_id: null,
		system_channel_id: null,
		system_channel_flags: 0,
		rules_channel_id: null,
		max_presences: null,
		max_members: 250000,
		vanity_url_code: null,
		description: null,
		banner: null,
		premium_tier: GuildPremiumTier.None,
		premium_subscription_count: 0,
		preferred_locale: 'en-US',
		public_updates_channel_id: null,
		max_video_channel_users: 25,
		max_stage_video_channel_users: 50,
		nsfw_level: GuildNSFWLevel.Default,
		stickers: [],
		premium_progress_bar_enabled: false,
		safety_alerts_channel_id: null,

		// GUILD_CREATE specific fields
		joined_at: joinedAt,
		large: false,
		unavailable: false,
		member_count: members.length,
		voice_states: [],
		members,
		channels,
		threads: [],
		presences: [],
		stage_instances: [],
		guild_scheduled_events: []
	}

	return {
		op: GatewayOpcodes.Dispatch,
		s: sequence,
		t: 'GUILD_CREATE',
		d: data
	}
}

// ============================================================================
// MESSAGE_CREATE Payload (Phase 2C)
// ============================================================================

/**
 * Options for building a MESSAGE_CREATE payload
 */
export interface MessageCreatePayloadOptions {
	message: MockMessage
	author: MockUser
	sessionState: SessionState
	sequence: number
}

/**
 * Build a partial guild member object (without user field) for MESSAGE_CREATE
 * Discord sends partial member data with messages in guilds
 */
export function buildPartialGuildMember(user: MockUser, joinedAt?: string): Omit<APIGuildMember, 'user'> {
	return {
		roles: [],
		joined_at: joinedAt ?? new Date().toISOString(),
		deaf: false,
		mute: false,
		flags: 0 as APIGuildMember['flags']
	}
}

/**
 * Convert MockMessage to Discord APIMessage format
 */
export function mockMessageToAPIMessage(message: MockMessage, author: MockUser): APIMessage {
	return {
		id: message.id,
		channel_id: message.channelId,
		author: mockUserToAPIUser(author),
		content: message.content,
		timestamp: message.timestamp,
		edited_timestamp: message.editedTimestamp,
		tts: message.tts,
		mention_everyone: message.mentionEveryone,
		mentions: [], // Will be populated with user objects if there are mentions
		mention_roles: message.mentionRoles,
		attachments: message.attachments as APIMessage['attachments'],
		embeds: message.embeds as APIMessage['embeds'],
		pinned: message.pinned,
		type: message.type as MessageType
	}
}

/**
 * Build a MESSAGE_CREATE payload (op 0, t: "MESSAGE_CREATE")
 * Sent by server when a message is created (either injected or from REST API)
 */
export function buildMessageCreatePayload(options: MessageCreatePayloadOptions): GatewayPayload {
	const { message, author, sessionState, sequence } = options

	// Build base message
	const apiMessage = mockMessageToAPIMessage(message, author)

	// Build the dispatch data
	const data: APIMessage & {
		guild_id?: Snowflake
		member?: Omit<APIGuildMember, 'user'>
	} = {
		...apiMessage
	}

	// Add guild-specific fields if this is a guild message
	if (message.guildId) {
		data.guild_id = message.guildId

		// Add partial member data for the author
		data.member = buildPartialGuildMember(author)
	}

	// Build mentions array with member info if there are mentioned users
	if (message.mentions.length > 0) {
		const mentionsWithMembers: (APIUser & { member?: Omit<APIGuildMember, 'user'> })[] = []

		for (const userId of message.mentions) {
			const user = sessionState.users.get(userId)
			if (user) {
				const mentionData: APIUser & { member?: Omit<APIGuildMember, 'user'> } = mockUserToAPIUser(user)
				// Add member info for guild messages
				if (message.guildId) {
					mentionData.member = buildPartialGuildMember(user)
				}
				mentionsWithMembers.push(mentionData)
			}
		}

		data.mentions = mentionsWithMembers as APIMessage['mentions']
	}

	return {
		op: GatewayOpcodes.Dispatch,
		s: sequence,
		t: 'MESSAGE_CREATE',
		d: data
	}
}

// ============================================================================
// MESSAGE_UPDATE Payload (Phase 2F)
// ============================================================================

/**
 * Options for building a MESSAGE_UPDATE payload
 */
export interface MessageUpdatePayloadOptions {
	message: MockMessage
	author: MockUser
	sessionState: SessionState
	sequence: number
}

/**
 * Build a MESSAGE_UPDATE payload (op 0, t: "MESSAGE_UPDATE")
 * Sent when a message is edited
 */
export function buildMessageUpdatePayload(options: MessageUpdatePayloadOptions): GatewayPayload {
	const { message, author, sequence } = options

	// Build base message (same as MESSAGE_CREATE)
	const apiMessage = mockMessageToAPIMessage(message, author)

	const data: APIMessage & {
		guild_id?: Snowflake
		member?: Omit<APIGuildMember, 'user'>
	} = { ...apiMessage }

	// Add guild-specific fields if this is a guild message
	if (message.guildId) {
		data.guild_id = message.guildId
		data.member = buildPartialGuildMember(author)
	}

	return {
		op: GatewayOpcodes.Dispatch,
		s: sequence,
		t: 'MESSAGE_UPDATE',
		d: data
	}
}

// ============================================================================
// MESSAGE_DELETE Payload (Phase 2F)
// ============================================================================

/**
 * Options for building a MESSAGE_DELETE payload
 */
export interface MessageDeletePayloadOptions {
	messageId: Snowflake
	channelId: Snowflake
	guildId?: Snowflake
	sequence: number
}

/**
 * Build a MESSAGE_DELETE payload (op 0, t: "MESSAGE_DELETE")
 * Sent when a message is deleted
 */
export function buildMessageDeletePayload(options: MessageDeletePayloadOptions): GatewayPayload {
	const { messageId, channelId, guildId, sequence } = options

	const data: { id: Snowflake; channel_id: Snowflake; guild_id?: Snowflake } = {
		id: messageId,
		channel_id: channelId
	}

	if (guildId) {
		data.guild_id = guildId
	}

	return {
		op: GatewayOpcodes.Dispatch,
		s: sequence,
		t: 'MESSAGE_DELETE',
		d: data
	}
}
