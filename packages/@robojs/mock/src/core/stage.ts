import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import WebSocket, { WebSocketServer } from 'ws'
import { sessionManager } from './manager.js'
import { mockLogger } from './logger.js'
import type {
	StageEvent,
	StageCommand,
	StageConnectionState,
	StateSyncPayload,
	StageServerConfig,
	BufferedStageEvent,
	StageGuild,
	StageChannel,
	StageUser,
	StageMember,
	StageMessage,
	StageCommandResponseData,
	StageSendMessageData,
	StageInvokeCommandData,
	StageClickButtonData,
	StageSelectOptionData,
	StageSubscribeChannelData,
	StageSubmitModalData,
	StageStartTypingData,
	StageAddReactionData
} from '../types/stage.js'
import type { Session } from '../types/index.js'

// Default configuration values
const DEFAULT_MAX_BUFFER_SIZE = 1000
const DEFAULT_HEARTBEAT_INTERVAL = 30000  // 30 seconds
const DEFAULT_MAX_MESSAGES_PER_CHANNEL = 50

/**
 * Stage WebSocket server for real-time event streaming to test clients
 * This is separate from the Discord Gateway - it's for monitoring and controlling
 * the mock server during testing.
 */
export class StageServer {
	private wss: WebSocketServer
	private connections: Map<WebSocket, StageConnectionState> = new Map()
	private eventBuffers: Map<string, BufferedStageEvent[]> = new Map()  // sessionId -> events
	private sessionSequences: Map<string, number> = new Map()  // sessionId -> last seq (for replay)
	private heartbeatIntervals: Map<WebSocket, NodeJS.Timeout> = new Map()

	private readonly maxBufferSize: number
	private readonly heartbeatInterval: number
	private readonly maxMessagesPerChannel: number

	constructor(config?: StageServerConfig) {
		this.maxBufferSize = config?.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE
		this.heartbeatInterval = config?.heartbeatInterval ?? DEFAULT_HEARTBEAT_INTERVAL
		this.maxMessagesPerChannel = config?.maxMessagesPerChannel ?? DEFAULT_MAX_MESSAGES_PER_CHANNEL

		this.wss = new WebSocketServer({ noServer: true })
		this.wss.on('connection', this.handleConnection.bind(this))
	}

