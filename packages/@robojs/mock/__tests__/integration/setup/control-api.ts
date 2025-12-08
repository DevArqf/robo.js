/**
 * Control API Helpers
 *
 * Utilities for interacting with the mock server's control API.
 * These helpers make it easy to create sessions, dispatch events,
 * and control server behavior during tests.
 */

import { MOCK_CONFIG } from './constants.js'

/**
 * Session response from creating a new session
 */
export interface SessionResponse {
	session_id: string
	token: string
	expires_at: number
}

/**
 * Session state response
 */
export interface SessionState {
	botUser: {
		id: string
		username: string
		discriminator: string
		bot: boolean
	}
	guilds: Array<{
		id: string
		name: string
		ownerId: string
		channels: string[]
		members: string[]
		roles: string[]
	}>
	channels: Array<{
		id: string
		guildId?: string
		name: string
		type: number
	}>
}

/**
 * Configuration for creating a session
 */
export interface CreateSessionConfig {
	name?: string
	ttl?: number
	config?: {
		botUser?: { username?: string; id?: string }
		guilds?: Array<{
			id?: string
			name?: string
			channels?: Array<{ name?: string; type?: number }>
		}>
		enforceIntents?: boolean
		approvedPrivilegedIntents?: bigint
		permissionEnforcement?: 'none' | 'basic' | 'strict'
	}
}

/**
 * Custom JSON serializer that handles BigInt values
 */
function serializeBody(body: unknown): string {
	return JSON.stringify(body, (_key, value) => {
		// Convert BigInt to string for JSON serialization
		if (typeof value === 'bigint') {
			return value.toString()
		}
		return value
	})
}

/**
 * Make a request to the control API
 *
 * @param endpoint - API endpoint (without /api/control prefix)
 * @param options - Fetch options
 * @returns Response data
 */
export async function controlAPI<T = unknown>(
	endpoint: string,
	options: {
		method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
		body?: unknown
	} = {}
): Promise<T> {
	const url = `${MOCK_CONFIG.CONTROL_URL}${endpoint}`
	const response = await fetch(url, {
		method: options.method ?? 'GET',
		headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
		body: options.body ? serializeBody(options.body) : undefined
	})

	if (!response.ok) {
		const text = await response.text()
		throw new Error(`Control API error: ${response.status} - ${text}`)
	}

	return response.json() as Promise<T>
}

/**
 * Create a new test session
 *
 * @param config - Session configuration
 * @returns Session info including ID and token
 */
export async function createSession(config: CreateSessionConfig = {}): Promise<{
	id: string
	token: string
	botUser: { id: string; username: string }
	guilds: Array<{ id: string; name: string }>
	channels: Array<{ id: string; name: string; guildId?: string }>
}> {
	// Create the session
	const createResponse = await controlAPI<SessionResponse>('/sessions', {
		method: 'POST',
		body: config
	})

	// Fetch the session state for full details
	const state = await controlAPI<SessionState>(`/sessions/${createResponse.session_id}/state`)

	return {
		id: createResponse.session_id,
		token: createResponse.token,
		botUser: {
			id: state.botUser.id,
			username: state.botUser.username
		},
		guilds: state.guilds.map((g) => ({ id: g.id, name: g.name })),
		channels: state.channels.map((c) => ({ id: c.id, name: c.name, guildId: c.guildId }))
	}
}

/**
 * Reset a session to its initial state
 *
 * @param sessionId - Session ID to reset
 */
export async function resetSession(sessionId: string): Promise<void> {
	await controlAPI(`/sessions/${sessionId}/reset`, { method: 'POST' })
}

/**
 * Delete a session
 *
 * @param sessionId - Session ID to delete
 */
export async function deleteSession(sessionId: string): Promise<void> {
	await controlAPI(`/sessions/${sessionId}`, { method: 'DELETE' })
}

/**
 * Dispatch an event to a session
 *
 * @param sessionId - Session ID to dispatch to
 * @param event - Event name (e.g., "MESSAGE_CREATE")
 * @param data - Event data
 * @returns Dispatch result
 */
