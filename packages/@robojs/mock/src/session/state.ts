import type { Snowflake } from 'discord-api-types/v10'
import type {
	SessionState,
	MockGuild,
	MockChannel,
	MockUser,
	MockUserConfig,
	SerializedSessionState,
	SerializedMockGuild,
	SerializedMockChannel,
	SerializedMockUser
} from '../types/index.js'
import { generateSnowflake } from '../utils/snowflake.js'

/**
 * Create an empty session state
 */
export function createSessionState(options?: { botUser?: MockUserConfig; applicationId?: Snowflake }): SessionState {
	const botUser = createMockUser({
		bot: true,
		username: 'MockBot',
		...options?.botUser
	})

	return {
		guilds: new Map(),
		channels: new Map(),
		users: new Map([[botUser.id, botUser]]),
		botUser,
		applicationId: options?.applicationId ?? botUser.id,
		sequence: 0
	}
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

// ============================================================================
// Guild/Channel Management Helpers (Phase 1E)
// ============================================================================

/**
 * Add a guild to the session state
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
export function createDefaultGuildWithChannel(state: SessionState, config?: { guildName?: string; channelName?: string }): MockGuild {
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

/**
 * Serialize session state for API responses
 */
export function serializeSessionState(state: SessionState): SerializedSessionState {
	return {
		guilds: Array.from(state.guilds.values()).map(serializeMockGuild),
		channels: Array.from(state.channels.values()).map(serializeMockChannel),
		users: Array.from(state.users.values()).map(serializeMockUser),
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
