import type {
	Session as ISession,
	ConnectionState,
	CreateSessionOptions,
	RecordedAction,
	ActionType,
	RecordActionOptions,
	MockMessage,
	MockUser,
	MockInteraction,
	MockInteractionOption,
	MockThread,
	DispatchSlashCommandOptions,
	DispatchButtonClickOptions,
	DispatchSelectMenuOptions,
	DispatchModalSubmitOptions,
	DispatchAutocompleteOptions,
	DispatchContextMenuOptions,
	DispatchThreadCreateOptions,
	SessionRecording,
	SessionConfig
} from '../types/index.js'
import { generateSessionId, createMockToken, generateInteractionToken } from '../utils/id.js'
import { generateSnowflake } from '../utils/snowflake.js'
import { MockServerState, createDefaultGuildWithChannel, createMockUser, createMockMessage } from './state.js'
import { ActionRecorder } from './recorder.js'
import { mockLogger } from '../core/logger.js'
import { getGatewayServer } from '../core/gateway.js'
import {
	buildMessageCreatePayload,
	buildInteractionCreatePayload,
	buildButtonInteractionPayload,
	buildSelectMenuInteractionPayload,
	buildModalSubmitInteractionPayload,
	buildAutocompleteInteractionPayload,
	buildContextMenuInteractionPayload,
	buildThreadCreatePayload,
	buildThreadUpdatePayload,
	buildThreadDeletePayload,
	buildThreadListSyncPayload,
	buildThreadMemberUpdatePayload,
	buildThreadMembersUpdatePayload,
	buildMessagePollVoteAddPayload,
	buildMessagePollVoteRemovePayload,
	type GatewayPayload
} from '../discord/payloads.js'

// Default TTL: 1 hour
const DEFAULT_TTL = 60 * 60 * 1000

/**
 * Represents an isolated test session with its own state
 */
export class Session implements ISession {
	readonly id: string
	readonly token: string
	readonly name?: string
	readonly createdAt: number
	readonly expiresAt: number
	readonly state: MockServerState
	readonly connections: Map<string, ConnectionState>

	private readonly recorder: ActionRecorder
	private ending = false
	private autoArchiveInterval: ReturnType<typeof setInterval> | null = null

	constructor(options?: CreateSessionOptions) {
		this.id = generateSessionId()
		this.token = createMockToken(this.id)
		this.name = options?.name
		this.createdAt = Date.now()
		this.expiresAt = this.createdAt + (options?.ttl ?? DEFAULT_TTL)
		this.connections = new Map()

		// Initialize action recorder with optional max actions
		this.recorder = new ActionRecorder(options?.config?.maxActions ?? 10000)

		// Initialize state with optional configuration
		this.state = new MockServerState({
			botUser: options?.config?.botUser,
			applicationId: options?.config?.applicationId
		})

		// Create guilds from config
		if (options?.config?.guilds) {
			for (const guildConfig of options.config.guilds) {
				createDefaultGuildWithChannel(this.state, {
					guildName: guildConfig.name,
					channelName: 'general'
				})
			}
		}

		mockLogger.debug(`Session created: ${this.id}${this.name ? ` (${this.name})` : ''}`)
	}

	/**
	 * Check if session has expired
	 */
	get isExpired(): boolean {
		return Date.now() > this.expiresAt
	}

	/**
	 * Check if session is ending
	 */
	get isEnding(): boolean {
		return this.ending
	}

	/**
	 * Dispatch an event to all connections in this session
	 * Sends the event via WebSocket to connected bots
	 */
	async dispatch(event: string, data: unknown): Promise<void> {
		if (this.ending) {
			mockLogger.warn(`Cannot dispatch to ending session: ${this.id}`)
			return
		}

		// Record the dispatched event
		this.recorder.record('dispatch', { event, payload: data })

		// Get the guild ID for intent filtering (if present in data)
		const guildId = (data as Record<string, unknown>)?.guild_id as string | undefined

		// Dispatch to WebSocket connections via gateway server
		const gateway = getGatewayServer()
		const dispatched = gateway.dispatchToSession(this.id, event, data, guildId)

		mockLogger.debug(`Session ${this.id} dispatched: ${event} to ${dispatched} connection(s)`)
	}

	/**
	 * Dispatch a MESSAGE_CREATE event
	 * Creates a message in state and dispatches it to connected bots
	 *
	 * @param options - Message creation options
	 * @returns The created message
	 */
	async dispatchMessage(options: {
		channelId: string
		content?: string
		author?: Partial<MockUser> & { id?: string; username?: string }
		guildId?: string
		embeds?: unknown[]
		attachments?: unknown[]
	}): Promise<MockMessage> {
		if (this.ending) {
			throw new Error(`Cannot dispatch to ending session: ${this.id}`)
		}

		// Get or create author
		let author: MockUser
		if (options.author?.id) {
			// Check if user exists
			const existingUser = this.state.getUser(options.author.id)
			if (existingUser) {
				author = existingUser
			} else {
				// Create and store the user
				author = createMockUser({
					id: options.author.id,
					username: options.author.username ?? 'TestUser',
					bot: options.author.bot ?? false,
					...options.author
				})
				this.state.addUser(author)
			}
		} else {
			// Create a default test user
			author = this.state.getOrCreateTestUser()
		}

		// Validate channel exists
		const channel = this.state.getChannel(options.channelId)
		if (!channel) {
			throw new Error(`Channel not found: ${options.channelId}`)
		}

		// Determine guild ID from channel if not specified
		const guildId = options.guildId ?? channel.guildId

		// Create the message in state
		const message = this.state.createMessage({
			channelId: options.channelId,
			guildId,
			authorId: author.id,
			content: options.content ?? '',
			embeds: options.embeds ?? [],
			attachments: options.attachments ?? []
		})

		// Build the MESSAGE_CREATE payload
		const payload = buildMessageCreatePayload({
			message,
			author,
			sessionState: this.state,
			sequence: 0 // Sequence will be set per-connection by gateway
		})

		// Dispatch to connections (sequence handled by gateway)
		await this.dispatch('MESSAGE_CREATE', (payload as GatewayPayload).d)

		return message
	}