export async function dispatchEvent(
	sessionId: string,
	event: string,
	data: Record<string, unknown>
): Promise<{ success: boolean; dispatched: number }> {
	return controlAPI(`/sessions/${sessionId}/dispatch`, {
		method: 'POST',
		body: { event, data }
	})
}

/**
 * Get or set intents for a session
 *
 * @param sessionId - Session ID
 * @param options - Options for setting intents
 * @returns Current intent state
 */
export async function sessionIntents(
	sessionId: string,
	options?: {
		enforceIntents?: boolean
		approvedPrivilegedIntents?: number
	}
): Promise<{
	enforce_intents: boolean
	approved_privileged_intents: string
}> {
	if (options) {
		return controlAPI(`/sessions/${sessionId}/intents`, {
			method: 'POST',
			body: options
		})
	}
	return controlAPI(`/sessions/${sessionId}/intents`)
}

/**
 * Stop heartbeat ACKs for a session (for testing timeout handling)
 *
 * @param sessionId - Session ID
 * @param stop - Whether to stop ACKs (default: true)
 */
export async function stopHeartbeatAcks(
	sessionId: string,
	stop = true
): Promise<{ success: boolean; stop_acks: boolean }> {
	return controlAPI(`/sessions/${sessionId}/heartbeat/stop-acks`, {
		method: 'POST',
		body: { stop }
	})
}

/**
 * Force disconnect gateway connections for a session
 *
 * @param sessionId - Session ID
 * @param closeCode - WebSocket close code (default: 4000)
 * @param reason - Optional close reason
 */
export async function disconnectSession(
	sessionId: string,
	closeCode = 4000,
	reason?: string
): Promise<{ success: boolean; disconnected: number; close_code: number }> {
	return controlAPI(`/sessions/${sessionId}/gateway/disconnect`, {
		method: 'POST',
		body: { close_code: closeCode, reason }
	})
}

/**
 * Invalidate a session (client must send fresh IDENTIFY on reconnect)
 *
 * @param sessionId - Session ID
 */
export async function invalidateSession(sessionId: string): Promise<{ success: boolean; invalidated: boolean }> {
	return controlAPI(`/sessions/${sessionId}/gateway/invalidate-session`, {
		method: 'POST'
	})
}

/**
 * Get session status including connection info
 *
 * @param sessionId - Session ID
 */
export async function getSessionStatus(sessionId: string): Promise<{
	id: string
	token: string
	name?: string
	created_at: number
	expires_at: number
	is_expired: boolean
	connection_count: number
}> {
	return controlAPI(`/sessions/${sessionId}/status`)
}

/**
 * Get recorded actions for a session
 *
 * @param sessionId - Session ID
 * @param options - Filter options
 */
export async function getSessionActions(
	sessionId: string,
	options?: {
		type?: string
		limit?: number
	}
): Promise<{
	actions: Array<{
		id: string
		type: string
		data: unknown
		timestamp: number
	}>
}> {
	const params = new URLSearchParams()
	if (options?.type) params.set('type', options.type)
	if (options?.limit) params.set('limit', String(options.limit))
	const query = params.toString()
	return controlAPI(`/sessions/${sessionId}/actions${query ? `?${query}` : ''}`)
}

/**
 * Set the gateway heartbeat interval for new connections
 *
 * @param interval - Heartbeat interval in milliseconds (100-120000)
 * @returns Current interval setting
 */
export async function setHeartbeatInterval(interval: number): Promise<{ interval: number; success: boolean }> {
	return controlAPI('/gateway/heartbeat-interval', {
		method: 'POST',
		body: { interval }
	})
}

/**
 * Get the current gateway heartbeat interval
 *
 * @returns Current interval setting
 */
export async function getHeartbeatInterval(): Promise<{ interval: number; success: boolean }> {
	return controlAPI('/gateway/heartbeat-interval')
}

