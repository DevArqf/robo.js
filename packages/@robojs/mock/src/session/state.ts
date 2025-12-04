import { ChannelType, type Snowflake } from 'discord-api-types/v10'
import type {
	SessionState,
	MockGuild,
	MockChannel,
	MockUser,
	MockMessage,
	MockUserConfig,
	MockMessageConfig,
	SerializedSessionState,
	SerializedMockGuild,
	SerializedMockChannel,
	SerializedMockUser,
	SerializedMockMessage
} from '../types/index.js'
import { generateSnowflake } from '../utils/snowflake.js'

// Default limits for memory management
const DEFAULT_MAX_MESSAGES = 1000

/**
 * Options for creating a MockServerState
 */
export interface StateOptions {
	botUser?: MockUserConfig
	applicationId?: Snowflake
	maxMessages?: number
}

/**
 * Centralized state management for a mock session.
 * Provides CRUD methods for all mock entities.
 */
export class MockServerState implements SessionState {
	readonly guilds: Map<Snowflake, MockGuild>
	readonly channels: Map<Snowflake, MockChannel>
	readonly dmChannels: Map<Snowflake, MockChannel>
	readonly users: Map<Snowflake, MockUser>
	readonly messages: Map<Snowflake, MockMessage>
	readonly botUser: MockUser
	readonly applicationId: Snowflake

	private _sequence: number = 0
	private readonly maxMessages: number

	constructor(options?: StateOptions) {
		this.guilds = new Map()
		this.channels = new Map()
		this.dmChannels = new Map()
		this.users = new Map()
		this.messages = new Map()
		this.maxMessages = options?.maxMessages ?? DEFAULT_MAX_MESSAGES

		// Create bot user
		this.botUser = createMockUser({
			bot: true,
			username: 'MockBot',
			...options?.botUser
		})

		// Add bot user to users map
		this.users.set(this.botUser.id, this.botUser)

		// Set application ID (defaults to bot user ID)
		this.applicationId = options?.applicationId ?? this.botUser.id
	}

	// ============================================================================
	// Sequence Management
	// ============================================================================

	get sequence(): number {
		return this._sequence
	}

	set sequence(value: number) {
		this._sequence = value
	}

	/**
	 * Get and increment the sequence number
	 */
	nextSequence(): number {
		return ++this._sequence
	}

	// ============================================================================
	// Guild Operations
	// ============================================================================

	/**
	 * Get a guild by ID
	 */
	getGuild(id: Snowflake): MockGuild | undefined {
		return this.guilds.get(id)
	}

	/**
	 * Add a guild to the state
	 */
	addGuild(guild: MockGuild): void {
		this.guilds.set(guild.id, guild)

		// Add bot user as member if not already
		if (!guild.members.includes(this.botUser.id)) {
			guild.members.push(this.botUser.id)
		}
	}

	/**
	 * Remove a guild from the state
	 */
	removeGuild(id: Snowflake): boolean {
		const guild = this.guilds.get(id)
		if (!guild) {
			return false
		}

		// Remove all channels for this guild
		for (const channelId of guild.channels) {
			this.channels.delete(channelId)
		}

		// Remove messages from this guild's channels
		for (const [messageId, message] of this.messages) {
			if (message.guildId === id) {
				this.messages.delete(messageId)
			}
		}

		return this.guilds.delete(id)
	}

	// ============================================================================
	// Channel Operations
	// ============================================================================

	/**
	 * Get a channel by ID (includes guild channels and DM channels)
	 */
	getChannel(id: Snowflake): MockChannel | undefined {
		return this.channels.get(id) ?? Array.from(this.dmChannels.values()).find((c) => c.id === id)
	}

	/**
	 * Get all channels for a guild
	 */
	getChannelsForGuild(guildId: Snowflake): MockChannel[] {
		return Array.from(this.channels.values()).filter((c) => c.guildId === guildId)
	}

	/**
	 * Add a channel to the state
	 */
	addChannel(channel: MockChannel): void {
		this.channels.set(channel.id, channel)
	}

