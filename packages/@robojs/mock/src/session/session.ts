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
	DispatchSlashCommandOptions,
	DispatchButtonClickOptions,
	DispatchSelectMenuOptions,
	DispatchModalSubmitOptions,
	DispatchAutocompleteOptions,
	DispatchContextMenuOptions
} from '../types/index.js'
import { generateSessionId, createMockToken, generateInteractionToken } from '../utils/id.js'
import { generateSnowflake } from '../utils/snowflake.js'
import { MockServerState, createDefaultGuildWithChannel, createMockUser, createMockMessage } from './state.js'
import { ActionRecorder } from './recorder.js'
import { mockLogger } from '../core/logger.js'
import { getGatewayServer } from '../core/gateway.js'
import { buildMessageCreatePayload, buildInteractionCreatePayload, buildButtonInteractionPayload, buildSelectMenuInteractionPayload, buildModalSubmitInteractionPayload, buildAutocompleteInteractionPayload, buildContextMenuInteractionPayload, type GatewayPayload } from '../discord/payloads.js'

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

	/**
	 * Reset session state (clear guilds, channels, etc. but keep bot user)
	 */
	reset(): void {
		this.state.reset()
		this.recorder.clear()

		mockLogger.debug(`Session reset: ${this.id}`)
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