	/**
	 * Handle HTTP upgrade request
	 * Called by @robojs/server when a WebSocket upgrade is requested at /stage/ws
	 *
	 * Supports two authentication methods:
	 * - `?token=mock:session_xxx` - Full session token
	 * - `?session=sess_xxx` - Just session ID (for convenience)
	 */
	handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
		const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)

		// Try to find session by token first, then by session ID
		const token = url.searchParams.get('token')
		const sessionId = url.searchParams.get('session')

		let session: Session | undefined

		if (token) {
			session = sessionManager.getByToken(token)
		} else if (sessionId) {
			session = sessionManager.get(sessionId)
		}

		if (!token && !sessionId) {
			mockLogger.warn('Stage connection rejected: missing token or session parameter')
			socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\n\r\nMissing token or session parameter\r\n')
			socket.destroy()
			return
		}

		// Validate session exists
		if (!session) {
			mockLogger.warn(`Stage connection rejected: invalid token/session "${token || sessionId}"`)
			socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\n\r\nInvalid session token or ID\r\n')
			socket.destroy()
			return
		}

		// Extract last_seq for reconnection replay
		const lastSeqParam = url.searchParams.get('last_seq')
		const lastSeq = lastSeqParam ? parseInt(lastSeqParam, 10) : 0

		// Complete the WebSocket upgrade
		this.wss.handleUpgrade(req, socket, head, (ws) => {
			// Store session ID and lastSeq in socket for later use
			;(ws as WebSocket & { _stageSessionId: string; _lastSeq: number })._stageSessionId = session.id
			;(ws as WebSocket & { _stageSessionId: string; _lastSeq: number })._lastSeq = lastSeq
			this.wss.emit('connection', ws, req)
		})
	}

	/**
	 * Handle new WebSocket connection
	 */
	private handleConnection(ws: WebSocket, _req: IncomingMessage): void {
		const sessionId = (ws as WebSocket & { _stageSessionId: string })._stageSessionId
		const lastSeq = (ws as WebSocket & { _lastSeq: number })._lastSeq || 0

		mockLogger.debug(`Stage connection established for session ${sessionId}`)

		// Create connection state
		const connState: StageConnectionState = {
			id: `stage_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
			sessionId,
			authenticated: true,  // Already authenticated via token
			lastSeq: 0,
			subscribedChannels: new Set(),
			connectedAt: Date.now()
		}
		this.connections.set(ws, connState)

		// Send connected event
		this.pushEvent(ws, connState, {
			type: 'connected',
			data: {
				sessionId,
				connectionId: connState.id
			}
		})

		// Send state sync
		const session = sessionManager.get(sessionId)
		if (session) {
			this.sendStateSync(ws, connState, session)
		}

		// Replay buffered events if reconnecting
		if (lastSeq > 0) {
			this.replayEvents(ws, connState, sessionId, lastSeq)
		}

		// Start heartbeat
		const heartbeat = setInterval(() => {
			if (ws.readyState === WebSocket.OPEN) {
				this.pushEvent(ws, connState, { type: 'heartbeat', data: {} })
			} else {
				clearInterval(heartbeat)
			}
		}, this.heartbeatInterval)
		this.heartbeatIntervals.set(ws, heartbeat)

		// Handle incoming messages (commands)
		ws.on('message', (data, isBinary) => {
			this.handleMessage(ws, connState, data, isBinary)
		})

		// Handle connection close
		ws.on('close', (code, reason) => {
			this.handleClose(ws, connState, code, reason.toString())
		})

		// Handle errors
		ws.on('error', (err) => {
			mockLogger.error('Stage WebSocket error:', err)
		})
	}

	/**
	 * Send state sync payload to a newly connected client
	 */
	private sendStateSync(ws: WebSocket, connState: StageConnectionState, session: Session): void {
		const state = session.state

		// Build simplified state for stage client
		const payload: StateSyncPayload = {
			session: {
				id: session.id,
				createdAt: session.createdAt,
				bot: state.botUser ? this.toStageUser(state.botUser) : null
			},
			guilds: Array.from(state.guilds.values()).map(g => this.toStageGuild(g)),
			channels: Array.from(state.channels.values()).map(c => this.toStageChannel(c)),
			members: this.getStageMembers(state),
			messages: this.getRecentMessagesByChannel(state),
			users: Array.from(state.users.values()).map(u => this.toStageUser(u))
		}

		this.pushEvent(ws, connState, {
			type: 'state_sync',
			data: payload
		})
	}

	/**
	 * Convert MockGuild to StageGuild
	 */
	private toStageGuild(guild: { id: string; name: string; icon?: string | null; ownerId?: string; memberCount?: number }): StageGuild {
		return {
			id: guild.id,
			name: guild.name,
			icon: guild.icon ?? null,
			owner_id: guild.ownerId,
			member_count: guild.memberCount
		}
	}

	/**
	 * Convert MockChannel to StageChannel
	 */
	private toStageChannel(channel: { id: string; name: string; type: number; guildId?: string; parentId?: string | null; position?: number; topic?: string | null }): StageChannel {
		return {
			id: channel.id,
			name: channel.name,
			type: channel.type,
			guild_id: channel.guildId,
			parent_id: channel.parentId,
			position: channel.position,
			topic: channel.topic
		}
	}

	/**
	 * Convert MockUser to StageUser
	 */
	private toStageUser(user: { id: string; username: string; discriminator?: string; avatar?: string | null; bot?: boolean }): StageUser {
		return {
			id: user.id,
			username: user.username,
			discriminator: user.discriminator,
			avatar: user.avatar ?? null,
			bot: user.bot
		}
	}

	/**
	 * Convert MockMessage to StageMessage
	 */
	private toStageMessage(message: { id: string; channelId: string; guildId?: string; author?: { id: string; username: string; avatar?: string | null; bot?: boolean }; content: string; timestamp: string; editedTimestamp?: string | null; embeds?: unknown[]; components?: unknown[]; attachments?: unknown[]; reactions?: unknown[] }): StageMessage {
		return {
			id: message.id,
			channel_id: message.channelId,
			guild_id: message.guildId,
			author: message.author ? this.toStageUser(message.author) : { id: '0', username: 'Unknown', avatar: null },
			content: message.content,
			timestamp: message.timestamp,
			edited_timestamp: message.editedTimestamp,
			embeds: message.embeds ?? [],
			components: message.components ?? [],
			attachments: message.attachments ?? [],
			reactions: message.reactions
		}
	}

	/**
	 * Get all guild members as StageMember array
	 */
	private getStageMembers(state: Session['state']): StageMember[] {
		const members: StageMember[] = []
		for (const [key, member] of state.guildMembers) {
			const [guildId] = key.split(':')
			const user = state.users.get(member.userId)
			if (user) {
				members.push({
					user: this.toStageUser(user),
					nick: member.nick,
					roles: member.roles,
					joined_at: member.joinedAt,
					guild_id: guildId
				})
			}
		}
		return members
	}

	/**
	 * Get recent messages grouped by channel
	 */
	private getRecentMessagesByChannel(state: Session['state']): Record<string, StageMessage[]> {
		const result: Record<string, StageMessage[]> = {}

		// Group messages by channel
		const byChannel = new Map<string, Array<Session['state']['messages'] extends Map<string, infer M> ? M : never>>()
		for (const message of state.messages.values()) {
			const channelId = message.channelId
			if (!byChannel.has(channelId)) {
				byChannel.set(channelId, [])
			}
			byChannel.get(channelId)!.push(message)
		}

		// Sort by timestamp and take most recent per channel
		for (const [channelId, messages] of byChannel) {
			const sorted = messages
				.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
				.slice(0, this.maxMessagesPerChannel)
				.reverse()  // Oldest first

			result[channelId] = sorted.map(m => {
				const author = state.users.get(m.authorId)
				return this.toStageMessage({
					...m,
					author: author ? { id: author.id, username: author.username, avatar: author.avatar, bot: author.bot } : undefined
				})
			})
		}

		return result
	}

	/**
	 * Replay buffered events for reconnection
	 */
	private replayEvents(ws: WebSocket, connState: StageConnectionState, sessionId: string, fromSeq: number): void {
		const buffer = this.eventBuffers.get(sessionId)
		if (!buffer) return

		const eventsToReplay = buffer.filter(b => b.event.seq > fromSeq)
		mockLogger.debug(`Replaying ${eventsToReplay.length} events from seq ${fromSeq} for session ${sessionId}`)

		for (const buffered of eventsToReplay) {
			if (ws.readyState === WebSocket.OPEN) {
				// Re-send the event with updated connection sequence
				connState.lastSeq = buffered.event.seq
				ws.send(JSON.stringify(buffered.event))
			}
		}
	}

	/**
	 * Handle incoming WebSocket message (command from stage client)
	 */
	private handleMessage(ws: WebSocket, connState: StageConnectionState, data: WebSocket.RawData, isBinary: boolean): void {
		// Reject binary frames
		if (isBinary) {
			this.sendError(ws, connState, 'Binary frames not supported')
			return
		}

		// Parse JSON command
		let command: StageCommand
		try {
			command = JSON.parse(data.toString())
		} catch {
			this.sendError(ws, connState, 'Invalid JSON')
			return
		}

		// Validate command structure
		if (!command.id || !command.type) {
			this.sendError(ws, connState, 'Invalid command format: missing id or type')
			return
		}

		mockLogger.debug(`Stage command received: ${command.type} (${command.id})`)

		// Handle the command
		this.handleCommand(ws, connState, command)
	}

	/**
	 * Handle a stage command
	 */
	private async handleCommand(ws: WebSocket, connState: StageConnectionState, command: StageCommand): Promise<void> {
		const session = sessionManager.get(connState.sessionId)
		if (!session) {
			this.sendCommandResponse(ws, connState, command.id, false, undefined, 'Session not found')
			return
		}

		try {
			switch (command.type) {
				case 'send_message': {
					const data = command.data as StageSendMessageData
					const message = await session.dispatchMessage({
						channelId: data.channel_id,
						content: data.content,
						author: data.author ? { id: data.author.id, username: data.author.username } : undefined,
						embeds: data.embeds as unknown[],
					})
					this.sendCommandResponse(ws, connState, command.id, true, { message_id: message.id })
					break
				}

				case 'invoke_command': {
					const data = command.data as StageInvokeCommandData
					const interaction = await session.dispatchSlashCommand({
						channelId: data.channel_id,
						commandName: data.command_name,
						options: data.options as Record<string, string | number | boolean> | undefined,
						user: data.user ? { id: data.user.id, username: data.user.username } : undefined
					})
					this.sendCommandResponse(ws, connState, command.id, true, { interaction_id: interaction.id })
					break
				}

				case 'click_button': {
					const data = command.data as StageClickButtonData
					const interaction = await session.dispatchButtonClick({
						channelId: data.channel_id,
						messageId: data.message_id,
						customId: data.custom_id,
						user: data.user ? { id: data.user.id, username: data.user.username } : undefined
					})
					this.sendCommandResponse(ws, connState, command.id, true, { interaction_id: interaction.id })
					break
				}

				case 'select_option': {
					const data = command.data as StageSelectOptionData
					const interaction = await session.dispatchSelectMenu({
						channelId: data.channel_id,
						messageId: data.message_id,
						customId: data.custom_id,
						values: data.values,
						user: data.user ? { id: data.user.id, username: data.user.username } : undefined
					})
					this.sendCommandResponse(ws, connState, command.id, true, { interaction_id: interaction.id })
					break
				}

				case 'submit_modal': {
					const data = command.data as StageSubmitModalData
					// Convert components array to fields record
					// Components format: [{ type: 1, components: [{ type: 4, custom_id: 'field1', value: 'value1' }] }]
					// Fields format: { 'field1': 'value1' }
					const fields: Record<string, string> = {}
					if (Array.isArray(data.components)) {
						for (const row of data.components) {
							const rowData = row as { type: number; components?: Array<{ custom_id?: string; value?: string }> }
							if (rowData.components && Array.isArray(rowData.components)) {
								for (const component of rowData.components) {
									if (component.custom_id && component.value !== undefined) {
										fields[component.custom_id] = String(component.value)
									}
								}
							}
						}
					}
					const interaction = await session.dispatchModalSubmit({
						customId: data.custom_id,
						fields,
						user: data.user ? { id: data.user.id, username: data.user.username } : undefined
					})
					this.sendCommandResponse(ws, connState, command.id, true, { interaction_id: interaction.id })
					break
				}

				case 'start_typing': {
					const data = command.data as StageStartTypingData
					// Dispatch TYPING_START event via Session.dispatch()
					const user = data.user?.id ? session.state.getUser(data.user.id) : session.state.getOrCreateTestUser()
					await session.dispatch('TYPING_START', {
						channel_id: data.channel_id,
						user_id: user.id,
						timestamp: Math.floor(Date.now() / 1000)
					})
					this.sendCommandResponse(ws, connState, command.id, true)
					break
				}

				case 'request_state': {
					// Re-send state sync
					this.sendStateSync(ws, connState, session)
					this.sendCommandResponse(ws, connState, command.id, true)
					break
				}

				case 'subscribe_channel': {
					const data = command.data as StageSubscribeChannelData
					if (data.subscribe) {
						connState.subscribedChannels.add(data.channel_id)
					} else {
						connState.subscribedChannels.delete(data.channel_id)
					}
					this.sendCommandResponse(ws, connState, command.id, true, {
						subscribed: Array.from(connState.subscribedChannels)
					})
					break
				}

				case 'add_reaction': {
					const data = command.data as StageAddReactionData
					// Dispatch MESSAGE_REACTION_ADD event via Session.dispatch()
					const user = data.user?.id ? session.state.getUser(data.user.id) : session.state.getOrCreateTestUser()
					const channel = session.state.channels.get(data.channel_id)
					await session.dispatch('MESSAGE_REACTION_ADD', {
						user_id: user.id,
						channel_id: data.channel_id,
						message_id: data.message_id,
						guild_id: channel?.guildId,
						emoji: { name: data.emoji, id: null }  // Unicode emoji format
					})
					this.sendCommandResponse(ws, connState, command.id, true)
					break
				}

				case 'set_playback': {
					// Playback controls will be implemented in Phase 5J
					this.sendCommandResponse(ws, connState, command.id, false, undefined, 'Playback controls not yet implemented')
					break
				}

				default:
					this.sendCommandResponse(ws, connState, command.id, false, undefined, `Unknown command type: ${command.type}`)
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			mockLogger.error(`Stage command error: ${message}`)
			this.sendCommandResponse(ws, connState, command.id, false, undefined, message)
		}
	}

	/**
	 * Send command response to client
	 */
	private sendCommandResponse(
		ws: WebSocket,
		connState: StageConnectionState,
		commandId: string,
		success: boolean,
		result?: unknown,
		error?: string
	): void {
		const data: StageCommandResponseData = {
			command_id: commandId,
			success,
			result,
			error
		}
		this.pushEvent(ws, connState, { type: 'command_response', data })
	}

	/**
	 * Send error event to client
	 */
	private sendError(ws: WebSocket, connState: StageConnectionState, message: string): void {
		this.pushEvent(ws, connState, { type: 'error', data: { message } })
	}

	/**
	 * Get next session-level sequence number
	 */
	private getNextSessionSeq(sessionId: string): number {
		const current = this.sessionSequences.get(sessionId) ?? 0
		const next = current + 1
		this.sessionSequences.set(sessionId, next)
		return next
	}

	/**
	 * Push an event to a specific connection
	 */
	private pushEvent(ws: WebSocket, connState: StageConnectionState, event: Partial<StageEvent>): void {
		// Use session-level sequence for consistent replay across connections
		const seq = this.getNextSessionSeq(connState.sessionId)

		const fullEvent: StageEvent = {
			seq,
			timestamp: Date.now(),
			type: event.type!,
			data: event.data
		}

		// Update connection's lastSeq for tracking
		connState.lastSeq = seq

		// Buffer for reconnection replay
		this.bufferEvent(connState.sessionId, fullEvent)

		// Send to client
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(fullEvent))
			mockLogger.debug(`Stage event sent: ${fullEvent.type} (seq: ${fullEvent.seq})`)
		}
	}

	/**
	 * Buffer an event for reconnection replay
	 */
	private bufferEvent(sessionId: string, event: StageEvent): void {
		if (!this.eventBuffers.has(sessionId)) {
			this.eventBuffers.set(sessionId, [])
		}

		const buffer = this.eventBuffers.get(sessionId)!
		buffer.push({
			sessionId,
			event,
			bufferedAt: Date.now()
		})

		// LRU eviction if buffer is full
		if (buffer.length > this.maxBufferSize) {
			const evictCount = Math.ceil(this.maxBufferSize * 0.1)  // Remove oldest 10%
			buffer.splice(0, evictCount)
		}
	}

	/**
	 * Broadcast an event to all stage connections for a session
	 * Called by StageBridge when session events occur
	 */
	broadcastToSession(sessionId: string, event: Partial<StageEvent>): void {
		// Generate session-level sequence once for all connections
		const seq = this.getNextSessionSeq(sessionId)

		const fullEvent: StageEvent = {
			seq,
			timestamp: Date.now(),
			type: event.type!,
			data: event.data
		}

		// Buffer event once for replay
		this.bufferEvent(sessionId, fullEvent)

		// Send to all connected clients for this session
		let broadcastCount = 0
		for (const [ws, connState] of this.connections) {
			if (connState.sessionId === sessionId && connState.authenticated) {
				connState.lastSeq = seq
				if (ws.readyState === WebSocket.OPEN) {
					ws.send(JSON.stringify(fullEvent))
					broadcastCount++
				}
			}
		}

		if (broadcastCount > 0) {
			mockLogger.debug(`Broadcast ${event.type} (seq: ${seq}) to ${broadcastCount} stage client(s) for session ${sessionId}`)
		}
	}

	/**
	 * Handle connection close
	 */
	private handleClose(ws: WebSocket, connState: StageConnectionState, code: number, reason: string): void {
		// Clear heartbeat interval
		const heartbeat = this.heartbeatIntervals.get(ws)
		if (heartbeat) {
			clearInterval(heartbeat)
			this.heartbeatIntervals.delete(ws)
		}

		// Remove connection
		this.connections.delete(ws)
		mockLogger.debug(`Stage connection closed: ${connState.id} (code: ${code}, reason: ${reason})`)
	}

	/**
	 * Get the number of stage connections for a session
	 */
	getSessionConnectionCount(sessionId: string): number {
		let count = 0
		for (const connState of this.connections.values()) {
			if (connState.sessionId === sessionId) {
				count++
			}
		}
		return count
	}

	/**
	 * Get event buffer stats for a session
	 */
	getBufferStats(sessionId: string): { size: number; oldestSeq: number | null; newestSeq: number | null } {
		const buffer = this.eventBuffers.get(sessionId)
		if (!buffer || buffer.length === 0) {
			return { size: 0, oldestSeq: null, newestSeq: null }
		}
		return {
			size: buffer.length,
			oldestSeq: buffer[0].event.seq,
			newestSeq: buffer[buffer.length - 1].event.seq
		}
	}

	/**
	 * Clear event buffer for a session (call when session is deleted)
	 */
	clearSessionBuffer(sessionId: string): void {
		this.eventBuffers.delete(sessionId)
	}

	/**
	 * Close the stage server
	 */
	close(): void {
		// Clear all heartbeat intervals
		for (const heartbeat of this.heartbeatIntervals.values()) {
			clearInterval(heartbeat)
		}
		this.heartbeatIntervals.clear()

		// Close all connections
		for (const [ws] of this.connections) {
			ws.close(1001, 'Server shutting down')
		}
		this.connections.clear()

		// Clear event buffers
		this.eventBuffers.clear()

		// Close WebSocket server
		this.wss.close()

		mockLogger.debug('Stage server closed')
	}

	/**
	 * Get total number of connections
	 */
	get connectionCount(): number {
		return this.connections.size
	}
}

/**
 * Singleton stage server instance
 */
let _stageServer: StageServer | null = null

/**
 * Get or create the stage server singleton
 */
export function getStageServer(config?: StageServerConfig): StageServer {
	if (!_stageServer) {
		_stageServer = new StageServer(config)
	}
	return _stageServer
}

/**
 * Close and reset the stage server singleton
 */
export function closeStageServer(): void {
	if (_stageServer) {
		_stageServer.close()
		_stageServer = null
	}
}