	/**
	 * Add a channel to a guild
	 */
	addChannelToGuild(guildId: Snowflake, channel: MockChannel): void {
		// Set guild ID on channel
		channel.guildId = guildId

		// Add channel to state
		this.channels.set(channel.id, channel)

		// Add channel ID to guild's channel list
		const guild = this.guilds.get(guildId)
		if (guild && !guild.channels.includes(channel.id)) {
			guild.channels.push(channel.id)
		}
	}

	/**
	 * Remove a channel from the state
	 */
	removeChannel(id: Snowflake): boolean {
		const channel = this.channels.get(id)
		if (channel) {
			// Remove from guild's channel list if applicable
			if (channel.guildId) {
				const guild = this.guilds.get(channel.guildId)
				if (guild) {
					const idx = guild.channels.indexOf(id)
					if (idx !== -1) {
						guild.channels.splice(idx, 1)
					}
				}
			}

			// Remove messages in this channel
			for (const [messageId, message] of this.messages) {
				if (message.channelId === id) {
					this.messages.delete(messageId)
				}
			}

			return this.channels.delete(id)
		}
		return false
	}

	// ============================================================================
	// User Operations
	// ============================================================================

	/**
	 * Get a user by ID
	 */
	getUser(id: Snowflake): MockUser | undefined {
		return this.users.get(id)
	}

	/**
	 * Add a user to the state
	 */
	addUser(user: MockUser): void {
		this.users.set(user.id, user)
	}

	/**
	 * Remove a user from the state (cannot remove bot user)
	 */
	removeUser(id: Snowflake): boolean {
		if (id === this.botUser.id) {
			return false // Cannot remove bot user
		}
		return this.users.delete(id)
	}

	/**
	 * Get or create a default test user for dispatching messages
	 * This creates a consistent "TestUser" that can be used when no author is specified
	 */
	getOrCreateTestUser(userId?: Snowflake): MockUser {
		// Use provided ID or a fixed default ID for the test user
		const testUserId = userId ?? '123456789012345678'

		let user = this.users.get(testUserId)
		if (!user) {
			user = createMockUser({
				id: testUserId,
				username: 'TestUser',
				bot: false
			})
			this.users.set(testUserId, user)
		}
		return user
	}

	// ============================================================================
	// Message Operations
	// ============================================================================

	/**
	 * Get a message by ID
	 */
	getMessage(id: Snowflake): MockMessage | undefined {
		return this.messages.get(id)
	}

	/**
	 * Get messages for a channel, optionally limited
	 */
	getMessagesForChannel(channelId: Snowflake, limit?: number): MockMessage[] {
		const channelMessages = Array.from(this.messages.values())
			.filter((m) => m.channelId === channelId)
			.sort((a, b) => {
				// Sort by timestamp descending (newest first)
				return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
			})

		return limit ? channelMessages.slice(0, limit) : channelMessages
	}

	/**
	 * Create and store a message
	 */
	createMessage(config: MockMessageConfig): MockMessage {
		// Enforce message limit (LRU-style)
		if (this.messages.size >= this.maxMessages) {
			// Remove oldest message
			const oldest = this.messages.keys().next().value
			if (oldest) {
				this.messages.delete(oldest)
			}
		}

		const message = createMockMessage(config)
		this.messages.set(message.id, message)
		return message
	}

	/**
	 * Update a message
	 */
	updateMessage(id: Snowflake, updates: Partial<MockMessage>): MockMessage | undefined {
		const message = this.messages.get(id)
		if (!message) {
			return undefined
		}

		// Apply updates (except id, channelId, authorId which are immutable)
		const updatedMessage: MockMessage = {
			...message,
			...updates,
			id: message.id,
			channelId: message.channelId,
			authorId: message.authorId,
			editedTimestamp: new Date().toISOString()
		}

		this.messages.set(id, updatedMessage)
		return updatedMessage
	}

	/**
	 * Delete a message
	 */
	deleteMessage(id: Snowflake): boolean {
		return this.messages.delete(id)
	}

	// ============================================================================
	// DM Channel Operations
	// ============================================================================