	/**
	 * Dispatch a MESSAGE_POLL_VOTE_ADD or MESSAGE_POLL_VOTE_REMOVE event
	 * Adds/removes a vote from a poll and dispatches the event to connected bots
	 *
	 * @param options - Poll vote options
	 * @returns true if the vote was successfully added/removed
	 */
	async dispatchPollVote(options: {
		userId: string
		messageId: string
		answerId: number
		action: 'add' | 'remove'
	}): Promise<boolean> {
		if (this.ending) {
			throw new Error(`Cannot dispatch to ending session: ${this.id}`)
		}

		// Validate message exists and has poll
		const message = this.state.getMessage(options.messageId)
		if (!message?.poll) {
			throw new Error(`Message not found or has no poll: ${options.messageId}`)
		}

		// Perform the vote action
		let success: boolean
		if (options.action === 'add') {
			success = this.state.addPollVote(options.messageId, options.userId, options.answerId)
		} else {
			success = this.state.removePollVote(options.messageId, options.userId, options.answerId)
		}

		if (!success) {
			return false
		}

		// Build the appropriate payload
		const payloadBuilder = options.action === 'add' ? buildMessagePollVoteAddPayload : buildMessagePollVoteRemovePayload

		const payload = payloadBuilder({
			userId: options.userId,
			channelId: message.channelId,
			messageId: options.messageId,
			guildId: message.guildId,
			answerId: options.answerId,
			sequence: 0 // Sequence will be set per-connection by gateway
		})

		// Dispatch to connections
		const eventName = options.action === 'add' ? 'MESSAGE_POLL_VOTE_ADD' : 'MESSAGE_POLL_VOTE_REMOVE'
		await this.dispatch(eventName, (payload as GatewayPayload).d)

		return true
	}

	/**
	 * Dispatch an INTERACTION_CREATE event for a slash command
	 * Creates an interaction in state and dispatches it to connected bots
	 *
	 * @param options - Slash command options
	 * @returns The created interaction
	 */
	async dispatchSlashCommand(options: DispatchSlashCommandOptions): Promise<MockInteraction> {
		if (this.ending) {
			throw new Error(`Cannot dispatch to ending session: ${this.id}`)
		}

		// Get or create user
		let user: MockUser
		if (options.user?.id) {
			const existingUser = this.state.getUser(options.user.id)
			if (existingUser) {
				user = existingUser
			} else {
				user = createMockUser(options.user)
				this.state.addUser(user)
			}
		} else {
			user = this.state.getOrCreateTestUser()
		}

		// Determine channel - use provided or find first available
		let channelId = options.channelId
		if (!channelId) {
			const firstGuild = this.state.guilds.values().next().value
			if (firstGuild && firstGuild.channels.length > 0) {
				channelId = firstGuild.channels[0]
			}
		}
		if (!channelId) {
			throw new Error('No channel specified and no channels available in session state')
		}

		// Get guild ID from channel if not specified
		const channel = this.state.getChannel(channelId)
		const guildId = options.guildId ?? channel?.guildId

		// Create interaction
		const now = Date.now()
		const interaction: MockInteraction = {
			id: generateSnowflake(),
			applicationId: this.state.applicationId,
			type: 2, // InteractionType.ApplicationCommand
			token: generateInteractionToken(),
			channelId,
			guildId,
			userId: user.id,
			commandName: options.commandName,
			commandId: generateSnowflake(),
			options: options.options ? this.convertOptionsToArray(options.options) : undefined,
			createdAt: now,
			expiresAt: now + 15 * 60 * 1000 // 15 minutes
		}

		// Store interaction
		this.state.addInteraction(interaction)

		// Build payload
		const payload = buildInteractionCreatePayload({
			interaction,
			user,
			sessionState: this.state,
			sequence: 0 // Will be set per-connection
		})

		// Dispatch to connections
		await this.dispatch('INTERACTION_CREATE', (payload as GatewayPayload).d)

		mockLogger.debug(`Session ${this.id} dispatched slash command: /${options.commandName}`)

		return interaction
	}

	/**
	 * Convert options object to array format for Discord API
	 */
	private convertOptionsToArray(options: Record<string, string | number | boolean>): MockInteractionOption[] {
		return Object.entries(options).map(([name, value]) => ({
			name,
			type: typeof value === 'string' ? 3 : typeof value === 'number' ? 4 : 5, // STRING, INTEGER, BOOLEAN
			value
		}))
	}

