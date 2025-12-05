import type { CreateSessionOptions, SessionManagerOptions, SessionStorage } from '../types/index.js'
import { Session } from './session.js'
import { InMemoryStorage } from './storage.js'
import { parseMockToken } from '../utils/id.js'
import { mockLogger } from '../core/logger.js'

// Default cleanup interval: 60 seconds
const DEFAULT_CLEANUP_INTERVAL = 60 * 1000

/**
 * Manages session lifecycle and storage
 */
export class SessionManager {
	private storage: SessionStorage
	private cleanupInterval: ReturnType<typeof setInterval> | null = null
	private destroyed = false

	constructor(options?: SessionManagerOptions) {
		this.storage = options?.storage ?? new InMemoryStorage()

		// Start cleanup interval
		const intervalMs = options?.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL
		this.cleanupInterval = setInterval(() => this.cleanupExpired(), intervalMs)

		// Ensure cleanup doesn't prevent process from exiting
		if (this.cleanupInterval.unref) {
			this.cleanupInterval.unref()
		}

		mockLogger.debug('SessionManager initialized')
	}

	/**
	 * Create a new isolated session
	 */
	async create(options?: CreateSessionOptions): Promise<Session> {
		if (this.destroyed) {
			throw new Error('SessionManager has been destroyed')
		}

		const session = new Session(options)
		this.storage.set(session.id, session)

		mockLogger.info(`Session created: ${session.id}${session.name ? ` (${session.name})` : ''}`)

		return session
	}

	/**
	 * Get a session by ID
	 */
	get(sessionId: string): Session | undefined {
		const session = this.storage.get(sessionId)

		// Check if session exists and is not expired
		if (session && session.isExpired) {
			mockLogger.debug(`Session expired: ${sessionId}`)
			this.delete(sessionId).catch(() => {})
			return undefined
		}

		return session as Session | undefined
	}

	/**
	 * Get a session by token (parses "mock:<session_id>" format)
	 */
	getByToken(token: string): Session | undefined {
		const sessionId = parseMockToken(token)
		if (!sessionId) {
			return undefined
		}
		return this.get(sessionId)
	}

	/**
	 * Delete a session
	 */
	async delete(sessionId: string): Promise<boolean> {
		const session = this.storage.get(sessionId)
		if (!session) {
			return false
		}

		// End the session (cleanup connections, state)
		await (session as Session).end()

		// Remove from storage
		this.storage.delete(sessionId)

		mockLogger.info(`Session deleted: ${sessionId}`)

		return true
	}

	/**
	 * Get all active sessions
	 */
	getAll(): Session[] {
		const sessions: Session[] = []
		for (const session of this.storage.values()) {
			if (!session.isExpired && !session.isEnding) {
				sessions.push(session as Session)
			}
		}
		return sessions
	}

	/**
	 * Find a session containing an interaction with the given token
	 * Used by interaction callback endpoint to route responses to correct session
	 */
	findSessionByInteractionToken(token: string): Session | undefined {
		for (const session of this.storage.values()) {
			if ((session as Session).state.getInteractionByToken(token)) {
				return session as Session
			}
		}
		return undefined
	}

	/**
	 * Get the number of active sessions
	 */
	get size(): number {
		return this.storage.size
	}

	/**
	 * Clean up expired sessions
	 */
	private cleanupExpired(): void {
		if (this.destroyed) {
			return
		}

		const now = Date.now()
		const toDelete: string[] = []

		for (const session of this.storage.values()) {
			if (now > session.expiresAt) {
				toDelete.push(session.id)
			}
		}

		if (toDelete.length > 0) {
			mockLogger.debug(`Cleaning up ${toDelete.length} expired session(s)`)
			for (const id of toDelete) {
				this.delete(id).catch((err) => {
					mockLogger.error(`Failed to delete expired session ${id}:`, err)
				})
			}
		}
	}

	/**
	 * Destroy the session manager and clean up all resources
	 */
	async destroy(): Promise<void> {
		if (this.destroyed) {
			return
		}

		this.destroyed = true
		mockLogger.debug('SessionManager destroying...')

		// Stop cleanup interval
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval)
			this.cleanupInterval = null
		}

		// End all sessions
		const sessions = Array.from(this.storage.values())
		await Promise.all(sessions.map((s) => (s as Session).end()))

		// Clear storage
		this.storage.clear()

		mockLogger.info('SessionManager destroyed')
	}
}