// ============================================================================
// Recording & Replay API Helpers
// ============================================================================

/**
 * Recorded action from the session
 */
export interface RecordedAction {
	id: string
	type: string
	data: unknown
	timestamp: number
	sequence?: number
}

/**
 * Session recording export format
 */
export interface SessionRecording {
	version: number
	metadata: {
		sessionId: string
		sessionName?: string
		startTime: number
		endTime: number
		duration: number
		actionCount: number
		botUser: { id: string; username: string }
		applicationId: string
		recordedAt: string
	}
	initialConfig: unknown
	actions: RecordedAction[]
}

/**
 * Options for replaying a recording
 */
export interface ReplayOptions {
	speed?: number // Speed multiplier (default: 1, 0 = instant)
	validate?: boolean // Validate bot responses (default: false)
	validationMode?: 'strict' | 'flexible' | 'type-only' // Validation strictness
	responseTimeout?: number // Timeout for bot responses in ms
}

/**
 * Result from replaying a recording
 */
export interface ReplayResult {
	success: boolean
	actionsReplayed: number
	duration: number
	validation?: {
		passed: boolean
		matched: number
		mismatched: number
		extra: number
		missing: number
		mismatches: Array<{
			expected: unknown
			actual: unknown
			path: string
		}>
	}
}

/**
 * Export a session recording
 *
 * @param sessionId - Session ID to export recording from
 * @returns The complete session recording
 */
export async function getSessionRecording(sessionId: string): Promise<SessionRecording> {
	return controlAPI(`/sessions/${sessionId}/recording`)
}

/**
 * Replay a recording into a session
 *
 * @param sessionId - Session ID to replay into
 * @param recording - The recording to replay
 * @param options - Replay options
 * @returns Replay result
 */
export async function replayRecording(
	sessionId: string,
	recording: SessionRecording,
	options?: ReplayOptions
): Promise<ReplayResult> {
	return controlAPI(`/sessions/${sessionId}/replay`, {
		method: 'POST',
		body: { recording, options }
	})
}

/**
 * Get the full session state
 *
 * @param sessionId - Session ID
 * @returns Full session state including all guilds, channels, users, etc.
 */
export async function getFullSessionState(sessionId: string): Promise<SessionState> {
	return controlAPI(`/sessions/${sessionId}/state`)
}

// ============================================================================
// State Inspection API Helpers
// ============================================================================

/**
 * Detailed session status response
 */
export interface DetailedSessionStatus {
	session_id: string
	name?: string
	connected: boolean
	connection_count: number
	guild_count: number
	channel_count: number
	user_count: number
	message_count: number
	interaction_count: number
	action_count: number
	sequence: number
	is_expired: boolean
	created_at: number
	expires_at: number
}

/**
 * Get detailed session status
 *
 * @param sessionId - Session ID
 * @returns Detailed status including counts
 */
export async function getDetailedSessionStatus(sessionId: string): Promise<DetailedSessionStatus> {
	return controlAPI(`/sessions/${sessionId}/status`)
}

/**
 * Make a raw request to the mock server REST API
 * Useful for testing API endpoints directly
 *
 * @param token - Bot token for authentication
 * @param endpoint - API endpoint (e.g., "/guilds/123")
 * @param options - Request options
 * @returns Response data
 */
export async function mockRestAPI<T = unknown>(
	token: string,
	endpoint: string,
	options: {
		method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
		body?: unknown
	} = {}
): Promise<T> {
	const url = `${MOCK_CONFIG.REST_URL}${endpoint}`
	const response = await fetch(url, {
		method: options.method ?? 'GET',
		headers: {
			Authorization: `Bot ${token}`,
			...(options.body ? { 'Content-Type': 'application/json' } : {})
		},
		body: options.body ? serializeBody(options.body) : undefined
	})

	if (!response.ok) {
		const text = await response.text()
		throw new Error(`REST API error: ${response.status} - ${text}`)
	}

	return response.json() as Promise<T>
}