	/**
	 * Dispatch an INTERACTION_CREATE event for a button click (Phase 3C)
	 * Creates an interaction in state and dispatches it to connected bots
	 *
	 * @param options - Button click options
	 * @returns The created interaction
	 */
	async dispatchButtonClick(options: DispatchButtonClickOptions): Promise<MockInteraction> {
		if (this.ending) {
			throw new Error(`Cannot dispatch to ending session: ${this.id}`)
		}

		// Validate message exists in state
		const message = this.state.getMessage(options.messageId)
		if (!message) {
			throw new Error(`Message not found: ${options.messageId}`)
		}

		// Get or create user
		let user: MockUser
		if (options.user?.id) {
			const existingUser = this.state.getUser(options.user.id)
			if (existingUser) {
				user = existingUser
			} else {
				user = createMockUser(options.user)
				this.state.addUser(user)
			}
		} else {
			user = this.state.getOrCreateTestUser()
		}

		// Derive channel and guild from message if not specified
		const channelId = options.channelId ?? message.channelId
		const guildId = options.guildId ?? message.guildId

		// Create interaction
		const now = Date.now()
		const interaction: MockInteraction = {
			id: generateSnowflake(),
			applicationId: this.state.applicationId,
			type: 3, // InteractionType.MessageComponent
			token: generateInteractionToken(),
			channelId,
			guildId,
			userId: user.id,
			customId: options.customId,
			componentType: 2, // ComponentType.Button
			messageId: options.messageId,
			createdAt: now,
			expiresAt: now + 15 * 60 * 1000 // 15 minutes
		}

		// Store interaction
		this.state.addInteraction(interaction)

		// Build payload
		const payload = buildButtonInteractionPayload({
			interaction,
			user,
			message,
			sessionState: this.state,
			sequence: 0 // Will be set per-connection
		})

		// Dispatch to connections
		await this.dispatch('INTERACTION_CREATE', (payload as GatewayPayload).d)

		mockLogger.debug(`Session ${this.id} dispatched button click: ${options.customId}`)

		return interaction
	}

	/**
	 * Dispatch an INTERACTION_CREATE event for a select menu interaction (Phase 3D)
	 * Creates an interaction in state and dispatches it to connected bots
	 *
	 * @param options - Select menu options
	 * @returns The created interaction
	 */
	async dispatchSelectMenu(options: DispatchSelectMenuOptions): Promise<MockInteraction> {
		if (this.ending) {
			throw new Error(`Cannot dispatch to ending session: ${this.id}`)
		}

		// Validate message exists in state
		const message = this.state.getMessage(options.messageId)
		if (!message) {
			throw new Error(`Message not found: ${options.messageId}`)
		}

		// Get or create user
		let user: MockUser
		if (options.user?.id) {
			const existingUser = this.state.getUser(options.user.id)
			if (existingUser) {
				user = existingUser
			} else {
				user = createMockUser(options.user)
				this.state.addUser(user)
			}
		} else {
			user = this.state.getOrCreateTestUser()
		}

		// Derive channel and guild from message if not specified
		const channelId = options.channelId ?? message.channelId
		const guildId = options.guildId ?? message.guildId

		// Create interaction
		const now = Date.now()
		const interaction: MockInteraction = {
			id: generateSnowflake(),
			applicationId: this.state.applicationId,
			type: 3, // InteractionType.MessageComponent
			token: generateInteractionToken(),
			channelId,
			guildId,
			userId: user.id,
			customId: options.customId,
			componentType: options.componentType ?? 3, // Default to StringSelect
			messageId: options.messageId,
			values: options.values,
			createdAt: now,
			expiresAt: now + 15 * 60 * 1000 // 15 minutes
		}

		// Store interaction
		this.state.addInteraction(interaction)

		// Build payload
		const payload = buildSelectMenuInteractionPayload({
			interaction,
			user,
			message,
			values: options.values,
			sessionState: this.state,
			sequence: 0 // Will be set per-connection
		})

		// Dispatch to connections
		await this.dispatch('INTERACTION_CREATE', (payload as GatewayPayload).d)

		mockLogger.debug(`Session ${this.id} dispatched select menu: ${options.customId} with values [${options.values.join(', ')}]`)

		return interaction
	}

