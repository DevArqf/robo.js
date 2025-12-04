import type { Session as ISession, ConnectionState, CreateSessionOptions, RecordedAction, ActionType, RecordActionOptions, MockMessage, MockUser } from '../types/index.js'
import { generateSessionId, createMockToken } from '../utils/id.js'
import { MockServerState, createDefaultGuildWithChannel, createMockUser, createMockMessage } from './state.js'
import { ActionRecorder } from './recorder.js'
import { mockLogger } from '../core/logger.js'
import { getGatewayServer } from '../core/gateway.js'
import { buildMessageCreatePayload, type GatewayPayload } from '../discord/payloads.js'

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
