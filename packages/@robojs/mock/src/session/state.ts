import { ChannelType, type Snowflake } from 'discord-api-types/v10'
import type {
	SessionState,
	MockGuild,
	MockChannel,
	MockUser,
	MockMessage,
	MockInteraction,
	MockUserConfig,
	MockMessageConfig,
	MockThread,
	MockThreadConfig,
	MockThreadMember,
	MockAttachment,
	StoredAttachment,
	SerializedSessionState,
	SerializedMockGuild,
	SerializedMockChannel,
	SerializedMockUser,
	SerializedMockMessage,
	SerializedMockInteraction,
	SerializedMockThread,
	SerializedMockAttachment,
	SerializedStoredAttachment,
	ComponentsV2ValidationResult,
	MockPoll,
	MockPollConfig,
	MockPollAnswer,
	MockPollResults
} from '../types/index.js'
import { ComponentsV2Limits, ComponentTypeV2, PollLayoutType } from '../types/index.js'
import { generateSnowflake } from '../utils/snowflake.js'
import { MemoryAttachmentStorage, type AttachmentStorage, type StorageConfig, createStorage } from '../storage/attachment-storage.js'

// Default limits for memory management
const DEFAULT_MAX_MESSAGES = 1000
const DEFAULT_MAX_INTERACTIONS = 1000
const INTERACTION_TTL = 15 * 60 * 1000 // 15 minutes

/**
 * Options for creating a MockServerState
 */
export interface StateOptions {
	botUser?: MockUserConfig
	applicationId?: Snowflake
	maxMessages?: number
	/** Storage backend configuration for attachments */
	storage?: StorageConfig
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
	readonly interactions: Map<Snowflake, MockInteraction>
	readonly threadMembers: Map<Snowflake, Map<Snowflake, MockThreadMember>> // threadId -> userId -> member
	readonly pollVotes: Map<Snowflake, Map<Snowflake, number[]>> // Phase 4G: messageId -> userId -> answerIds[]
	readonly botUser: MockUser
	readonly applicationId: Snowflake

	/**
	 * Attachment storage backend.
	 * @see AttachmentStorage for the interface
	 * @see MemoryAttachmentStorage for the default implementation
	 */
	readonly attachmentStorage: MemoryAttachmentStorage

	/**
	 * @deprecated Use attachmentStorage methods instead. This getter provides backward compatibility.
	 */
	get attachments(): Map<Snowflake, StoredAttachment> {
		// Return a proxy Map that delegates to the storage backend
		// This maintains backward compatibility with code that accesses attachments directly
		return (this.attachmentStorage as unknown as { attachments: Map<Snowflake, StoredAttachment> }).attachments
	}

	private _sequence: number = 0
	private readonly maxMessages: number
	private readonly maxInteractions: number
	private readonly interactionsByToken: Map<string, Snowflake>