	/**
	 * Dispatch an INTERACTION_CREATE event for a modal submit (Phase 3E)
	 * Creates an interaction in state and dispatches it to connected bots
	 *
	 * @param options - Modal submit options
	 * @returns The created interaction
	 */
	async dispatchModalSubmit(options: DispatchModalSubmitOptions): Promise<MockInteraction> {
		if (this.ending) {
			throw new Error(`Cannot dispatch to ending session: ${this.id}`)
		}

		// Resolve message if provided (links to original interaction that opened modal)
		let message: MockMessage | undefined
		if (options.messageId) {
			message = this.state.messages.get(options.messageId)
			if (!message) {
				throw new Error(`Message ${options.messageId} not found in session state`)
			}
		}

		// Get or create user
		let user: MockUser
		if (options.user?.id) {
			const existingUser = this.state.getUser(options.user.id)
			if (existingUser) {
				user = existingUser
			} else {
				user = createMockUser(options.user)
				this.state.addUser(user)
			}
		} else {
			user = this.state.getOrCreateTestUser()
		}

		// Resolve channel - use provided channelId, derive from message, or get first available
		let channelId = options.channelId
		if (!channelId && message) {
			channelId = message.channelId
		}
		if (!channelId) {
			const firstChannel = this.state.channels.values().next().value
			if (!firstChannel) {
				throw new Error('No channel available for modal submit. Please provide channelId or create a channel first.')
			}
			channelId = firstChannel.id
		}

		// Derive guildId from channel or message if not specified
		let guildId = options.guildId
		if (!guildId && message?.guildId) {
			guildId = message.guildId
		}
		if (!guildId) {
			const channel = this.state.channels.get(channelId)
			if (channel?.guildId) {
				guildId = channel.guildId
			}
		}

		// Create interaction
		const now = Date.now()
		const interaction: MockInteraction = {
			id: generateSnowflake(),
			applicationId: this.state.applicationId,
			type: 5, // InteractionType.ModalSubmit
			token: generateInteractionToken(),
			channelId,
			guildId,
			userId: user.id,
			customId: options.customId,
			modalFields: options.fields,
			messageId: options.messageId, // Link to original message if provided
			createdAt: now,
			expiresAt: now + 15 * 60 * 1000 // 15 minutes
		}

		// Store interaction
		this.state.addInteraction(interaction)

		// Build payload
		const payload = buildModalSubmitInteractionPayload({
			interaction,
			user,
			sessionState: this.state,
			sequence: 0, // Will be set per-connection
			message // Include message to link to original interaction
		})

		// Dispatch to connections
		await this.dispatch('INTERACTION_CREATE', (payload as GatewayPayload).d)

		mockLogger.debug(`Session ${this.id} dispatched modal submit: ${options.customId} with ${Object.keys(options.fields).length} fields`)

		return interaction
	}

	/**
	 * Dispatch an INTERACTION_CREATE event for autocomplete (Phase 3F)
	 * Creates an autocomplete interaction for testing bot autocomplete handlers
	 *
	 * @param options - Autocomplete options including focused option
	 * @returns The created interaction
	 */
	async dispatchAutocomplete(options: DispatchAutocompleteOptions): Promise<MockInteraction> {
		if (this.ending) {
			throw new Error(`Cannot dispatch to ending session: ${this.id}`)
		}

		// Get or create user (same pattern as other dispatch methods)
		let user: MockUser
		if (options.user?.id) {
			const existingUser = this.state.getUser(options.user.id)
			if (existingUser) {
				user = existingUser
			} else {
				user = createMockUser(options.user)
				this.state.addUser(user)
			}
		} else {
			user = this.state.getOrCreateTestUser()
		}

		// Resolve channel
		let channelId = options.channelId
		if (!channelId) {
			const firstGuild = this.state.guilds.values().next().value
			if (firstGuild && firstGuild.channels.length > 0) {
				channelId = firstGuild.channels[0]
			}
		}
		if (!channelId) {
			throw new Error('No channel specified and no channels available in session state')
		}

		// Get guild ID from channel if not specified
		const channel = this.state.getChannel(channelId)
		const guildId = options.guildId ?? channel?.guildId

		// Build options array with focused option
		const interactionOptions: MockInteractionOption[] = []

		// Add the focused option (required for autocomplete)
		interactionOptions.push({
			name: options.focusedOption.name,
			type: options.focusedOption.type ?? 3, // Default to STRING
			value: options.focusedOption.value,
			focused: true
		})

		// Add any other pre-filled options
		if (options.options) {
			for (const [name, value] of Object.entries(options.options)) {
				if (name !== options.focusedOption.name) {
					// Don't duplicate focused option
					interactionOptions.push({
						name,
						type: typeof value === 'string' ? 3 : typeof value === 'number' ? 4 : 5,
						value
					})
				}
			}
		}

		// Create interaction
		const now = Date.now()
		const interaction: MockInteraction = {
			id: generateSnowflake(),
			applicationId: this.state.applicationId,
			type: 4, // InteractionType.ApplicationCommandAutocomplete
			token: generateInteractionToken(),
			channelId,
			guildId,
			userId: user.id,
			commandName: options.commandName,
			commandId: generateSnowflake(),
			options: interactionOptions,
			createdAt: now,
			expiresAt: now + 15 * 60 * 1000
		}

		// Store interaction
		this.state.addInteraction(interaction)

		// Build payload
		const payload = buildAutocompleteInteractionPayload({
			interaction,
			user,
			sessionState: this.state,
			sequence: 0
		})

		// Dispatch to connections
		await this.dispatch('INTERACTION_CREATE', (payload as GatewayPayload).d)

		mockLogger.debug(`Session ${this.id} dispatched autocomplete: /${options.commandName} option:${options.focusedOption.name}`)

		return interaction
	}

