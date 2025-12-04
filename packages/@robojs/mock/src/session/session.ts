import type {
	Session as ISession,
	SessionState,
	ConnectionState,
	CreateSessionOptions,
	RecordedAction
} from '../types/index.js'
import { generateSessionId, createMockToken } from '../utils/id.js'
import { createSessionState } from './state.js'
import { mockLogger } from '../core/logger.js'

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
	readonly state: SessionState
	readonly connections: Map<string, ConnectionState>

	private recordedActions: RecordedAction[] = []
	private ending = false

	constructor(options?: CreateSessionOptions) {
		this.id = generateSessionId()
		this.token = createMockToken(this.id)
		this.name = options?.name
		this.createdAt = Date.now()
		this.expiresAt = this.createdAt + (options?.ttl ?? DEFAULT_TTL)
		this.connections = new Map()

		// Initialize state with optional configuration
		this.state = createSessionState({
			botUser: options?.config?.botUser,
			applicationId: options?.config?.applicationId
		})

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
	 * This will be expanded in future phases for Gateway events
	 */
	async dispatch(event: string, data: unknown): Promise<void> {
		if (this.ending) {
			mockLogger.warn(`Cannot dispatch to ending session: ${this.id}`)
			return
		}

		// Increment sequence number
		this.state.sequence++

		// Record the dispatched event
		this.recordedActions.push({
			timestamp: Date.now(),
			type: `DISPATCH:${event}`,
			data
		})

		mockLogger.debug(`Session ${this.id} dispatched: ${event} (seq: ${this.state.sequence})`)

		// In future phases, this will send to WebSocket connections
	}

	/**
	 * Record an action from the bot (REST API call, etc.)
	 */
	recordAction(type: string, data: unknown): void {
		this.recordedActions.push({
			timestamp: Date.now(),
			type,
			data
		})
	}

	/**
	 * Get all recorded actions for test assertions
	 */
	getActions(): RecordedAction[] {
		return [...this.recordedActions]
	}

	/**
	 * Get actions since a specific timestamp
	 */
	getActionsSince(timestamp: number): RecordedAction[] {
		return this.recordedActions.filter((a) => a.timestamp >= timestamp)
	}

	/**
	 * Reset session state (clear guilds, channels, etc. but keep bot user)
	 */
	reset(): void {
		const botUser = this.state.botUser
		const applicationId = this.state.applicationId

		this.state.guilds.clear()
		this.state.channels.clear()
		this.state.users.clear()
		this.state.users.set(botUser.id, botUser)
		this.state.sequence = 0

		this.recordedActions = []

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
		for (const conn of this.connections.values()) {
			// conn.socket.close() - when WebSocket is implemented
		}
		this.connections.clear()

		// Clear state
		this.state.guilds.clear()
		this.state.channels.clear()
		this.state.users.clear()

		// Clear recorded actions
		this.recordedActions = []

		mockLogger.debug(`Session ended: ${this.id}`)
	}
}
