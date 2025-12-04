import { GatewayOpcodes, ChannelType, GuildDefaultMessageNotifications, GuildExplicitContentFilter, GuildMFALevel, GuildNSFWLevel, GuildPremiumTier, GuildVerificationLevel } from 'discord-api-types/v10'
import type { APIUser, APIUnavailableGuild, APIChannel, APIRole, APIGuildMember, Snowflake } from 'discord-api-types/v10'
import { DEFAULT_HEARTBEAT_INTERVAL, GATEWAY_VERSION } from './opcodes.js'
import type { MockUser, MockGuild, MockChannel, SessionState } from '../types/index.js'

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