	/**
	 * Dispatch an INTERACTION_CREATE event for a context menu command (Phase 3G)
	 * Creates an interaction in state and dispatches it to connected bots
	 *
	 * @param options - Context menu command options
	 * @returns The created interaction
	 */
	async dispatchContextMenu(options: DispatchContextMenuOptions): Promise<MockInteraction> {
		if (this.ending) {
			throw new Error(`Cannot dispatch to ending session: ${this.id}`)
		}

		// Get or create invoking user
		let user: MockUser
		if (options.user?.id) {
			const existingUser = this.state.getUser(options.user.id)
			if (existingUser) {
				user = existingUser
			} else {
				user = createMockUser(options.user)
				this.state.addUser(user)
			}
		} else {
			user = this.state.getOrCreateTestUser()
		}

		// Resolve target based on command type
		let targetUser: MockUser | undefined
		let targetMessage: MockMessage | undefined
		let channelId = options.channelId
		let guildId = options.guildId

		if (options.contextMenuType === 2) {
			// USER command - target is a user
			targetUser = this.state.getUser(options.targetId)
			if (!targetUser) {
				// Create a mock target user if not found
				targetUser = createMockUser({ id: options.targetId, username: 'TargetUser' })
				this.state.addUser(targetUser)
			}
			// For user commands, channel may be optional (guild context)
			if (!channelId) {
				const firstGuild = this.state.guilds.values().next().value
				if (firstGuild && firstGuild.channels.length > 0) {
					channelId = firstGuild.channels[0]
				}
			}
		} else if (options.contextMenuType === 3) {
			// MESSAGE command - target is a message
			targetMessage = this.state.getMessage(options.targetId)
			if (!targetMessage) {
				throw new Error(`Target message not found: ${options.targetId}`)
			}
			// Derive channel and guild from target message
			channelId = channelId ?? targetMessage.channelId
			guildId = guildId ?? targetMessage.guildId
		}

		if (!channelId) {
			throw new Error('No channel specified and cannot derive from context')
		}

		// Get guild ID from channel if not specified
		if (!guildId) {
			const channel = this.state.getChannel(channelId)
			guildId = channel?.guildId
		}

		// Create interaction
		const now = Date.now()
		const interaction: MockInteraction = {
			id: generateSnowflake(),
			applicationId: this.state.applicationId,
			type: 2, // InteractionType.ApplicationCommand (context menus are still APPLICATION_COMMAND)
			token: generateInteractionToken(),
			channelId,
			guildId,
			userId: user.id,
			commandName: options.commandName,
			commandId: generateSnowflake(),
			targetId: options.targetId,
			contextMenuType: options.contextMenuType,
			createdAt: now,
			expiresAt: now + 15 * 60 * 1000 // 15 minutes
		}

		// Store interaction
		this.state.addInteraction(interaction)

		// Build payload
		const payload = buildContextMenuInteractionPayload({
			interaction,
			user,
			targetUser,
			targetMessage,
			sessionState: this.state,
			sequence: 0 // Will be set per-connection
		})

		// Dispatch to connections
		await this.dispatch('INTERACTION_CREATE', (payload as GatewayPayload).d)

		const typeLabel = options.contextMenuType === 2 ? 'user' : 'message'
		mockLogger.debug(`Session ${this.id} dispatched ${typeLabel} context menu: ${options.commandName}`)

		return interaction
	}

	// ============================================================================
	// Thread Dispatch Methods (Phase 4D)
	// ============================================================================

	/**
	 * Dispatch a THREAD_CREATE event
	 * Creates a thread in state and dispatches it to connected bots
	 *
	 * @param options - Thread creation options
	 * @returns The created thread
	 */
	async dispatchThreadCreate(options: DispatchThreadCreateOptions): Promise<MockThread> {
		if (this.ending) {
			throw new Error(`Cannot dispatch to ending session: ${this.id}`)
		}

		// Validate parent channel exists
		const parentChannel = this.state.getChannel(options.parentChannelId)
		if (!parentChannel) {
			throw new Error(`Parent channel not found: ${options.parentChannelId}`)
		}

		// Validate parent channel type (must be text or announcement)
		if (parentChannel.type !== 0 && parentChannel.type !== 5) {
			throw new Error(`Cannot create thread in channel type ${parentChannel.type}. Must be text (0) or announcement (5)`)
		}

		// Get or create owner user
		let owner: MockUser
		if (options.user?.id) {
			const existingUser = this.state.getUser(options.user.id)
			if (existingUser) {
				owner = existingUser
			} else {
				owner = createMockUser(options.user)
				this.state.addUser(owner)
			}
		} else {
			owner = this.state.getOrCreateTestUser()
		}

		// Determine thread type based on parent channel or explicit type
		const threadType = options.type ?? (parentChannel.type === 5 ? 10 : 11) // Announcement thread or public thread

		// Create thread in state
		const thread = this.state.createThread({
			name: options.name,
			type: threadType,
			parentId: options.parentChannelId,
			ownerId: owner.id,
			autoArchiveDuration: options.autoArchiveDuration,
			invitable: options.invitable
		})

		// Build payload
		const payload = buildThreadCreatePayload({
			thread,
			sessionState: this.state,
			sequence: 0, // Will be set per-connection
			newlyCreated: true
		})

		// Record the action
		this.recorder.record('thread_created', {
			threadId: thread.id,
			name: thread.name,
			type: thread.type,
			parentId: thread.parentId,
			ownerId: owner.id
		})

		// Dispatch to connections
		await this.dispatch('THREAD_CREATE', (payload as GatewayPayload).d)

		mockLogger.debug(`Session ${this.id} dispatched thread create: ${options.name}`)

		return thread
	}

