import { GatewayOpcodes, ChannelType, GuildDefaultMessageNotifications, GuildExplicitContentFilter, GuildMFALevel, GuildNSFWLevel, GuildPremiumTier, GuildVerificationLevel, MessageType, InteractionType, ApplicationCommandType, ComponentType } from 'discord-api-types/v10'
import type { APIUser, APIUnavailableGuild, APIChannel, APIDMChannel, APIRole, APIGuildMember, Snowflake, APIMessage, APIEmbed, APIAttachment, APIMessageInteractionMetadata, APIMessageSnapshot } from 'discord-api-types/v10'
import { DEFAULT_HEARTBEAT_INTERVAL, GATEWAY_VERSION } from './opcodes.js'
import type { MockUser, MockGuild, MockChannel, MockMessage, MockInteraction, SessionState, MockMessageSnapshot, MockThread, MockThreadMember } from '../types/index.js'
import { generateSnowflake } from '../utils/snowflake.js'

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

	// Get channels for this guild (excluding threads)
	const channels: APIChannel[] = guild.channels
		.map((channelId) => sessionState.channels.get(channelId))
		.filter((channel): channel is MockChannel => channel !== undefined)
		.filter((channel) => channel.type !== 10 && channel.type !== 11 && channel.type !== 12) // Exclude threads
		.map(mockChannelToAPIChannel)

	// Get active threads for this guild
	const threads: APIChannel[] = guild.channels
		.map((channelId) => sessionState.channels.get(channelId))
		.filter((channel): channel is MockThread => {
			return channel !== undefined && (channel.type === 10 || channel.type === 11 || channel.type === 12)
		})
		.filter((thread) => !thread.threadMetadata?.archived) // Only active threads
		.map(mockThreadToAPIChannel)

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
		threads,
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
	const apiMessage: APIMessage = {
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

	// Phase 3I: Add optional fields if present

	// Call info for voice/video calls in DMs (MessageType.Call = 3)
	if (message.call) {
		apiMessage.call = {
			participants: message.call.participants,
			ended_timestamp: message.call.ended_timestamp ?? null
		}
	}

	// Interaction metadata (new field that replaces deprecated interaction)
	if (message.interaction_metadata) {
		const metadata: APIMessageInteractionMetadata = {
			id: message.interaction_metadata.id,
			type: message.interaction_metadata.type as InteractionType,
			user: mockUserToAPIUser(message.interaction_metadata.user),
			authorizing_integration_owners: message.interaction_metadata.authorizing_integration_owners ?? {}
		}

		// Add optional fields
		if (message.interaction_metadata.original_response_message_id) {
			metadata.original_response_message_id = message.interaction_metadata.original_response_message_id
		}
		if (message.interaction_metadata.target_user) {
			metadata.target_user = mockUserToAPIUser(message.interaction_metadata.target_user)
		}
		if (message.interaction_metadata.target_message_id) {
			metadata.target_message_id = message.interaction_metadata.target_message_id
		}

		apiMessage.interaction_metadata = metadata
	}

	// Keep deprecated interaction field for backwards compatibility
	if (message.interaction) {
		apiMessage.interaction = {
			id: message.interaction.id,
			type: message.interaction.type as InteractionType,
			name: message.interaction.name,
			user: mockUserToAPIUser(message.interaction.user)
		}
	}

	// Message snapshots for forwarded messages
	if (message.message_snapshots?.length) {
		apiMessage.message_snapshots = message.message_snapshots.map((snapshot: MockMessageSnapshot): APIMessageSnapshot => ({
			message: {
				type: snapshot.message.type as MessageType,
				content: snapshot.message.content,
				embeds: snapshot.message.embeds as APIEmbed[],
				attachments: snapshot.message.attachments as APIAttachment[],
				timestamp: snapshot.message.timestamp,
				edited_timestamp: snapshot.message.edited_timestamp,
				mentions: snapshot.message.mentions.map((u) => mockUserToAPIUser(u)),
				mention_roles: snapshot.message.mention_roles
			}
		}))
	}

	// Resolved data for auto-populated select menus
	if (message.resolved) {
		apiMessage.resolved = message.resolved as APIMessage['resolved']
	}

	return apiMessage
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

// ============================================================================
// INTERACTION_CREATE Payload (Phase 3A)
// ============================================================================

/**
 * Options for building an INTERACTION_CREATE payload
 */
export interface InteractionCreatePayloadOptions {
	interaction: MockInteraction
	user: MockUser
	sessionState: SessionState
	sequence: number
}

/**
 * Build an INTERACTION_CREATE payload (op 0, t: "INTERACTION_CREATE")
 * For slash commands (type 2 APPLICATION_COMMAND)
 */
export function buildInteractionCreatePayload(options: InteractionCreatePayloadOptions): GatewayPayload {
	const { interaction, user, sessionState, sequence } = options

	// Build command data
	const commandData: Record<string, unknown> = {
		id: interaction.commandId ?? generateSnowflake(),
		name: interaction.commandName,
		type: ApplicationCommandType.ChatInput // Slash command
	}

	// Add options if present
	if (interaction.options && interaction.options.length > 0) {
		commandData.options = interaction.options.map((opt) => ({
			name: opt.name,
			type: opt.type,
			value: opt.value,
			options: opt.options,
			focused: opt.focused
		}))
	}

	const data: Record<string, unknown> = {
		id: interaction.id,
		application_id: interaction.applicationId,
		type: InteractionType.ApplicationCommand,
		data: commandData,
		channel_id: interaction.channelId,
		token: interaction.token,
		version: 1,
		entitlements: [],
		authorizing_integration_owners: {},
		locale: 'en-US',
		app_permissions: '562949953421311' // Full permissions
	}

	// Guild context
	if (interaction.guildId) {
		data.guild_id = interaction.guildId
		data.guild_locale = 'en-US'
		data.member = {
			user: mockUserToAPIUser(user),
			roles: [],
			joined_at: new Date().toISOString(),
			deaf: false,
			mute: false,
			flags: 0
		}
	} else {
		// DM context
		data.user = mockUserToAPIUser(user)
	}

	return {
		op: GatewayOpcodes.Dispatch,
		s: sequence,
		t: 'INTERACTION_CREATE',
		d: data
	}
}

// INTERACTION_CREATE Payload - Button (Phase 3C)
// ============================================================================

/**
 * Options for building a button INTERACTION_CREATE payload
 */
export interface ButtonInteractionPayloadOptions {
	interaction: MockInteraction
	user: MockUser
	message: MockMessage // The message containing the button
	sessionState: SessionState
	sequence: number
}

/**
 * Build an INTERACTION_CREATE payload for button clicks (op 0, t: "INTERACTION_CREATE")
 * For button interactions (type 3 MESSAGE_COMPONENT, component_type 2)
 */
export function buildButtonInteractionPayload(options: ButtonInteractionPayloadOptions): GatewayPayload {
	const { interaction, user, message, sessionState, sequence } = options

	// Build component data
	const componentData: Record<string, unknown> = {
		component_type: ComponentType.Button, // 2
		custom_id: interaction.customId
	}

	// Get the message author for the API message
	const messageAuthor = sessionState.users.get(message.authorId)

	const data: Record<string, unknown> = {
		id: interaction.id,
		application_id: interaction.applicationId,
		type: InteractionType.MessageComponent, // 3
		data: componentData,
		channel_id: interaction.channelId,
		token: interaction.token,
		version: 1,
		entitlements: [],
		authorizing_integration_owners: {},
		locale: 'en-US',
		app_permissions: '562949953421311', // Full permissions
		// Include the source message
		message: messageAuthor ? mockMessageToAPIMessage(message, messageAuthor) : mockMessageToAPIMessage(message, sessionState.botUser)
	}

	// Add guild_id to message if present
	if (message.guildId) {
		;(data.message as Record<string, unknown>).guild_id = message.guildId
	}

	// Guild context
	if (interaction.guildId) {
		data.guild_id = interaction.guildId
		data.guild_locale = 'en-US'
		data.member = {
			user: mockUserToAPIUser(user),
			roles: [],
			joined_at: new Date().toISOString(),
			deaf: false,
			mute: false,
			flags: 0
		}
	} else {
		// DM context
		data.user = mockUserToAPIUser(user)
	}

	return {
		op: GatewayOpcodes.Dispatch,
		s: sequence,
		t: 'INTERACTION_CREATE',
		d: data
	}
}

// INTERACTION_CREATE Payload - Select Menu (Phase 3D)
// ============================================================================

/**
 * Options for building a select menu INTERACTION_CREATE payload
 */
export interface SelectMenuInteractionPayloadOptions {
	interaction: MockInteraction
	user: MockUser
	message: MockMessage // The message containing the select menu
	values: string[] // Selected values
	sessionState: SessionState
	sequence: number
}

/**
 * Build an INTERACTION_CREATE payload for select menu interactions (op 0, t: "INTERACTION_CREATE")
 * For MESSAGE_COMPONENT (type 3) with component_type 3 (StringSelect), 5 (UserSelect),
 * 6 (RoleSelect), 7 (MentionableSelect), or 8 (ChannelSelect)
 */
export function buildSelectMenuInteractionPayload(options: SelectMenuInteractionPayloadOptions): GatewayPayload {
	const { interaction, user, message, values, sessionState, sequence } = options

	// Default to StringSelect (3) if componentType not specified
	const componentType = interaction.componentType ?? ComponentType.StringSelect

	// Build component data with values
	const componentData: Record<string, unknown> = {
		component_type: componentType,
		custom_id: interaction.customId,
		values: values
	}

	// Build resolved data for entity select types (UserSelect, RoleSelect, MentionableSelect, ChannelSelect)
	const resolved = buildResolvedData(componentType, values, sessionState, interaction.guildId)
	if (resolved && Object.keys(resolved).length > 0) {
		componentData.resolved = resolved
	}

	// Get the message author for the API message
	const messageAuthor = sessionState.users.get(message.authorId)

	const data: Record<string, unknown> = {
		id: interaction.id,
		application_id: interaction.applicationId,
		type: InteractionType.MessageComponent, // 3
		data: componentData,
		channel_id: interaction.channelId,
		token: interaction.token,
		version: 1,
		entitlements: [],
		authorizing_integration_owners: {},
		locale: 'en-US',
		app_permissions: '562949953421311', // Full permissions
		// Include the source message for select menu
		message: messageAuthor ? mockMessageToAPIMessage(message, messageAuthor) : mockMessageToAPIMessage(message, sessionState.botUser)
	}

	// Add guild_id to message if present
	if (message.guildId) {
		;(data.message as Record<string, unknown>).guild_id = message.guildId
	}

	// Guild context
	if (interaction.guildId) {
		data.guild_id = interaction.guildId
		data.guild_locale = 'en-US'
		data.member = {
			user: mockUserToAPIUser(user),
			roles: [],
			joined_at: new Date().toISOString(),
			deaf: false,
			mute: false,
			flags: 0
		}
	} else {
		// DM context
		data.user = mockUserToAPIUser(user)
	}

	return {
		op: GatewayOpcodes.Dispatch,
		s: sequence,
		t: 'INTERACTION_CREATE',
		d: data
	}
}

// INTERACTION_CREATE Payload - Modal Submit (Phase 3E)
// ============================================================================

/**
 * Options for building a modal submit INTERACTION_CREATE payload
 */
export interface ModalSubmitInteractionPayloadOptions {
	interaction: MockInteraction
	user: MockUser
	sessionState: SessionState
	sequence: number
	message?: MockMessage // Optional: source message if modal was triggered from a message component
}

/**
 * Convert fields object to Discord modal components array format
 * Each field becomes an action row with a single text input
 */
function fieldsToComponents(fields: Record<string, string>): unknown[] {
	return Object.entries(fields).map(([customId, value]) => ({
		type: 1, // ActionRow
		components: [
			{
				type: 4, // TextInput
				custom_id: customId,
				value: value
			}
		]
	}))
}

/**
 * Build an INTERACTION_CREATE payload for modal submit interactions (op 0, t: "INTERACTION_CREATE")
 * For MODAL_SUBMIT (type 5)
 */
export function buildModalSubmitInteractionPayload(options: ModalSubmitInteractionPayloadOptions): GatewayPayload {
	const { interaction, user, sessionState, sequence, message } = options

	// Build modal data with components
	const modalData: Record<string, unknown> = {
		custom_id: interaction.customId,
		components: fieldsToComponents(interaction.modalFields ?? {})
	}

	const data: Record<string, unknown> = {
		id: interaction.id,
		application_id: interaction.applicationId,
		type: InteractionType.ModalSubmit, // 5
		data: modalData,
		channel_id: interaction.channelId,
		token: interaction.token,
		version: 1,
		entitlements: [],
		authorizing_integration_owners: {},
		locale: 'en-US',
		app_permissions: '562949953421311' // Full permissions
	}

	// Add message if modal was triggered from a message component (links to original interaction)
	if (message) {
		const messageAuthor = sessionState.users.get(message.authorId)
		data.message = messageAuthor ? mockMessageToAPIMessage(message, messageAuthor) : mockMessageToAPIMessage(message, sessionState.botUser)

		// Add guild_id to message if present
		if (message.guildId) {
			;(data.message as Record<string, unknown>).guild_id = message.guildId
		}
	}

	// Guild context
	if (interaction.guildId) {
		data.guild_id = interaction.guildId
		data.guild_locale = 'en-US'
		data.member = {
			user: mockUserToAPIUser(user),
			roles: [],
			joined_at: new Date().toISOString(),
			deaf: false,
			mute: false,
			flags: 0
		}
	} else {
		// DM context
		data.user = mockUserToAPIUser(user)
	}

	return {
		op: GatewayOpcodes.Dispatch,
		s: sequence,
		t: 'INTERACTION_CREATE',
		d: data
	}
}

// INTERACTION_CREATE Payload - Autocomplete (Phase 3F)
// ============================================================================

/**
 * Options for building an autocomplete INTERACTION_CREATE payload
 */
export interface AutocompleteInteractionPayloadOptions {
	interaction: MockInteraction
	user: MockUser
	sessionState: SessionState
	sequence: number
}

/**
 * Build an INTERACTION_CREATE payload for autocomplete interactions (op 0, t: "INTERACTION_CREATE")
 * For APPLICATION_COMMAND_AUTOCOMPLETE (type 4)
 */
export function buildAutocompleteInteractionPayload(options: AutocompleteInteractionPayloadOptions): GatewayPayload {
	const { interaction, user, sequence } = options

	// Build command data - similar to slash command but type 4
	const commandData: Record<string, unknown> = {
		id: interaction.commandId ?? generateSnowflake(),
		name: interaction.commandName,
		type: ApplicationCommandType.ChatInput
	}

	// Add options - MUST include focused flag for autocomplete
	if (interaction.options && interaction.options.length > 0) {
		commandData.options = interaction.options.map((opt) => ({
			name: opt.name,
			type: opt.type,
			value: opt.value,
			focused: opt.focused // Critical for autocomplete
		}))
	}

	const data: Record<string, unknown> = {
		id: interaction.id,
		application_id: interaction.applicationId,
		type: InteractionType.ApplicationCommandAutocomplete, // 4
		data: commandData,
		channel_id: interaction.channelId,
		token: interaction.token,
		version: 1,
		entitlements: [],
		authorizing_integration_owners: {},
		locale: 'en-US',
		app_permissions: '562949953421311' // Full permissions
	}

	// Guild context
	if (interaction.guildId) {
		data.guild_id = interaction.guildId
		data.guild_locale = 'en-US'
		data.member = {
			user: mockUserToAPIUser(user),
			roles: [],
			joined_at: new Date().toISOString(),
			deaf: false,
			mute: false,
			flags: 0
		}
	} else {
		// DM context
		data.user = mockUserToAPIUser(user)
	}

	return {
		op: GatewayOpcodes.Dispatch,
		s: sequence,
		t: 'INTERACTION_CREATE',
		d: data
	}
}

// INTERACTION_CREATE Payload - Context Menu (Phase 3G)
// ============================================================================

/**
 * Options for building a context menu INTERACTION_CREATE payload
 */
export interface ContextMenuInteractionPayloadOptions {
	interaction: MockInteraction
	user: MockUser
	/** Target user for USER commands */
	targetUser?: MockUser
	/** Target message for MESSAGE commands */
	targetMessage?: MockMessage
	sessionState: SessionState
	sequence: number
}

/**
 * Build an INTERACTION_CREATE payload for context menu commands (op 0, t: "INTERACTION_CREATE")
 * For USER (type 2) and MESSAGE (type 3) application commands
 */
export function buildContextMenuInteractionPayload(options: ContextMenuInteractionPayloadOptions): GatewayPayload {
	const { interaction, user, targetUser, targetMessage, sessionState, sequence } = options

	// Determine command type (2=USER, 3=MESSAGE)
	const commandType = interaction.contextMenuType ?? 2

	// Build command data with target_id and resolved
	const commandData: Record<string, unknown> = {
		id: interaction.commandId ?? generateSnowflake(),
		name: interaction.commandName,
		type: commandType, // ApplicationCommandType.User (2) or Message (3)
		target_id: interaction.targetId
	}

	// Build resolved data based on command type
	const resolved: Record<string, Record<string, unknown>> = {}

	if (commandType === 2 && targetUser) {
		// USER command - resolve the target user
		resolved.users = {
			[interaction.targetId!]: mockUserToAPIUser(targetUser)
		}
		// Add member data if in guild context
		if (interaction.guildId) {
			resolved.members = {
				[interaction.targetId!]: {
					roles: [],
					joined_at: new Date().toISOString(),
					deaf: false,
					mute: false,
					flags: 0
				}
			}
		}
	} else if (commandType === 3 && targetMessage) {
		// MESSAGE command - resolve the target message
		const messageAuthor = sessionState.users.get(targetMessage.authorId) ?? sessionState.botUser
		resolved.messages = {
			[interaction.targetId!]: mockMessageToAPIMessage(targetMessage, messageAuthor)
		}
	}

	if (Object.keys(resolved).length > 0) {
		commandData.resolved = resolved
	}

	// Build main interaction data
	const data: Record<string, unknown> = {
		id: interaction.id,
		application_id: interaction.applicationId,
		type: InteractionType.ApplicationCommand, // Always 2 for context menus
		data: commandData,
		channel_id: interaction.channelId,
		token: interaction.token,
		version: 1,
		entitlements: [],
		authorizing_integration_owners: {},
		locale: 'en-US',
		app_permissions: '562949953421311' // Full permissions
	}

	// Guild context
	if (interaction.guildId) {
		data.guild_id = interaction.guildId
		data.guild_locale = 'en-US'
		data.member = {
			user: mockUserToAPIUser(user),
			roles: [],
			joined_at: new Date().toISOString(),
			deaf: false,
			mute: false,
			flags: 0
		}
	} else {
		// DM context
		data.user = mockUserToAPIUser(user)
	}

	return {
		op: GatewayOpcodes.Dispatch,
		s: sequence,
		t: 'INTERACTION_CREATE',
		d: data
	}
}

// ============================================================================
// Thread Payload Builders (Phase 4D)
// ============================================================================

/**
 * Convert MockThread to Discord API thread channel format
 */
export function mockThreadToAPIChannel(thread: MockThread): APIChannel {
	return {
		id: thread.id,
		type: thread.type as ChannelType,
		guild_id: thread.guildId,
		name: thread.name,
		parent_id: thread.parentId,
		owner_id: thread.ownerId,
		message_count: thread.messageCount,
		member_count: thread.memberCount,
		total_message_sent: thread.totalMessageSent,
		last_message_id: thread.lastMessageId ?? null,
		thread_metadata: {
			archived: thread.threadMetadata.archived,
			auto_archive_duration: thread.threadMetadata.auto_archive_duration,
			archive_timestamp: thread.threadMetadata.archive_timestamp,
			locked: thread.threadMetadata.locked,
			invitable: thread.threadMetadata.invitable,
			create_timestamp: thread.threadMetadata.create_timestamp
		},
		rate_limit_per_user: 0,
		position: 0,
		permission_overwrites: [],
		nsfw: false
	} as APIChannel
}

/**
 * Options for building a THREAD_CREATE payload
 */
export interface ThreadCreatePayloadOptions {
	thread: MockThread
	sessionState: SessionState
	sequence: number
	newlyCreated?: boolean // True when thread is newly created, false when bot joins existing thread
}

/**
 * Build a THREAD_CREATE payload (op 0, t: "THREAD_CREATE")
 * Sent when a new thread is created or when the bot is added to an existing thread
 */
export function buildThreadCreatePayload(options: ThreadCreatePayloadOptions): GatewayPayload {
	const { thread, sequence, newlyCreated = true } = options

	const data = {
		...mockThreadToAPIChannel(thread),
		newly_created: newlyCreated
	}

	return {
		op: GatewayOpcodes.Dispatch,
		s: sequence,
		t: 'THREAD_CREATE',
		d: data
	}
}

/**
 * Options for building a THREAD_UPDATE payload
 */
export interface ThreadUpdatePayloadOptions {
	thread: MockThread
	sessionState: SessionState
	sequence: number
}

/**
 * Build a THREAD_UPDATE payload (op 0, t: "THREAD_UPDATE")
 * Sent when thread metadata is updated (archived, locked, name, etc.)
 */
export function buildThreadUpdatePayload(options: ThreadUpdatePayloadOptions): GatewayPayload {
	const { thread, sequence } = options

	return {
		op: GatewayOpcodes.Dispatch,
		s: sequence,
		t: 'THREAD_UPDATE',
		d: mockThreadToAPIChannel(thread)
	}
}

/**
 * Options for building a THREAD_DELETE payload
 */
export interface ThreadDeletePayloadOptions {
	threadId: Snowflake
	guildId: Snowflake
	parentId: Snowflake
	type: 10 | 11 | 12
	sequence: number
}

/**
 * Build a THREAD_DELETE payload (op 0, t: "THREAD_DELETE")
 * Sent when a thread is deleted
 */
export function buildThreadDeletePayload(options: ThreadDeletePayloadOptions): GatewayPayload {
	const { threadId, guildId, parentId, type, sequence } = options

	return {
		op: GatewayOpcodes.Dispatch,
		s: sequence,
		t: 'THREAD_DELETE',
		d: {
			id: threadId,
			guild_id: guildId,
			parent_id: parentId,
			type: type
		}
	}
}

/**
 * Options for building a THREAD_LIST_SYNC payload
 */
export interface ThreadListSyncPayloadOptions {
	guildId: Snowflake
	channelIds?: Snowflake[] // If syncing specific channels, otherwise all guild threads
	threads: MockThread[]
	members: MockThreadMember[]
	sequence: number
}

/**
 * Build a THREAD_LIST_SYNC payload (op 0, t: "THREAD_LIST_SYNC")
 * Sent when bot gains access to channels, contains all active threads in those channels
 */
export function buildThreadListSyncPayload(options: ThreadListSyncPayloadOptions): GatewayPayload {
	const { guildId, channelIds, threads, members, sequence } = options

	const data: Record<string, unknown> = {
		guild_id: guildId,
		threads: threads.map(mockThreadToAPIChannel),
		members: members.map((member) => ({
			id: member.id,
			user_id: member.user_id,
			join_timestamp: member.join_timestamp,
			flags: member.flags
		}))
	}

	// Only include channel_ids if syncing specific channels (not entire guild)
	if (channelIds && channelIds.length > 0) {
		data.channel_ids = channelIds
	}

	return {
		op: GatewayOpcodes.Dispatch,
		s: sequence,
		t: 'THREAD_LIST_SYNC',
		d: data
	}
}

/**
 * Options for building a THREAD_MEMBER_UPDATE payload
 */
export interface ThreadMemberUpdatePayloadOptions {
	threadId: Snowflake
	guildId: Snowflake
	member: MockThreadMember
	sequence: number
}

/**
 * Build a THREAD_MEMBER_UPDATE payload (op 0, t: "THREAD_MEMBER_UPDATE")
 * Sent when the current user's thread member object is updated
 */
export function buildThreadMemberUpdatePayload(options: ThreadMemberUpdatePayloadOptions): GatewayPayload {
	const { threadId, guildId, member, sequence } = options

	return {
		op: GatewayOpcodes.Dispatch,
		s: sequence,
		t: 'THREAD_MEMBER_UPDATE',
		d: {
			id: threadId,
			guild_id: guildId,
			user_id: member.user_id,
			join_timestamp: member.join_timestamp,
			flags: member.flags
		}
	}
}

/**
 * Options for building a THREAD_MEMBERS_UPDATE payload
 */
export interface ThreadMembersUpdatePayloadOptions {
	threadId: Snowflake
	guildId: Snowflake
	memberCount: number
	addedMembers?: MockThreadMember[]
	removedMemberIds?: Snowflake[]
	sequence: number
}

/**
 * Build a THREAD_MEMBERS_UPDATE payload (op 0, t: "THREAD_MEMBERS_UPDATE")
 * Sent when members are added/removed from a thread (requires GuildMembers privileged intent)
 */
export function buildThreadMembersUpdatePayload(options: ThreadMembersUpdatePayloadOptions): GatewayPayload {
	const { threadId, guildId, memberCount, addedMembers, removedMemberIds, sequence } = options

	const data: Record<string, unknown> = {
		id: threadId,
		guild_id: guildId,
		member_count: memberCount
	}

	if (addedMembers && addedMembers.length > 0) {
		data.added_members = addedMembers.map((member) => ({
			id: member.id,
			user_id: member.user_id,
			join_timestamp: member.join_timestamp,
			flags: member.flags
		}))
	}

	if (removedMemberIds && removedMemberIds.length > 0) {
		data.removed_member_ids = removedMemberIds
	}

	return {
		op: GatewayOpcodes.Dispatch,
		s: sequence,
		t: 'THREAD_MEMBERS_UPDATE',
		d: data
	}
}
