import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import WebSocket, { WebSocketServer } from 'ws'
import { GatewayCloseCodes, GatewayOpcodes, GatewayIntentBits } from 'discord-api-types/v10'
import { buildHelloPayload, buildHeartbeatAckPayload, buildReadyPayload, buildGuildCreatePayload, isValidIdentifyPayload } from '../discord/payloads.js'
import type { GatewayPayload } from '../discord/payloads.js'
import { GATEWAY_VERSION, DEFAULT_HEARTBEAT_INTERVAL } from '../discord/opcodes.js'
import { generateGatewaySessionId } from '../utils/id.js'
import { sessionManager } from './manager.js'
import { mockLogger } from './logger.js'
import type { ActionType, ConnectionState } from '../types/index.js'

/**
 * Discord Gateway WebSocket server
 * Handles WebSocket connections and sends Gateway protocol messages
 */
export class GatewayServer {
	private wss: WebSocketServer
	private connections: Map<WebSocket, ConnectionState> = new Map()

	constructor() {
		this.wss = new WebSocketServer({ noServer: true })
		this.wss.on('connection', this.handleConnection.bind(this))
	}

	/**
	 * Create initial connection state for a new WebSocket connection
	 */
	private createConnectionState(): ConnectionState {
		return {
			id: generateGatewaySessionId(),
			sessionId: '',
			identified: false,
			token: null,
			intents: 0,
			sequence: 0,
			lastAckSequence: null,
			lastHeartbeat: Date.now(),
			heartbeatInterval: DEFAULT_HEARTBEAT_INTERVAL,
			missedHeartbeats: 0
		}
	}