	constructor(options?: StateOptions) {
		this.guilds = new Map()
		this.channels = new Map()
		this.dmChannels = new Map()
		this.users = new Map()
		this.messages = new Map()
		this.interactions = new Map()
		this.threadMembers = new Map()
		this.pollVotes = new Map()
		this.interactionsByToken = new Map()
		this.maxMessages = options?.maxMessages ?? DEFAULT_MAX_MESSAGES
		this.maxInteractions = DEFAULT_MAX_INTERACTIONS

		// Initialize attachment storage backend
		// Currently only memory storage is supported synchronously
		// Future async backends would require architectural changes
		this.attachmentStorage = new MemoryAttachmentStorage()

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
	 * Delete a message and its associated attachments
	 */
	deleteMessage(id: Snowflake): boolean {
		const message = this.messages.get(id)
		if (message) {
			// Clean up associated attachments
			for (const attachment of message.attachments) {
				this.attachments.delete(attachment.id)
			}
		}
		return this.messages.delete(id)
	}

	// ============================================================================
	// Attachment Operations (Phase 4E)
	// Uses AttachmentStorage interface for pluggable backends
	// ============================================================================

	/**
	 * Store an attachment using the configured storage backend.
	 */
	storeAttachment(attachment: StoredAttachment): void {
		this.attachmentStorage.storeSync(attachment)
	}

	/**
	 * Get an attachment by ID.
	 */
	getAttachment(id: Snowflake): StoredAttachment | undefined {
		return this.attachmentStorage.getSync(id)
	}

	/**
	 * Delete an attachment by ID.
	 */
	deleteAttachment(id: Snowflake): boolean {
		return this.attachmentStorage.deleteSync(id)
	}

	/**
	 * Get all attachments for a message.
	 */
	getAttachmentsForMessage(messageId: Snowflake): StoredAttachment[] {
		return this.attachmentStorage.getForMessageSync(messageId)
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
	// Interaction Operations (Phase 3A)
	// ============================================================================

	/**
	 * Get an interaction by ID
	 */
	getInteraction(id: Snowflake): MockInteraction | undefined {
		return this.interactions.get(id)
	}

	/**
	 * Get an interaction by token
	 */
	getInteractionByToken(token: string): MockInteraction | undefined {
		const id = this.interactionsByToken.get(token)
		return id ? this.interactions.get(id) : undefined
	}

	/**
	 * Add an interaction to the state
	 */
	addInteraction(interaction: MockInteraction): void {
		// Enforce max interactions limit (LRU-style)
		if (this.interactions.size >= this.maxInteractions) {
			// First try to cleanup expired
			this.cleanupExpiredInteractions()

			// If still at capacity, remove oldest
			if (this.interactions.size >= this.maxInteractions) {
				const oldest = this.interactions.keys().next().value
				if (oldest) {
					this.removeInteraction(oldest)
				}
			}
		}

		this.interactions.set(interaction.id, interaction)
		this.interactionsByToken.set(interaction.token, interaction.id)
	}

	/**
	 * Remove an interaction from the state
	 */
	removeInteraction(id: Snowflake): boolean {
		const interaction = this.interactions.get(id)
		if (interaction) {
			this.interactionsByToken.delete(interaction.token)
			return this.interactions.delete(id)
		}
		return false
	}

	/**
	 * Cleanup expired interactions (older than 15 minutes)
	 */
	cleanupExpiredInteractions(): void {
		const now = Date.now()
		for (const [id, interaction] of this.interactions) {
			if (now > interaction.expiresAt) {
				this.interactionsByToken.delete(interaction.token)
				this.interactions.delete(id)
			}
		}
	}

	// ============================================================================
	// Thread Operations (Phase 4D)
	// ============================================================================

	/**
	 * Check if a channel is a thread type (10, 11, or 12)
	 */
	isThread(channelId: Snowflake): boolean {
		const channel = this.channels.get(channelId)
		return channel?.type === 10 || channel?.type === 11 || channel?.type === 12
	}

	/**
	 * Get a thread by ID (returns undefined if not a thread)
	 */
	getThread(id: Snowflake): MockThread | undefined {
		const channel = this.channels.get(id)
		if (channel && (channel.type === 10 || channel.type === 11 || channel.type === 12)) {
			return channel as MockThread
		}
		return undefined
	}

	/**
	 * Get all threads for a parent channel
	 */
	getThreadsForChannel(channelId: Snowflake, options?: { archived?: boolean }): MockThread[] {
		const threads: MockThread[] = []
		for (const channel of this.channels.values()) {
			if (
				(channel.type === 10 || channel.type === 11 || channel.type === 12) &&
				channel.parentId === channelId
			) {
				const thread = channel as MockThread
				if (options?.archived === undefined || thread.threadMetadata.archived === options.archived) {
					threads.push(thread)
				}
			}
		}
		return threads
	}

	/**
	 * Get all active (non-archived) threads in a guild
	 */
	getActiveThreadsForGuild(guildId: Snowflake): MockThread[] {
		const threads: MockThread[] = []
		for (const channel of this.channels.values()) {
			if (
				(channel.type === 10 || channel.type === 11 || channel.type === 12) &&
				channel.guildId === guildId
			) {
				const thread = channel as MockThread
				if (!thread.threadMetadata.archived) {
					threads.push(thread)
				}
			}
		}
		return threads
	}

	/**
	 * Create a thread channel
	 */
	createThread(config: MockThreadConfig): MockThread {
		const thread = createMockThread(config)

		// Get guild ID from parent channel
		const parentChannel = this.channels.get(config.parentId)
		if (parentChannel?.guildId) {
			thread.guildId = parentChannel.guildId

			// Add to guild's channel list
			const guild = this.guilds.get(parentChannel.guildId)
			if (guild && !guild.channels.includes(thread.id)) {
				guild.channels.push(thread.id)
			}
		}

		// Store in channels map
		this.channels.set(thread.id, thread)

		// Initialize thread members map and add owner as first member
		const membersMap = new Map<Snowflake, MockThreadMember>()
		const ownerMember: MockThreadMember = {
			id: thread.id,
			user_id: thread.ownerId,
			join_timestamp: new Date().toISOString(),
			flags: 0
		}
		membersMap.set(thread.ownerId, ownerMember)
		this.threadMembers.set(thread.id, membersMap)

		return thread
	}

	/**
	 * Update thread metadata
	 */
	updateThread(
		threadId: Snowflake,
		updates: Partial<{
			name: string
			archived: boolean
			locked: boolean
			auto_archive_duration: 60 | 1440 | 4320 | 10080
			invitable: boolean
			rateLimitPerUser: number
		}>
	): MockThread | undefined {
		const thread = this.getThread(threadId)
		if (!thread) {
			return undefined
		}

		// Update name if provided
		if (updates.name !== undefined) {
			thread.name = updates.name
		}

		// Update thread metadata fields
		if (updates.archived !== undefined) {
			thread.threadMetadata.archived = updates.archived
			thread.threadMetadata.archive_timestamp = new Date().toISOString()
		}
		if (updates.locked !== undefined) {
			thread.threadMetadata.locked = updates.locked
		}
		if (updates.auto_archive_duration !== undefined) {
			thread.threadMetadata.auto_archive_duration = updates.auto_archive_duration
		}
		if (updates.invitable !== undefined && thread.type === 12) {
			thread.threadMetadata.invitable = updates.invitable
		}

		return thread
	}

	/**
	 * Delete a thread
	 */
	deleteThread(threadId: Snowflake): boolean {
		const thread = this.getThread(threadId)
		if (!thread) {
			return false
		}

		// Remove from guild's channel list
		if (thread.guildId) {
			const guild = this.guilds.get(thread.guildId)
			if (guild) {
				const idx = guild.channels.indexOf(threadId)
				if (idx !== -1) {
					guild.channels.splice(idx, 1)
				}
			}
		}

		// Remove messages in this thread
		for (const [messageId, message] of this.messages) {
			if (message.channelId === threadId) {
				this.messages.delete(messageId)
			}
		}

		// Remove thread members
		this.threadMembers.delete(threadId)

		// Remove from channels
		return this.channels.delete(threadId)
	}

	/**
	 * Add a member to a thread
	 */
	addThreadMember(threadId: Snowflake, userId: Snowflake): MockThreadMember | undefined {
		const thread = this.getThread(threadId)
		if (!thread) {
			return undefined
		}

		// Get or create thread members map
		let membersMap = this.threadMembers.get(threadId)
		if (!membersMap) {
			membersMap = new Map()
			this.threadMembers.set(threadId, membersMap)
		}

		// Check if already a member
		if (membersMap.has(userId)) {
			return membersMap.get(userId)
		}

		// Create member
		const member: MockThreadMember = {
			id: threadId,
			user_id: userId,
			join_timestamp: new Date().toISOString(),
			flags: 0
		}
		membersMap.set(userId, member)

		// Update member count (capped at 50 for display)
		thread.memberCount = Math.min(membersMap.size, 50)

		return member
	}

	/**
	 * Remove a member from a thread
	 */
	removeThreadMember(threadId: Snowflake, userId: Snowflake): boolean {
		const thread = this.getThread(threadId)
		if (!thread) {
			return false
		}

		const membersMap = this.threadMembers.get(threadId)
		if (!membersMap) {
			return false
		}

		const removed = membersMap.delete(userId)
		if (removed) {
			// Update member count
			thread.memberCount = Math.min(membersMap.size, 50)
		}

		return removed
	}

	/**
	 * Get a thread member
	 */
	getThreadMember(threadId: Snowflake, userId: Snowflake): MockThreadMember | undefined {
		const membersMap = this.threadMembers.get(threadId)
		return membersMap?.get(userId)
	}

	/**
	 * Get all members of a thread
	 */
	getThreadMembers(threadId: Snowflake): MockThreadMember[] {
		const membersMap = this.threadMembers.get(threadId)
		return membersMap ? Array.from(membersMap.values()) : []
	}

	/**
	 * Increment thread message count and update activity timestamp
	 */
	incrementThreadMessageCount(threadId: Snowflake): void {
		const thread = this.getThread(threadId)
		if (thread) {
			thread.messageCount = Math.min((thread.messageCount || 0) + 1, 50)
			thread.totalMessageSent = (thread.totalMessageSent || 0) + 1
			// Update activity timestamp for auto-archive tracking
			thread.threadMetadata.last_activity_timestamp = new Date().toISOString()
		}
	}

	/**
	 * Check and archive inactive threads based on auto_archive_duration
	 * Returns array of thread IDs that were archived
	 */
	checkAutoArchiveThreads(): Snowflake[] {
		const archivedIds: Snowflake[] = []
		const now = Date.now()

		for (const [channelId, channel] of this.channels) {
			// Only check threads (types 10, 11, 12)
			if (channel.type !== 10 && channel.type !== 11 && channel.type !== 12) {
				continue
			}

			const thread = channel as MockThread

			// Skip already archived threads
			if (thread.threadMetadata.archived) {
				continue
			}

			// Get last activity time
			const lastActivity = thread.threadMetadata.last_activity_timestamp
				? new Date(thread.threadMetadata.last_activity_timestamp).getTime()
				: new Date(thread.threadMetadata.create_timestamp || new Date().toISOString()).getTime()

			// Calculate inactivity duration in minutes
			const inactiveMinutes = (now - lastActivity) / (1000 * 60)

			// Archive if inactive for longer than auto_archive_duration
			if (inactiveMinutes >= thread.threadMetadata.auto_archive_duration) {
				thread.threadMetadata.archived = true
				thread.threadMetadata.archive_timestamp = new Date().toISOString()
				archivedIds.push(channelId)
			}
		}

		return archivedIds
	}

	// ============================================================================
	// Poll Operations (Phase 4G)
	// ============================================================================

	/**
	 * Add a vote to a poll
	 * @returns true if vote was added, false if already voted (single-select) or invalid
	 */
	addPollVote(messageId: Snowflake, userId: Snowflake, answerId: number): boolean {
		const message = this.getMessage(messageId)
		if (!message?.poll || message.poll.results?.is_finalized) {
			return false
		}

		// Validate answer exists
		const answerExists = message.poll.answers.some((a) => a.answer_id === answerId)
		if (!answerExists) {
			return false
		}

		// Get or create user votes for this message
		let messageVotes = this.pollVotes.get(messageId)
		if (!messageVotes) {
			messageVotes = new Map()
			this.pollVotes.set(messageId, messageVotes)
		}

		// Get user's current votes
		let userVotes = messageVotes.get(userId) ?? []

		// Check if already voted for this answer
		if (userVotes.includes(answerId)) {
			return false
		}

		// If single-select, replace existing vote
		if (!message.poll.allow_multiselect && userVotes.length > 0) {
			// Remove vote from previous answer count
			const previousAnswerId = userVotes[0]
			const prevCount = message.poll.results?.answer_counts.find((c) => c.id === previousAnswerId)
			if (prevCount && prevCount.count > 0) {
				prevCount.count--
			}
			userVotes = []
		}

		// Add vote
		userVotes.push(answerId)
		messageVotes.set(userId, userVotes)

		// Update results
		this.updatePollResults(messageId)

		return true
	}

	/**
	 * Remove a vote from a poll (only for multiselect polls)
	 * @returns true if vote was removed, false if not voted or invalid
	 */
	removePollVote(messageId: Snowflake, userId: Snowflake, answerId: number): boolean {
		const message = this.getMessage(messageId)
		if (!message?.poll || message.poll.results?.is_finalized) {
			return false
		}

		const messageVotes = this.pollVotes.get(messageId)
		if (!messageVotes) {
			return false
		}

		const userVotes = messageVotes.get(userId)
		if (!userVotes) {
			return false
		}

		const voteIndex = userVotes.indexOf(answerId)
		if (voteIndex === -1) {
			return false
		}

		// Remove vote
		userVotes.splice(voteIndex, 1)
		if (userVotes.length === 0) {
			messageVotes.delete(userId)
		}

		// Update results
		this.updatePollResults(messageId)

		return true
	}

	/**
	 * Get all users who voted for a specific answer
	 */
	getPollVoters(messageId: Snowflake, answerId: number): Snowflake[] {
		const messageVotes = this.pollVotes.get(messageId)
		if (!messageVotes) {
			return []
		}

		const voters: Snowflake[] = []
		for (const [userId, votes] of messageVotes) {
			if (votes.includes(answerId)) {
				voters.push(userId)
			}
		}

		return voters
	}

	/**
	 * Get all votes for a user on a poll
	 */
	getUserPollVotes(messageId: Snowflake, userId: Snowflake): number[] {
		const messageVotes = this.pollVotes.get(messageId)
		return messageVotes?.get(userId) ?? []
	}

	/**
	 * Update poll results based on current votes
	 */
	updatePollResults(messageId: Snowflake): void {
		const message = this.getMessage(messageId)
		if (!message?.poll) {
			return
		}

		const messageVotes = this.pollVotes.get(messageId)
		const voteCounts = new Map<number, number>()

		// Initialize counts for all answers
		for (const answer of message.poll.answers) {
			voteCounts.set(answer.answer_id, 0)
		}

		// Count votes
		if (messageVotes) {
			for (const votes of messageVotes.values()) {
				for (const answerId of votes) {
					voteCounts.set(answerId, (voteCounts.get(answerId) ?? 0) + 1)
				}
			}
		}

		// Update results
		message.poll.results = {
			is_finalized: message.poll.results?.is_finalized ?? false,
			answer_counts: message.poll.answers.map((a) => ({
				id: a.answer_id,
				count: voteCounts.get(a.answer_id) ?? 0,
				me_voted: false // Will be set per-user in API response
			}))
		}
	}

	/**
	 * Expire (finalize) a poll
	 * @returns true if poll was expired, false if already expired or no poll
	 */
	expirePoll(messageId: Snowflake): boolean {
		const message = this.getMessage(messageId)
		if (!message?.poll || message.poll.results?.is_finalized) {
			return false
		}

		// Finalize results
		this.updatePollResults(messageId)
		message.poll.results!.is_finalized = true
		message.poll.expiry = new Date().toISOString()

		return true
	}

	/**
	 * Check if a poll has expired and finalize it
	 * @returns true if poll was expired
	 */
	checkPollExpiry(messageId: Snowflake): boolean {
		const message = this.getMessage(messageId)
		if (!message?.poll || message.poll.results?.is_finalized) {
			return false
		}

		if (!message.poll.expiry) {
			return false
		}

		const expiryTime = new Date(message.poll.expiry).getTime()
		if (Date.now() >= expiryTime) {
			return this.expirePoll(messageId)
		}

		return false
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
		this.interactions.clear()
		this.threadMembers.clear()
		this.pollVotes.clear()
		this.interactionsByToken.clear()
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
			interactions: Array.from(this.interactions.values()).map(serializeMockInteraction),
			attachments: Array.from(this.attachments.values()).map(serializeStoredAttachment),
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
 * Create a mock thread from config
 */
export function createMockThread(config: MockThreadConfig): MockThread {
	const now = new Date().toISOString()
	return {
		id: config.id ?? generateSnowflake(),
		guildId: undefined, // Will be set when added to state
		name: config.name,
		type: config.type,
		parentId: config.parentId,
		ownerId: config.ownerId ?? generateSnowflake(),
		threadMetadata: {
			archived: false,
			auto_archive_duration: config.autoArchiveDuration ?? 1440, // 24 hours default
			archive_timestamp: now,
			locked: false,
			invitable: config.type === 12 ? (config.invitable ?? true) : undefined,
			create_timestamp: now,
			last_activity_timestamp: now // Track for auto-archive
		},
		memberCount: 1, // Owner is always a member
		messageCount: 0,
		totalMessageSent: 0,
		lastMessageId: null
	}
}

/**
 * Create a mock message from config
 */
export function createMockMessage(config: MockMessageConfig): MockMessage {
	const content = config.content ?? ''
	const message: MockMessage = {
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

	// Phase 3I: Add optional fields if provided
	if (config.call) {
		message.call = config.call
	}
	if (config.interactionMetadata) {
		message.interaction_metadata = config.interactionMetadata
		// Also populate deprecated field for backwards compatibility
		message.interaction = {
			id: config.interactionMetadata.id,
			type: config.interactionMetadata.type,
			name: '', // Not available in metadata
			user: config.interactionMetadata.user
		}
	}
	if (config.messageSnapshots) {
		message.message_snapshots = config.messageSnapshots
	}
	if (config.resolved) {
		message.resolved = config.resolved
	}

	// Phase 4F: Components V2
	if (config.flags !== undefined) {
		message.flags = config.flags
	}
	if (config.components) {
		message.components = config.components
	}

	// Phase 4G: Polls
	if (config.poll) {
		message.poll = createMockPoll(config.poll)
	}

	return message
}

/** Maximum number of answers in a poll */
export const MAX_POLL_ANSWERS = 10

/** Maximum character length for poll question text */
export const MAX_POLL_QUESTION_LENGTH = 300

/** Maximum character length for poll answer text */
export const MAX_POLL_ANSWER_LENGTH = 55

/**
 * Create a mock poll from config
 */
export function createMockPoll(config: MockPollConfig): MockPoll {
	// Validate max answers (Discord limit is 10)
	if (config.answers.length > MAX_POLL_ANSWERS) {
		throw new Error(`Poll cannot have more than ${MAX_POLL_ANSWERS} answers`)
	}
	if (config.answers.length < 1) {
		throw new Error('Poll must have at least 1 answer')
	}

	// Validate question text length
	if (config.question.text && config.question.text.length > MAX_POLL_QUESTION_LENGTH) {
		throw new Error(`Poll question text cannot exceed ${MAX_POLL_QUESTION_LENGTH} characters`)
	}

	// Validate answer text lengths
	for (let i = 0; i < config.answers.length; i++) {
		const answerText = config.answers[i].poll_media.text
		if (answerText && answerText.length > MAX_POLL_ANSWER_LENGTH) {
			throw new Error(`Poll answer ${i + 1} text cannot exceed ${MAX_POLL_ANSWER_LENGTH} characters`)
		}
	}

	// Calculate expiry timestamp from duration (in hours)
	let expiry: string | null = null
	if (config.duration && config.duration > 0) {
		const expiryDate = new Date()
		expiryDate.setHours(expiryDate.getHours() + config.duration)
		expiry = expiryDate.toISOString()
	}

	// Generate answer_ids (1-indexed)
	const answers: MockPollAnswer[] = config.answers.map((answer, index) => ({
		answer_id: index + 1,
		poll_media: answer.poll_media
	}))

	// Initialize empty results
	const results: MockPollResults = {
		is_finalized: false,
		answer_counts: answers.map((a) => ({
			id: a.answer_id,
			count: 0,
			me_voted: false
		}))
	}

	return {
		question: config.question,
		answers,
		expiry,
		allow_multiselect: config.allow_multiselect ?? false,
		layout_type: config.layout_type ?? PollLayoutType.Default,
		results
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
		interactions: Array.from(state.interactions.values()).map(serializeMockInteraction),
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
 * Serialize a mock thread
 */
export function serializeMockThread(thread: MockThread): SerializedMockThread {
	return {
		id: thread.id,
		guildId: thread.guildId,
		name: thread.name,
		type: thread.type,
		parentId: thread.parentId,
		ownerId: thread.ownerId,
		threadMetadata: {
			archived: thread.threadMetadata.archived,
			auto_archive_duration: thread.threadMetadata.auto_archive_duration,
			archive_timestamp: thread.threadMetadata.archive_timestamp,
			locked: thread.threadMetadata.locked,
			invitable: thread.threadMetadata.invitable,
			create_timestamp: thread.threadMetadata.create_timestamp,
			last_activity_timestamp: thread.threadMetadata.last_activity_timestamp
		},
		memberCount: thread.memberCount,
		messageCount: thread.messageCount,
		totalMessageSent: thread.totalMessageSent,
		lastMessageId: thread.lastMessageId
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
		attachments: message.attachments.map(serializeMockAttachment),
		embeds: [...message.embeds],
		pinned: message.pinned,
		type: message.type
	}
}

/**
 * Serialize a mock interaction
 */
export function serializeMockInteraction(interaction: MockInteraction): SerializedMockInteraction {
	return {
		id: interaction.id,
		applicationId: interaction.applicationId,
		type: interaction.type,
		token: interaction.token,
		channelId: interaction.channelId,
		guildId: interaction.guildId,
		userId: interaction.userId,
		commandName: interaction.commandName,
		commandId: interaction.commandId,
		options: interaction.options,
		createdAt: interaction.createdAt,
		expiresAt: interaction.expiresAt,
		// Response tracking (Phase 3B)
		response: interaction.response,
		respondedAt: interaction.respondedAt,
		// MESSAGE_COMPONENT interactions (Phase 3C, 3D)
		customId: interaction.customId,
		componentType: interaction.componentType,
		messageId: interaction.messageId,
		values: interaction.values,
		// MODAL_SUBMIT interactions (Phase 3E)
		modalFields: interaction.modalFields,
		// Context menu commands (Phase 3G)
		targetId: interaction.targetId,
		contextMenuType: interaction.contextMenuType
	}
}

/**
 * Serialize a mock attachment (API format)
 */
export function serializeMockAttachment(attachment: MockAttachment): SerializedMockAttachment {
	return {
		id: attachment.id,
		filename: attachment.filename,
		title: attachment.title,
		description: attachment.description,
		content_type: attachment.content_type,
		size: attachment.size,
		url: attachment.url,
		proxy_url: attachment.proxy_url,
		width: attachment.width,
		height: attachment.height,
		duration_secs: attachment.duration_secs,
		waveform: attachment.waveform,
		ephemeral: attachment.ephemeral,
		flags: attachment.flags
	}
}

/**
 * Serialize a stored attachment (includes binary data as base64)
 */
export function serializeStoredAttachment(attachment: StoredAttachment): SerializedStoredAttachment {
	// Convert Uint8Array to base64 string
	const base64 = Buffer.from(attachment.data).toString('base64')

	return {
		id: attachment.id,
		channelId: attachment.channelId,
		messageId: attachment.messageId,
		filename: attachment.filename,
		contentType: attachment.contentType,
		size: attachment.size,
		data: base64,
		width: attachment.width,
		height: attachment.height
	}
}

/**
 * Deserialize a stored attachment (converts base64 back to Uint8Array)
 */
export function deserializeStoredAttachment(serialized: SerializedStoredAttachment): StoredAttachment {
	return {
		id: serialized.id,
		channelId: serialized.channelId,
		messageId: serialized.messageId,
		filename: serialized.filename,
		contentType: serialized.contentType,
		size: serialized.size,
		data: new Uint8Array(Buffer.from(serialized.data, 'base64')),
		width: serialized.width,
		height: serialized.height
	}
}

// ============================================================================
// Phase 4F: Components V2 Validation
// ============================================================================

/**
 * Validate Components V2 structure according to Discord's rules:
 * - Max 40 total components (including nested)
 * - Max 4000 chars total across all TextDisplay components
 * - Component IDs must be unique
 * - attachment:// URLs must reference valid attachments
 * - MediaGallery: 1-10 items
 * - Section: 1-3 TextDisplay components
 *
 * @param components - Array of V2 components to validate
 * @param attachmentFilenames - Set of valid attachment filenames for attachment:// URLs
 * @returns Validation result with any errors
 */
export function validateComponentsV2(
	components: unknown[],
	attachmentFilenames?: Set<string>
): ComponentsV2ValidationResult {
	const errors: string[] = []
	let totalComponents = 0
	let totalTextLength = 0
	const usedIds = new Set<number>()

	function validateComponent(comp: Record<string, unknown>, depth = 0): void {
		// Prevent excessive nesting
		if (depth > 10) {
			errors.push('Component nesting too deep (max 10 levels)')
			return
		}

		totalComponents++

		// Check component count limit
		if (totalComponents > ComponentsV2Limits.MAX_COMPONENTS) {
			// Only add error once
			if (totalComponents === ComponentsV2Limits.MAX_COMPONENTS + 1) {
				errors.push(`Too many components (max ${ComponentsV2Limits.MAX_COMPONENTS})`)
			}
			return
		}

		// Check ID uniqueness
		if (comp.id !== undefined) {
			if (typeof comp.id === 'number') {
				if (usedIds.has(comp.id)) {
					errors.push(`Duplicate component ID: ${comp.id}`)
				}
				usedIds.add(comp.id)
			}
		}

		const compType = comp.type as number

		// TextDisplay validation (type 10)
		if (compType === ComponentTypeV2.TextDisplay) {
			if (typeof comp.content === 'string') {
				totalTextLength += comp.content.length
				if (totalTextLength > ComponentsV2Limits.MAX_TEXT_LENGTH) {
					// Only add error once when we exceed
					if (
						totalTextLength - comp.content.length <= ComponentsV2Limits.MAX_TEXT_LENGTH &&
						totalTextLength > ComponentsV2Limits.MAX_TEXT_LENGTH
					) {
						errors.push(`Total text length exceeds ${ComponentsV2Limits.MAX_TEXT_LENGTH} chars`)
					}
				}
			}
		}

		// Section validation (type 9)
		if (compType === ComponentTypeV2.Section) {
			if (Array.isArray(comp.components)) {
				if (comp.components.length > ComponentsV2Limits.MAX_SECTION_TEXT_COMPONENTS) {
					errors.push(
						`Section has too many text components: ${comp.components.length} (max ${ComponentsV2Limits.MAX_SECTION_TEXT_COMPONENTS})`
					)
				}
				// Validate nested components
				for (const nested of comp.components) {
					if (nested && typeof nested === 'object') {
						validateComponent(nested as Record<string, unknown>, depth + 1)
					}
				}
			}
			// Validate accessory
			if (comp.accessory && typeof comp.accessory === 'object') {
				validateComponent(comp.accessory as Record<string, unknown>, depth + 1)
			}
		}

		// MediaGallery validation (type 12)
		if (compType === ComponentTypeV2.MediaGallery) {
			if (Array.isArray(comp.items)) {
				if (comp.items.length === 0) {
					errors.push('MediaGallery must have at least 1 item')
				} else if (comp.items.length > ComponentsV2Limits.MAX_MEDIA_GALLERY_ITEMS) {
					errors.push(
						`MediaGallery has too many items: ${comp.items.length} (max ${ComponentsV2Limits.MAX_MEDIA_GALLERY_ITEMS})`
					)
				}
				// Validate attachment:// URLs in items
				for (const item of comp.items) {
					if (item && typeof item === 'object') {
						const galleryItem = item as { media?: { url?: string } }
						validateAttachmentUrl(galleryItem.media?.url)
					}
				}
			}
		}

		// Container validation (type 17)
		if (compType === ComponentTypeV2.Container) {
			if (Array.isArray(comp.components)) {
				for (const nested of comp.components) {
					if (nested && typeof nested === 'object') {
						validateComponent(nested as Record<string, unknown>, depth + 1)
					}
				}
			}
		}

		// Thumbnail validation (type 11)
		if (compType === ComponentTypeV2.Thumbnail) {
			if (comp.media && typeof comp.media === 'object') {
				const media = comp.media as { url?: string }
				validateAttachmentUrl(media.url)
			}
		}

		// File validation (type 13)
		if (compType === ComponentTypeV2.File) {
			if (comp.file && typeof comp.file === 'object') {
				const file = comp.file as { url?: string }
				validateAttachmentUrl(file.url)
			}
		}
	}

	function validateAttachmentUrl(url: string | undefined): void {
		if (!url) return
		if (url.startsWith('attachment://') && attachmentFilenames) {
			const filename = url.slice('attachment://'.length)
			if (!attachmentFilenames.has(filename)) {
				errors.push(`Unknown attachment reference: ${url}`)
			}
		}
	}

	// Validate each top-level component
	for (const comp of components) {
		if (comp && typeof comp === 'object') {
			validateComponent(comp as Record<string, unknown>)
		}
	}

	return {
		valid: errors.length === 0,
		errors
	}
}