	/**
	 * Dispatch a THREAD_UPDATE event
	 * Updates thread metadata and dispatches the change
	 *
	 * @param threadId - ID of the thread to update
	 * @param updates - Thread updates (name, archived, locked, etc.)
	 * @returns The updated thread
	 */
	async dispatchThreadUpdate(
		threadId: string,
		updates: {
			name?: string
			archived?: boolean
			locked?: boolean
			autoArchiveDuration?: 60 | 1440 | 4320 | 10080
			invitable?: boolean
		}
	): Promise<MockThread> {
		if (this.ending) {
			throw new Error(`Cannot dispatch to ending session: ${this.id}`)
		}

		// Update thread in state
		const thread = this.state.updateThread(threadId, {
			name: updates.name,
			archived: updates.archived,
			locked: updates.locked,
			auto_archive_duration: updates.autoArchiveDuration,
			invitable: updates.invitable
		})

		if (!thread) {
			throw new Error(`Thread not found: ${threadId}`)
		}

		// Build payload
		const payload = buildThreadUpdatePayload({
			thread,
			sessionState: this.state,
			sequence: 0
		})

		// Record the action
		this.recorder.record('thread_updated', {
			threadId: thread.id,
			updates
		})

		// Dispatch to connections
		await this.dispatch('THREAD_UPDATE', (payload as GatewayPayload).d)

		mockLogger.debug(`Session ${this.id} dispatched thread update: ${thread.name}`)

		return thread
	}

	/**
	 * Dispatch a THREAD_DELETE event
	 * Deletes a thread and dispatches the event
	 *
	 * @param threadId - ID of the thread to delete
	 */
	async dispatchThreadDelete(threadId: string): Promise<void> {
		if (this.ending) {
			throw new Error(`Cannot dispatch to ending session: ${this.id}`)
		}

		// Get thread before deleting
		const thread = this.state.getThread(threadId)
		if (!thread) {
			throw new Error(`Thread not found: ${threadId}`)
		}

		// Store info for payload before deletion
		const { guildId, parentId, type } = thread

		// Delete from state
		this.state.deleteThread(threadId)

		// Build payload
		const payload = buildThreadDeletePayload({
			threadId,
			guildId: guildId!,
			parentId: parentId!,
			type: type as 10 | 11 | 12,
			sequence: 0
		})

		// Record the action
		this.recorder.record('thread_deleted', {
			threadId,
			guildId,
			parentId,
			type
		})

		// Dispatch to connections
		await this.dispatch('THREAD_DELETE', (payload as GatewayPayload).d)

		mockLogger.debug(`Session ${this.id} dispatched thread delete: ${threadId}`)
	}

	/**
	 * Dispatch THREAD_MEMBER_UPDATE for bot joining a thread
	 *
	 * @param threadId - ID of the thread to join
	 */
	async dispatchThreadJoin(threadId: string): Promise<void> {
		if (this.ending) {
			throw new Error(`Cannot dispatch to ending session: ${this.id}`)
		}

		const thread = this.state.getThread(threadId)
		if (!thread) {
			throw new Error(`Thread not found: ${threadId}`)
		}

		// Add bot user to thread
		const member = this.state.addThreadMember(threadId, this.state.botUser.id)
		if (!member) {
			throw new Error(`Failed to add bot to thread: ${threadId}`)
		}

		// Build payload
		const payload = buildThreadMemberUpdatePayload({
			threadId,
			guildId: thread.guildId!,
			member,
			sequence: 0
		})

		// Record the action
		this.recorder.record('thread_member_added', {
			threadId,
			userId: this.state.botUser.id
		})

		// Dispatch to connections
		await this.dispatch('THREAD_MEMBER_UPDATE', (payload as GatewayPayload).d)

		mockLogger.debug(`Session ${this.id} bot joined thread: ${threadId}`)
	}

	/**
	 * Dispatch THREAD_MEMBER_UPDATE for bot leaving a thread
	 *
	 * @param threadId - ID of the thread to leave
	 */
	async dispatchThreadLeave(threadId: string): Promise<void> {
		if (this.ending) {
			throw new Error(`Cannot dispatch to ending session: ${this.id}`)
		}

		const thread = this.state.getThread(threadId)
		if (!thread) {
			throw new Error(`Thread not found: ${threadId}`)
		}

		// Get member info before removal
		const member = this.state.getThreadMember(threadId, this.state.botUser.id)
		if (!member) {
			mockLogger.warn(`Bot is not a member of thread: ${threadId}`)
			return
		}

		// Remove bot from thread
		this.state.removeThreadMember(threadId, this.state.botUser.id)

		// Note: Discord doesn't send THREAD_MEMBER_UPDATE on leave, only on join
		// Instead, THREAD_MEMBERS_UPDATE is sent if GuildMembers intent is enabled
		// For the bot's own membership, the thread simply becomes "invisible"

		// Record the action
		this.recorder.record('thread_member_removed', {
			threadId,
			userId: this.state.botUser.id
		})

		mockLogger.debug(`Session ${this.id} bot left thread: ${threadId}`)
	}