	/**
	 * Get a DM channel by recipient user ID
	 */
	getDMChannel(recipientId: Snowflake): MockChannel | undefined {
		return this.dmChannels.get(recipientId)
	}

	/**
	 * Get or create a DM channel for a recipient
	 */
	getOrCreateDMChannel(recipientId: Snowflake): MockChannel {
		let dmChannel = this.dmChannels.get(recipientId)
		if (!dmChannel) {
			dmChannel = createMockChannel({
				name: `DM-${recipientId}`,
				type: ChannelType.DM
			})
			// Store in both maps:
			// - dmChannels keyed by recipient ID (for idempotency)
			// - channels keyed by channel ID (for O(1) lookup)
			this.dmChannels.set(recipientId, dmChannel)
			this.channels.set(dmChannel.id, dmChannel)
		}
		return dmChannel
	}

	// ============================================================================
	// State Management
	// ============================================================================

	/**
	 * Reset state to initial values (keeps bot user)
	 */
	reset(): void {
		this.guilds.clear()
		this.channels.clear()
		this.dmChannels.clear()
		this.messages.clear()
		this.users.clear()

		// Re-add bot user
		this.users.set(this.botUser.id, this.botUser)

		// Reset sequence
		this._sequence = 0
	}

	/**
	 * Serialize state for API responses
	 */
	serialize(): SerializedSessionState {
		return {
			guilds: Array.from(this.guilds.values()).map(serializeMockGuild),
			channels: Array.from(this.channels.values()).map(serializeMockChannel),
			dmChannels: Array.from(this.dmChannels.values()).map(serializeMockChannel),
			users: Array.from(this.users.values()).map(serializeMockUser),
			messages: Array.from(this.messages.values()).map(serializeMockMessage),
			botUser: serializeMockUser(this.botUser),
			applicationId: this.applicationId,
			sequence: this._sequence
		}
	}
}

// ============================================================================
// Factory Functions (for creating entities)
// ============================================================================

/**
 * Create an empty session state
 */
export function createSessionState(options?: StateOptions): MockServerState {
	return new MockServerState(options)
}

/**
 * Create a mock user from config
 */
export function createMockUser(config?: MockUserConfig): MockUser {
	return {
		id: config?.id ?? generateSnowflake(),
		username: config?.username ?? 'User',
		discriminator: config?.discriminator ?? '0',
		globalName: config?.globalName ?? config?.username ?? 'User',
		avatar: config?.avatar ?? null,
		bot: config?.bot ?? false
	}
}

/**
 * Create a mock guild from config
 */
export function createMockGuild(config?: { id?: Snowflake; name?: string; ownerId?: Snowflake }): MockGuild {
	const id = config?.id ?? generateSnowflake()
	return {
		id,
		name: config?.name ?? 'Test Guild',
		ownerId: config?.ownerId ?? generateSnowflake(),
		channels: [],
		members: [],
		roles: [id] // @everyone role has same ID as guild
	}
}

/**
 * Create a mock channel from config
 */
export function createMockChannel(config?: {
	id?: Snowflake
	guildId?: Snowflake
	name?: string
	type?: number
	parentId?: Snowflake | null
}): MockChannel {
	return {
		id: config?.id ?? generateSnowflake(),
		guildId: config?.guildId,
		name: config?.name ?? 'general',
		type: config?.type ?? 0, // GUILD_TEXT
		parentId: config?.parentId ?? null
	}
}

/**
 * Create a mock message from config
 */
export function createMockMessage(config: MockMessageConfig): MockMessage {
	const content = config.content ?? ''
	return {
		id: config.id ?? generateSnowflake(),
		channelId: config.channelId,
		guildId: config.guildId,
		authorId: config.authorId,
		content,
		timestamp: new Date().toISOString(),
		editedTimestamp: null,
		tts: config.tts ?? false,
		mentionEveryone: content.includes('@everyone'),
		mentions: [],
		mentionRoles: [],
		attachments: config.attachments ?? [],
		embeds: config.embeds ?? [],
		pinned: false,
		type: config.type ?? 0 // DEFAULT
	}
}