	/**
	 * Handle HTTP upgrade request
	 * Called by @robojs/server when a WebSocket upgrade is requested
	 */
	handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
		const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)

		// Validate API version (must be v10)
		const version = url.searchParams.get('v')
		if (version !== GATEWAY_VERSION) {
			mockLogger.warn(`Rejected connection: invalid API version "${version}" (expected ${GATEWAY_VERSION})`)
			socket.write('HTTP/1.1 400 Bad Request\r\nContent-Type: text/plain\r\n\r\nInvalid API version\r\n')
			socket.destroy()
			return
		}

		// Validate encoding (only json supported, etf/zlib-stream not supported)
		const encoding = url.searchParams.get('encoding')
		if (encoding && encoding !== 'json') {
			mockLogger.warn(`Rejected connection: unsupported encoding "${encoding}"`)
			socket.write('HTTP/1.1 400 Bad Request\r\nContent-Type: text/plain\r\n\r\nUnsupported encoding\r\n')
			socket.destroy()
			return
		}

		// Complete the WebSocket upgrade
		this.wss.handleUpgrade(req, socket, head, (ws) => {
			this.wss.emit('connection', ws, req)
		})
	}

	/**
	 * Handle new WebSocket connection
	 */
	private handleConnection(ws: WebSocket, req: IncomingMessage): void {
		mockLogger.debug(`Gateway connection established from ${req.socket.remoteAddress}`)

		// Create connection state
		const connState = this.createConnectionState()
		this.connections.set(ws, connState)

		// Send HELLO immediately (Discord Gateway protocol)
		const hello = buildHelloPayload(connState.heartbeatInterval)
		this.send(ws, hello)
		mockLogger.debug(`Sent HELLO payload (connection ${connState.id})`)

		// Handle incoming messages
		ws.on('message', (data, isBinary) => {
			this.handleMessage(ws, data, isBinary)
		})

		// Handle connection close
		ws.on('close', (code, reason) => {
			const state = this.connections.get(ws)
			if (state?.sessionId) {
				// Remove connection from session
				const session = sessionManager.get(state.sessionId)
				session?.connections.delete(state.id)
				mockLogger.debug(`Removed connection ${state.id} from session ${state.sessionId}`)
			}
			this.connections.delete(ws)
			mockLogger.debug(`Connection closed: ${code} ${reason.toString()}`)
		})

		// Handle errors
		ws.on('error', (err) => {
			mockLogger.error('WebSocket error:', err)
		})
	}

	/**
	 * Map Gateway opcode to ActionType for recording
	 */
	private getActionTypeForOpcode(op: number): ActionType {
		switch (op) {
			case GatewayOpcodes.Identify:
				return 'gateway_identify'
			case GatewayOpcodes.Heartbeat:
				return 'gateway_heartbeat'
			case GatewayOpcodes.PresenceUpdate:
				return 'gateway_presence_update'
			case GatewayOpcodes.VoiceStateUpdate:
				return 'gateway_voice_state_update'
			case GatewayOpcodes.Resume:
				return 'gateway_resume'
			case GatewayOpcodes.RequestGuildMembers:
				return 'gateway_request_guild_members'
			default:
				return 'gateway_message'
		}
	}

	/**
	 * Handle incoming WebSocket message
	 */
	private handleMessage(ws: WebSocket, data: WebSocket.RawData, isBinary: boolean): void {
		// Reject binary frames (ETF encoding not supported)
		if (isBinary) {
			mockLogger.warn('Received binary frame, closing connection')
			ws.close(GatewayCloseCodes.DecodeError, 'Binary frames not supported')
			return
		}

		// Parse JSON payload
		let payload: GatewayPayload
		try {
			payload = JSON.parse(data.toString())
		} catch {
			mockLogger.warn('Failed to parse JSON payload')
			ws.close(GatewayCloseCodes.DecodeError, 'Invalid JSON payload')
			return
		}

		mockLogger.debug('Received:', JSON.stringify(payload))

		const connState = this.connections.get(ws)
		if (!connState) {
			mockLogger.error('No connection state found for WebSocket')
			ws.close(GatewayCloseCodes.UnknownError, 'Internal error')
			return
		}

		// Record the incoming message if we have a session
		// (for IDENTIFY, we record after processing since session isn't available yet)
		if (connState.sessionId && payload.op !== GatewayOpcodes.Identify) {
			const session = sessionManager.get(connState.sessionId)
			if (session) {
				const actionType = this.getActionTypeForOpcode(payload.op)
				session.recordAction(actionType, payload.d)
			}
		}

		// Route by opcode
		switch (payload.op) {
			case GatewayOpcodes.Identify:
				this.handleIdentify(ws, connState, payload.d)
				break

			case GatewayOpcodes.Heartbeat:
				// Update last heartbeat time
				connState.lastHeartbeat = Date.now()
				// Store client's last received sequence (can be null or number)
				connState.lastAckSequence = typeof payload.d === 'number' ? payload.d : null
				// Reset missed heartbeats counter (client is alive)
				connState.missedHeartbeats = 0
				// Send HEARTBEAT_ACK immediately
				this.send(ws, buildHeartbeatAckPayload())
				mockLogger.debug(`Heartbeat ACK sent to connection ${connState.id}`)
				break

			default:
				// All other opcodes require authentication
				if (!connState.identified) {
					mockLogger.warn(`Received op ${payload.op} before IDENTIFY, closing connection`)
					ws.close(GatewayCloseCodes.NotAuthenticated, 'Not authenticated')
					return
				}
				// Other opcodes will be handled in future phases
				mockLogger.debug(`Unhandled opcode: ${payload.op}`)
		}
	}

	/**
	 * Handle IDENTIFY payload (op 2)
	 * Authenticates the client and routes to the correct session
	 */
	private handleIdentify(ws: WebSocket, connState: ConnectionState, data: unknown): void {
		// Check if already identified
		if (connState.identified) {
			mockLogger.warn(`Connection ${connState.id} already identified, closing`)
			ws.close(GatewayCloseCodes.AlreadyAuthenticated, 'Already authenticated')
			return
		}

		// Validate payload structure
		if (!isValidIdentifyPayload(data)) {
			mockLogger.warn('Invalid IDENTIFY payload structure')
			ws.close(GatewayCloseCodes.DecodeError, 'Invalid IDENTIFY payload')
			return
		}

		// Parse token and get session
		const session = sessionManager.getByToken(data.token)
		if (!session) {
			mockLogger.warn(`Invalid session token: ${data.token}`)
			ws.close(GatewayCloseCodes.AuthenticationFailed, 'Invalid session token')
			return
		}

		// Update connection state
		connState.identified = true
		connState.sessionId = session.id
		connState.token = data.token
		connState.intents = data.intents
		connState.sequence = 0

		// Register connection with session
		session.connections.set(connState.id, connState)

		// Record the IDENTIFY action now that session is available
		session.recordAction('gateway_identify', {
			intents: data.intents,
			properties: data.properties
		})

		mockLogger.info(`Client identified: connection=${connState.id}, session=${session.id}, intents=${data.intents}`)

		// Send READY event (Phase 1D)
		const readyPayload = buildReadyPayload({
			sessionState: session.state,
			connectionSessionId: connState.id,
			gatewayUrl: 'ws://localhost:8765'
		})
		this.send(ws, readyPayload)
		connState.sequence = 1 // READY is sequence 1
		mockLogger.debug(`Sent READY to connection ${connState.id}`)

		// Send GUILD_CREATE for each guild (Phase 1E)
		// This makes guilds "available" after they were sent as "unavailable" in READY
		for (const guild of session.state.guilds.values()) {
			connState.sequence++
			const guildCreatePayload = buildGuildCreatePayload({
				guild,
				sessionState: session.state,
				sequence: connState.sequence
			})
			this.send(ws, guildCreatePayload)
			mockLogger.debug(`Sent GUILD_CREATE for guild ${guild.id} (seq: ${connState.sequence}) to connection ${connState.id}`)
		}
	}

	/**
	 * Send a payload to a WebSocket connection
	 */
	private send(ws: WebSocket, payload: unknown): void {
		if (ws.readyState === WebSocket.OPEN) {
			const data = JSON.stringify(payload)
			ws.send(data)
			mockLogger.debug('Sent:', data)
		}
	}

	/**
	 * Get the WebSocket for a connection state
	 */
	private getWebSocketForConnection(connectionId: string): WebSocket | undefined {
		for (const [ws, state] of this.connections) {
			if (state.id === connectionId) {
				return ws
			}
		}
		return undefined
	}

	/**
	 * Check if a connection has the required intent for an event
	 */
	private hasRequiredIntent(connState: ConnectionState, event: string, guildId?: string): boolean {
		// Events that don't require intents
		const noIntentEvents = ['READY', 'RESUMED', 'INTERACTION_CREATE']
		if (noIntentEvents.includes(event)) {
			return true
		}

		// Message events require specific intents based on context
		if (event === 'MESSAGE_CREATE' || event === 'MESSAGE_UPDATE' || event === 'MESSAGE_DELETE') {
			const requiredIntent = guildId ? GatewayIntentBits.GuildMessages : GatewayIntentBits.DirectMessages
			return (connState.intents & requiredIntent) !== 0
		}

		// Poll vote events (Phase 4G) require GuildMessagePolls (1 << 24) or DirectMessagePolls (1 << 25)
		// Note: These intents may not be in discord-api-types yet, so we define them inline
		if (event === 'MESSAGE_POLL_VOTE_ADD' || event === 'MESSAGE_POLL_VOTE_REMOVE') {
			const GuildMessagePolls = 1 << 24
			const DirectMessagePolls = 1 << 25
			const requiredIntent = guildId ? GuildMessagePolls : DirectMessagePolls
			return (connState.intents & requiredIntent) !== 0
		}

		// Guild events require GUILDS intent
		if (event.startsWith('GUILD_') || event.startsWith('CHANNEL_')) {
			return (connState.intents & GatewayIntentBits.Guilds) !== 0
		}

		// Thread events (Phase 4D)
		if (event.startsWith('THREAD_')) {
			// THREAD_CREATE, THREAD_UPDATE, THREAD_DELETE, THREAD_LIST_SYNC require Guilds intent
			if (['THREAD_CREATE', 'THREAD_UPDATE', 'THREAD_DELETE', 'THREAD_LIST_SYNC'].includes(event)) {
				return (connState.intents & GatewayIntentBits.Guilds) !== 0
			}
			// THREAD_MEMBER_UPDATE requires no intent (always sent for current user's membership)
			if (event === 'THREAD_MEMBER_UPDATE') {
				return true
			}
			// THREAD_MEMBERS_UPDATE requires GuildMembers privileged intent
			if (event === 'THREAD_MEMBERS_UPDATE') {
				return (connState.intents & GatewayIntentBits.GuildMembers) !== 0
			}
		}

		// For other events, allow by default (can be expanded later)
		return true
	}

	/**
	 * Dispatch an event to all connections in a session
	 * Handles intent filtering and sequence number management
	 *
	 * @param sessionId - The session to dispatch to
	 * @param event - The event name (e.g., "MESSAGE_CREATE")
	 * @param data - The event payload data (without op/s/t wrapper)
	 * @param guildId - Optional guild ID for intent filtering
	 * @returns Number of connections the event was sent to
	 */
	dispatchToSession(sessionId: string, event: string, data: unknown, guildId?: string): number {
		const session = sessionManager.get(sessionId)
		if (!session) {
			mockLogger.warn(`Cannot dispatch to unknown session: ${sessionId}`)
			return 0
		}

		let dispatched = 0

		for (const [connectionId, connState] of session.connections) {
			// Skip non-identified connections
			if (!connState.identified) {
				continue
			}

			// Check intents
			if (!this.hasRequiredIntent(connState, event, guildId)) {
				mockLogger.debug(`Connection ${connectionId} lacks intent for ${event}, skipping`)
				continue
			}

			// Get the WebSocket for this connection
			const ws = this.getWebSocketForConnection(connectionId)
			if (!ws || ws.readyState !== WebSocket.OPEN) {
				mockLogger.debug(`Connection ${connectionId} WebSocket not open, skipping`)
				continue
			}

			// Increment sequence and send
			connState.sequence++
			const payload: GatewayPayload = {
				op: GatewayOpcodes.Dispatch,
				s: connState.sequence,
				t: event,
				d: data
			}

			this.send(ws, payload)
			dispatched++
			mockLogger.debug(`Dispatched ${event} (seq: ${connState.sequence}) to connection ${connectionId}`)
		}

		return dispatched
	}

	/**
	 * Close all connections and shut down the server
	 */
	close(): void {
		mockLogger.debug('Closing Gateway server...')

		// Close all active connections
		for (const [ws, connState] of this.connections) {
			// Remove from session if associated
			if (connState.sessionId) {
				const session = sessionManager.get(connState.sessionId)
				session?.connections.delete(connState.id)
			}
			ws.close(1001, 'Server shutting down')
		}
		this.connections.clear()

		// Close the WebSocket server
		this.wss.close()

		mockLogger.debug('Gateway server closed')
	}

	/**
	 * Get number of active connections
	 */
	get connectionCount(): number {
		return this.connections.size
	}
}

/**
 * Singleton gateway server instance
 */
let _gatewayServer: GatewayServer | null = null

/**
 * Get or create the gateway server singleton
 */
export function getGatewayServer(): GatewayServer {
	if (!_gatewayServer) {
		_gatewayServer = new GatewayServer()
	}
	return _gatewayServer
}

/**
 * Close and reset the gateway server singleton
 */
export function closeGatewayServer(): void {
	if (_gatewayServer) {
		_gatewayServer.close()
		_gatewayServer = null
	}
}