	/**
	 * Dispatch THREAD_MEMBERS_UPDATE for adding a user to a thread
	 * This is for testing - simulates another user being added
	 *
	 * @param threadId - ID of the thread
	 * @param userId - ID of the user to add
	 */
	async dispatchThreadMemberAdd(threadId: string, userId: string): Promise<void> {
		if (this.ending) {
			throw new Error(`Cannot dispatch to ending session: ${this.id}`)
		}

		const thread = this.state.getThread(threadId)
		if (!thread) {
			throw new Error(`Thread not found: ${threadId}`)
		}

		// Add user to thread
		const member = this.state.addThreadMember(threadId, userId)
		if (!member) {
			throw new Error(`Failed to add user to thread: ${threadId}`)
		}

		// Build payload (THREAD_MEMBERS_UPDATE for other users)
		const payload = buildThreadMembersUpdatePayload({
			threadId,
			guildId: thread.guildId!,
			memberCount: thread.memberCount,
			addedMembers: [member],
			sequence: 0
		})

		// Record the action
		this.recorder.record('thread_member_added', {
			threadId,
			userId
		})

		// Dispatch to connections
		await this.dispatch('THREAD_MEMBERS_UPDATE', (payload as GatewayPayload).d)

		mockLogger.debug(`Session ${this.id} added user ${userId} to thread: ${threadId}`)
	}

	/**
	 * Dispatch THREAD_MEMBERS_UPDATE for removing a user from a thread
	 * This is for testing - simulates another user being removed
	 *
	 * @param threadId - ID of the thread
	 * @param userId - ID of the user to remove
	 */
	async dispatchThreadMemberRemove(threadId: string, userId: string): Promise<void> {
		if (this.ending) {
			throw new Error(`Cannot dispatch to ending session: ${this.id}`)
		}

		const thread = this.state.getThread(threadId)
		if (!thread) {
			throw new Error(`Thread not found: ${threadId}`)
		}

		// Check if user is a member
		const member = this.state.getThreadMember(threadId, userId)
		if (!member) {
			mockLogger.warn(`User ${userId} is not a member of thread: ${threadId}`)
			return
		}

		// Remove user from thread
		this.state.removeThreadMember(threadId, userId)

		// Build payload
		const payload = buildThreadMembersUpdatePayload({
			threadId,
			guildId: thread.guildId!,
			memberCount: thread.memberCount,
			removedMemberIds: [userId],
			sequence: 0
		})

		// Record the action
		this.recorder.record('thread_member_removed', {
			threadId,
			userId
		})

		// Dispatch to connections
		await this.dispatch('THREAD_MEMBERS_UPDATE', (payload as GatewayPayload).d)

		mockLogger.debug(`Session ${this.id} removed user ${userId} from thread: ${threadId}`)
	}

	/**
	 * Dispatch THREAD_LIST_SYNC for syncing active threads
	 * Sent when bot gains access to channels
	 *
	 * @param guildId - ID of the guild
	 * @param channelIds - Optional specific channel IDs to sync (if not provided, syncs all)
	 */
	async dispatchThreadListSync(guildId: string, channelIds?: string[]): Promise<void> {
		if (this.ending) {
			throw new Error(`Cannot dispatch to ending session: ${this.id}`)
		}

		// Get all active threads for the guild (or specific channels)
		let threads = this.state.getActiveThreadsForGuild(guildId)
		if (channelIds && channelIds.length > 0) {
			threads = threads.filter((t) => channelIds.includes(t.parentId))
		}

		// Get bot's membership in these threads
		const members = threads
			.map((t) => this.state.getThreadMember(t.id, this.state.botUser.id))
			.filter((m) => m !== undefined)

		// Build payload
		const payload = buildThreadListSyncPayload({
			guildId,
			channelIds,
			threads,
			members: members as NonNullable<typeof members[number]>[],
			sequence: 0
		})

		// Dispatch to connections
		await this.dispatch('THREAD_LIST_SYNC', (payload as GatewayPayload).d)

		mockLogger.debug(`Session ${this.id} dispatched thread list sync: ${threads.length} threads`)
	}

	/**
	 * Record an action from the bot (REST API call, Gateway message, etc.)
	 */
	recordAction(type: ActionType, data: unknown, options?: RecordActionOptions): RecordedAction {
		return this.recorder.record(type, data, options)
	}

	/**
	 * Get all recorded actions for test assertions
	 */
	getActions(): RecordedAction[] {
		return this.recorder.getAll()
	}

	/**
	 * Get actions since a specific timestamp
	 */
	getActionsSince(timestamp: number): RecordedAction[] {
		return this.recorder.getSince(timestamp)
	}

	/**
	 * Get actions by type
	 */
	getActionsByType(type: ActionType): RecordedAction[] {
		return this.recorder.getByType(type)
	}

	/**
	 * Get message_sent actions
	 */
	getMessagesSent(): RecordedAction[] {
		return this.recorder.getMessagesSent()
	}

	/**
	 * Get all interaction response actions
	 */
	getInteractionResponses(): RecordedAction[] {
		return this.recorder.getInteractionResponses()
	}

	/**
	 * Get all REST request actions
	 */
	getRestRequests(): RecordedAction[] {
		return this.recorder.getRestRequests()
	}