// ============================================================================
// Helper Functions (backward compatibility)
// ============================================================================

/**
 * Add a guild to the session state
 * @deprecated Use state.addGuild() instead
 */
export function addGuildToSession(state: SessionState, guild: MockGuild): void {
	state.guilds.set(guild.id, guild)

	// Add bot user as member if not already
	if (!guild.members.includes(state.botUser.id)) {
		guild.members.push(state.botUser.id)
	}
}

/**
 * Add a channel to a guild in the session state
 * @deprecated Use state.addChannelToGuild() instead
 */
export function addChannelToGuild(state: SessionState, guildId: Snowflake, channel: MockChannel): void {
	// Set guild ID on channel
	channel.guildId = guildId

	// Add channel to state
	state.channels.set(channel.id, channel)

	// Add channel ID to guild's channel list
	const guild = state.guilds.get(guildId)
	if (guild && !guild.channels.includes(channel.id)) {
		guild.channels.push(channel.id)
	}
}

/**
 * Create a default guild with a general channel and add it to the session state
 * Returns the created guild for reference
 */
export function createDefaultGuildWithChannel(
	state: SessionState,
	config?: { guildName?: string; channelName?: string }
): MockGuild {
	// Create the guild
	const guild = createMockGuild({
		name: config?.guildName ?? 'Test Guild',
		ownerId: state.botUser.id
	})

	// Create a general text channel
	const channel = createMockChannel({
		guildId: guild.id,
		name: config?.channelName ?? 'general',
		type: 0 // GUILD_TEXT
	})

	// Add channel to guild's channel list
	guild.channels.push(channel.id)

	// Add bot user as member
	guild.members.push(state.botUser.id)

	// Add to session state
	state.guilds.set(guild.id, guild)
	state.channels.set(channel.id, channel)

	return guild
}

// ============================================================================
// Serialization Functions
// ============================================================================

/**
 * Serialize session state for API responses
 */
export function serializeSessionState(state: SessionState): SerializedSessionState {
	return {
		guilds: Array.from(state.guilds.values()).map(serializeMockGuild),
		channels: Array.from(state.channels.values()).map(serializeMockChannel),
		dmChannels: Array.from(state.dmChannels.values()).map(serializeMockChannel),
		users: Array.from(state.users.values()).map(serializeMockUser),
		messages: Array.from(state.messages.values()).map(serializeMockMessage),
		botUser: serializeMockUser(state.botUser),
		applicationId: state.applicationId,
		sequence: state.sequence
	}
}

/**
 * Serialize a mock guild
 */
export function serializeMockGuild(guild: MockGuild): SerializedMockGuild {
	return {
		id: guild.id,
		name: guild.name,
		ownerId: guild.ownerId,
		channels: [...guild.channels],
		members: [...guild.members],
		roles: [...guild.roles]
	}
}

/**
 * Serialize a mock channel
 */
export function serializeMockChannel(channel: MockChannel): SerializedMockChannel {
	return {
		id: channel.id,
		guildId: channel.guildId,
		name: channel.name,
		type: channel.type,
		parentId: channel.parentId
	}
}

/**
 * Serialize a mock user
 */
export function serializeMockUser(user: MockUser): SerializedMockUser {
	return {
		id: user.id,
		username: user.username,
		discriminator: user.discriminator,
		globalName: user.globalName,
		avatar: user.avatar,
		bot: user.bot
	}
}

/**
 * Serialize a mock message
 */
export function serializeMockMessage(message: MockMessage): SerializedMockMessage {
	return {
		id: message.id,
		channelId: message.channelId,
		guildId: message.guildId,
		authorId: message.authorId,
		content: message.content,
		timestamp: message.timestamp,
		editedTimestamp: message.editedTimestamp,
		tts: message.tts,
		mentionEveryone: message.mentionEveryone,
		mentions: [...message.mentions],
		mentionRoles: [...message.mentionRoles],
		attachments: [...message.attachments],
		embeds: [...message.embeds],
		pinned: message.pinned,
		type: message.type
	}
}