	/**
	 * Get all Gateway WebSocket message actions (client → server)
	 */
	getGatewayMessages(): RecordedAction[] {
		return this.recorder.getGatewayMessages()
	}

	/**
	 * Get dispatch events (server → client)
	 */
	getDispatches(): RecordedAction[] {
		return this.recorder.getDispatches()
	}

	/**
	 * Clear recorded actions without resetting state
	 */
	clearActions(): void {
		this.recorder.clear()
	}

	/**
	 * Get the number of recorded actions
	 */
	get actionCount(): number {
		return this.recorder.length
	}

	// ============================================================================
	// Recording Export (Phase 4A)
	// ============================================================================

	/**
	 * Export the session as a recording object
	 * Returns a JSON-serializable recording with metadata and all actions
	 */
	exportRecording(): SessionRecording {
		const now = Date.now()

		return {
			version: 1,
			metadata: {
				sessionId: this.id,
				sessionName: this.name,
				startTime: this.createdAt,
				endTime: now,
				duration: now - this.createdAt,
				actionCount: this.recorder.length,
				botUser: {
					id: this.state.botUser.id,
					username: this.state.botUser.username
				},
				applicationId: this.state.applicationId,
				recordedAt: new Date(now).toISOString()
			},
			initialConfig: this.captureInitialConfig(),
			actions: this.recorder.getAll()
		}
	}

	/**
	 * Save the recording to a JSON file
	 * @param filePath - Path to save the recording
	 */
	async saveRecording(filePath: string): Promise<void> {
		const fs = await import('node:fs/promises')
		const recording = this.exportRecording()
		await fs.writeFile(filePath, JSON.stringify(recording, null, 2))
		mockLogger.info(`Recording saved: ${filePath}`)
	}

	/**
	 * Capture current state as initial config for replay
	 */
	private captureInitialConfig(): SessionConfig {
		return {
			botUser: {
				id: this.state.botUser.id,
				username: this.state.botUser.username,
				discriminator: this.state.botUser.discriminator,
				globalName: this.state.botUser.globalName,
				avatar: this.state.botUser.avatar,
				bot: this.state.botUser.bot
			},
			applicationId: this.state.applicationId,
			guilds: Array.from(this.state.guilds.values()).map((g) => ({
				id: g.id,
				name: g.name,
				ownerId: g.ownerId,
				channels: Array.from(this.state.channels.values())
					.filter((c) => c.guildId === g.id)
					.map((c) => ({
						id: c.id,
						name: c.name,
						type: c.type,
						parentId: c.parentId
					}))
			})),
			maxActions: this.recorder.maxLength
		}
	}

	/**
	 * Reset session state (clear guilds, channels, etc. but keep bot user)
	 */
	reset(): void {
		this.state.reset()
		this.recorder.clear()

		mockLogger.debug(`Session reset: ${this.id}`)
	}

	// ============================================================================
	// Auto-Archive (Phase 4D)
	// ============================================================================

	/**
	 * Start automatic thread archiving based on auto_archive_duration
	 * @param intervalMs - How often to check for inactive threads (default: 60000ms / 1 minute)
	 */
	startAutoArchive(intervalMs: number = 60000): void {
		if (this.autoArchiveInterval) {
			return // Already running
		}

		this.autoArchiveInterval = setInterval(async () => {
			await this.runAutoArchiveCheck()
		}, intervalMs)

		mockLogger.debug(`Session ${this.id}: Auto-archive started (interval: ${intervalMs}ms)`)
	}

	/**
	 * Stop automatic thread archiving
	 */
	stopAutoArchive(): void {
		if (this.autoArchiveInterval) {
			clearInterval(this.autoArchiveInterval)
			this.autoArchiveInterval = null
			mockLogger.debug(`Session ${this.id}: Auto-archive stopped`)
		}
	}

	/**
	 * Manually run auto-archive check and dispatch THREAD_UPDATE for archived threads
	 * @returns Array of archived thread IDs
	 */
	async runAutoArchiveCheck(): Promise<string[]> {
		const archivedIds = this.state.checkAutoArchiveThreads()

		// Dispatch THREAD_UPDATE for each archived thread
		for (const threadId of archivedIds) {
			const thread = this.state.getThread(threadId)
			if (thread) {
				const payload = buildThreadUpdatePayload({
					thread,
					sequence: this.state.nextSequence()
				})
				await this.dispatch('THREAD_UPDATE', payload.d)

				mockLogger.debug(`Session ${this.id}: Thread ${threadId} auto-archived`)
			}
		}

		return archivedIds
	}

	/**
	 * End the session and clean up resources
	 */
	async end(): Promise<void> {
		if (this.ending) {
			return
		}

		this.ending = true
		mockLogger.debug(`Session ending: ${this.id}`)

		// Stop auto-archive interval
		this.stopAutoArchive()

		// Close all connections (will be implemented in future phases)
		for (const _conn of this.connections.values()) {
			// _conn.socket.close() - when WebSocket is implemented
		}
		this.connections.clear()

		// Clear state using the reset method
		this.state.reset()

		// Clear recorded actions
		this.recorder.clear()

		mockLogger.debug(`Session ended: ${this.id}`)
	}
}
