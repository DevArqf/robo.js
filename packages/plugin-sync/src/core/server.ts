import { syncLogger } from './logger.js'
import { normalizeKey } from './utils.js'
import { processUpdate, processCall, runPostUpdateHooks } from '../server/handlers.js'
import { getServerEngine } from '@robojs/server'
import { NodeEngine } from '@robojs/server/engines.js'
import { nanoid } from 'nanoid'
import { color } from 'robo.js'
import WebSocket, { WebSocketServer } from 'ws'
import type { Client, MessagePayload, ServerZone } from '../core/types.js'
import type { HandlerClient, CallResultMessage, ValidationErrorMessage } from '../server/types.js'

export const SyncServer = { getSocketServer, getZone, start }

interface Connection<ClientData = unknown> {
	id: string
	isAlive: boolean
	watch: string[]
	ws: WebSocket
	data?: ClientData
	connectedAt: number
}

const _connections: Array<Connection> = []
const _state: Record<string, unknown> = {}
const _keySubscribers: Record<string, string[]> = {} // key -> [connectionId...] in subscription order
const _keyHosts: Record<string, string> = {} // key -> hostConnectionId
const _pendingUnsubscribes: Record<string, NodeJS.Timeout> = {} // "connectionId:cleanKey" -> timeout
const UNSUBSCRIBE_DELAY_MS = 150 // Debounce delay to handle React StrictMode double-firing
let _wss: WebSocketServer | undefined

function getSocketServer() {
	return _wss
}

/**
 * Get the list of clients subscribed to a key.
 */
function getClientsForKey(cleanKey: string): Client[] {
	const subscribers = _keySubscribers[cleanKey] || []
	const clients: Client[] = []

	for (const connId of subscribers) {
		const conn = _connections.find((c) => c.id === connId)
		if (conn) {
			clients.push({
				id: connId,
				data: conn.data
			})
		}
	}

	return clients
}

/**
 * Broadcast updated clients list to all watchers of a key.
 */
function broadcastClientsUpdate(cleanKey: string) {
	const clients = getClientsForKey(cleanKey)
	const hostId = _keyHosts[cleanKey] || ''

	const payload: MessagePayload = {
		data: { clients, hostId },
		key: cleanKey.split('.'),
		type: 'clients'
	}

	_connections
		.filter((c) => c.watch.includes(cleanKey))
		.forEach((c) => {
			syncLogger.debug(`Sending clients update to ${c.id}`)
			c.ws.send(JSON.stringify(payload))
		})
}

/**
 * Broadcast join event to all watchers of a key except the new connection.
 */
function broadcastJoinEvent(cleanKey: string, newConnection: Connection, key?: string[]) {
	const payload: MessagePayload = {
		data: { id: newConnection.id, data: newConnection.data },
		key: key || cleanKey.split('.'),
		type: 'join'
	}

	_connections
		.filter((c) => c.watch.includes(cleanKey) && c.id !== newConnection.id)
		.forEach((c) => {
			syncLogger.debug(`Sending join event for ${newConnection.id} to ${c.id}`)
			c.ws.send(JSON.stringify(payload))
		})
}

/**
 * Broadcast leave event to all watchers of a key.
 */
function broadcastLeaveEvent(cleanKey: string, leavingConnection: Connection, key?: string[]) {
	const payload: MessagePayload = {
		data: { id: leavingConnection.id, data: leavingConnection.data },
		key: key || cleanKey.split('.'),
		type: 'leave'
	}

	_connections
		.filter((c) => c.watch.includes(cleanKey))
		.forEach((c) => {
			syncLogger.debug(`Sending leave event for ${leavingConnection.id} to ${c.id}`)
			c.ws.send(JSON.stringify(payload))
		})
}

/**
 * Handle unsubscription from a key with host migration.
 */
function handleUnsubscribe(connection: Connection, cleanKey: string, key?: string[]) {
	// Remove from subscribers
	const subIndex = _keySubscribers[cleanKey]?.indexOf(connection.id)
	if (subIndex !== undefined && subIndex > -1) {
		_keySubscribers[cleanKey].splice(subIndex, 1)
	}

	// Handle host migration if this was the host
	if (_keyHosts[cleanKey] === connection.id) {
		const newHost = _keySubscribers[cleanKey]?.[0]
		if (newHost) {
			_keyHosts[cleanKey] = newHost
			syncLogger.debug(`Host migrated from ${connection.id} to ${newHost} for key ${cleanKey}`)
		} else {
			delete _keyHosts[cleanKey]
			syncLogger.debug(`No remaining subscribers for key ${cleanKey}, host removed`)
		}
	}

	// Notify remaining watchers about the leave
	broadcastLeaveEvent(cleanKey, connection, key)

	// Broadcast updated clients list (includes new host info)
	if (_keySubscribers[cleanKey]?.length > 0) {
		broadcastClientsUpdate(cleanKey)
	}
}

/**
 * Utility function to handle broadcasting updates to connections.
 */
function broadcastUpdate(cleanKey: string, data: unknown, key?: string[]) {
	const watchingConnections = _connections.filter((c) => c.watch.includes(cleanKey))
	watchingConnections.forEach((c) => {
		syncLogger.debug(`Broadcasting ${color.bold(cleanKey)} state update to:`, c.id)
		const broadcast: MessagePayload = { data, key, type: 'update' }
		c.ws.send(JSON.stringify(broadcast))
	})
	syncLogger.debug(`Broadcasted ${color.bold(cleanKey)} state update to ${watchingConnections.length} connections.`)
}

/**
 * Handle incoming message from a WebSocket connection.
 */
function handleMessage(connection: Connection, message: string) {
	const payload: MessagePayload = JSON.parse(message)
	const { data, key, type, targetClientId } = payload
	syncLogger.debug(`Received from ${connection.id}:`, payload)

	if (!type) {
		syncLogger.error('Payload type is missing!')
		return
	}

	// Allow ping/pong and metadata without key
	if (!['ping', 'pong', 'metadata'].includes(type) && !key) {
		syncLogger.error('Payload key is missing!')
		return
	}

	const cleanKey = key ? normalizeKey(key) : ''
	switch (type) {
		case 'pong':
			connection.isAlive = true
			break

		case 'metadata': {
			// Client sends/updates their metadata
			connection.data = data
			syncLogger.debug(`Connection ${connection.id} set metadata:`, data)

			// Notify all rooms this client is watching about the metadata update
			connection.watch.forEach((watchedKey) => {
				broadcastClientsUpdate(watchedKey)
			})
			break
		}

		case 'get': {
			// Send the current state to the client
			const response: MessagePayload = { data: _state[cleanKey], key, type: 'update' }
			syncLogger.debug(`Sending to ${connection.id}:`, response)
			connection.ws.send(JSON.stringify(response))
			break
		}

		case 'on': {
			// Cancel any pending unsubscribe for this connection+key (handles StrictMode remount)
			const pendingKey = `${connection.id}:${cleanKey}`
			if (_pendingUnsubscribes[pendingKey]) {
				clearTimeout(_pendingUnsubscribes[pendingKey])
				delete _pendingUnsubscribes[pendingKey]
				syncLogger.debug(`Cancelled pending unsubscribe for ${connection.id} on ${cleanKey}`)

				// Already subscribed, just send current state if exists
				if (_state[cleanKey]) {
					const response: MessagePayload = { data: _state[cleanKey], key, type: 'update' }
					connection.ws.send(JSON.stringify(response))
				}
				break
			}

			const isNewSubscriber = !connection.watch.includes(cleanKey)

			if (isNewSubscriber) {
				connection.watch.push(cleanKey)

				// Track subscription order for this key
				if (!_keySubscribers[cleanKey]) {
					_keySubscribers[cleanKey] = []
				}
				_keySubscribers[cleanKey].push(connection.id)

				// Determine if this is the first subscriber (new host)
				if (_keySubscribers[cleanKey].length === 1) {
					_keyHosts[cleanKey] = connection.id
					syncLogger.debug(`Connection ${connection.id} is now host for key ${cleanKey}`)
				}

				syncLogger.debug(`Connection ${connection.id} is now watching:`, connection.watch)

				// Notify existing watchers about the new client
				broadcastJoinEvent(cleanKey, connection, key)

				// Broadcast updated clients list to ALL subscribers (not just new one)
				broadcastClientsUpdate(cleanKey)
			}

			// Send the current state to the client if it exists
			if (_state[cleanKey]) {
				const response: MessagePayload = { data: _state[cleanKey], key, type: 'update' }
				syncLogger.debug(`Sending to ${connection.id}:`, response)
				connection.ws.send(JSON.stringify(response))
			}
			break
		}

		case 'off': {
			const pendingKey = `${connection.id}:${cleanKey}`

			// Clear any existing pending unsubscribe for this connection+key
			if (_pendingUnsubscribes[pendingKey]) {
				clearTimeout(_pendingUnsubscribes[pendingKey])
			}

			// Schedule delayed unsubscribe (handles React StrictMode double-firing)
			_pendingUnsubscribes[pendingKey] = setTimeout(() => {
				delete _pendingUnsubscribes[pendingKey]

				const index = connection.watch.indexOf(cleanKey)
				if (index > -1) {
					connection.watch.splice(index, 1)
					syncLogger.debug(`Connection ${connection.id} stopped watching:`, cleanKey)
					handleUnsubscribe(connection, cleanKey, key)
				}
			}, UNSUBSCRIBE_DELAY_MS)
			break
		}

		case 'update': {
			// Process through handlers (validation, transform, etc.)
			const client: HandlerClient = { id: connection.id, data: connection.data }
			const oldState = _state[cleanKey]
			// key is validated above to exist for 'update' type
			const keyArray = key!

			processUpdate(cleanKey, keyArray, data, oldState, client)
				.then((result) => {
					if (result.accepted) {
						// Update state with potentially transformed data
						_state[cleanKey] = result.state
						syncLogger.debug(`State updated for ${cleanKey}. Broadcasting...`)
						broadcastUpdate(cleanKey, result.state, keyArray)

						// Run post-update hooks (onUpdate, middleware after)
						runPostUpdateHooks(result).catch((err) => {
							syncLogger.error('Post-update hook error:', err)
						})
					} else {
						// Send validation error back to client
						syncLogger.debug(`Update rejected for ${cleanKey}: ${result.reason}`)
						const errorPayload: ValidationErrorMessage = {
							type: 'validation_error',
							key: keyArray,
							reason: result.reason || 'validation_failed',
							details: result.errors
						}
						connection.ws.send(JSON.stringify(errorPayload))
					}
				})
				.catch((err) => {
					syncLogger.error('Handler processing error:', err)
					// On handler error, fall back to allowing update (backward compat)
					_state[cleanKey] = data
					broadcastUpdate(cleanKey, data, keyArray)
				})
			break
		}

		case 'broadcast': {
			// Ephemeral message to all clients watching this key (except sender)
			const broadcastPayload: MessagePayload = {
				data,
				key,
				type: 'broadcast',
				fromClientId: connection.id
			}

			_connections
				.filter((c) => c.watch.includes(cleanKey) && c.id !== connection.id)
				.forEach((c) => {
					syncLogger.debug(`Forwarding broadcast from ${connection.id} to ${c.id}`)
					c.ws.send(JSON.stringify(broadcastPayload))
				})
			break
		}

		case 'send': {
			// Ephemeral message to specific client
			if (!targetClientId) {
				syncLogger.error('Target client ID is missing for send message!')
				return
			}

			const targetConnection = _connections.find((c) => c.id === targetClientId)
			if (targetConnection && targetConnection.watch.includes(cleanKey)) {
				const sendPayload: MessagePayload = {
					data,
					key,
					type: 'send',
					fromClientId: connection.id
				}
				syncLogger.debug(`Forwarding message from ${connection.id} to ${targetClientId}`)
				targetConnection.ws.send(JSON.stringify(sendPayload))
			} else {
				syncLogger.warn(`Target client ${targetClientId} not found or not watching key ${cleanKey}`)
			}
			break
		}

		case 'call': {
			// RPC call to server handler
			const { callId, method } = payload as { callId?: string; method?: string }

			if (!callId || !method) {
				syncLogger.error('Call message missing callId or method!')
				return
			}

			// key is validated above to exist for 'call' type
			const keyArray = key!
			const client: HandlerClient = { id: connection.id, data: connection.data }
			const zone = getZone(keyArray)

			processCall(cleanKey, keyArray, method, data, client, zone)
				.then((result) => {
					const resultPayload: CallResultMessage = {
						type: 'call_result',
						callId,
						result: result.success ? result.result : undefined,
						error: result.success ? undefined : result.error
					}
					connection.ws.send(JSON.stringify(resultPayload))
				})
				.catch((err) => {
					syncLogger.error('Call processing error:', err)
					const errorPayload: CallResultMessage = {
						type: 'call_result',
						callId,
						error: err instanceof Error ? err.message : 'internal_error'
					}
					connection.ws.send(JSON.stringify(errorPayload))
				})
			break
		}

		default:
			syncLogger.warn(`Unsupported message type: ${type}`)
			break
	}
}

/**
 * Periodically ping connections to check if they are still alive.
 */
function monitorConnections() {
	const deadConnections: number[] = []

	_connections.forEach((conn, index) => {
		if (!conn.isAlive) {
			syncLogger.warn(`Connection ${conn.id} is dead. Terminating...`)
			conn.ws.terminate()
			deadConnections.push(index)
		} else {
			conn.isAlive = false
			const ping: MessagePayload = { data: undefined, type: 'ping' }
			conn.ws.send(JSON.stringify(ping))
		}
	})

	// Remove dead connections in reverse order to avoid index shifting issues
	deadConnections.reverse().forEach((index) => {
		const conn = _connections[index]
		// Handle unsubscription for all watched keys
		conn.watch.forEach((cleanKey) => {
			handleUnsubscribe(conn, cleanKey)
		})
		_connections.splice(index, 1)
	})
}

/**
 * Set up connection event handlers for WebSocket.
 */
function handleConnection(ws: WebSocket) {
	const connection: Connection = {
		id: nanoid(),
		isAlive: true,
		watch: [],
		ws,
		connectedAt: Date.now()
	}
	_connections.push(connection)
	syncLogger.debug('New connection established!', connection.id)

	// Send the client their assigned ID
	const connectedPayload: MessagePayload = {
		data: { clientId: connection.id },
		type: 'connected'
	}
	ws.send(JSON.stringify(connectedPayload))

	ws.on('close', () => {
		syncLogger.debug(`Connection ${connection.id} closed. Removing...`)

		// Clear any pending unsubscribes for this connection (they're closing anyway)
		Object.keys(_pendingUnsubscribes).forEach((pendingKey) => {
			if (pendingKey.startsWith(`${connection.id}:`)) {
				clearTimeout(_pendingUnsubscribes[pendingKey])
				delete _pendingUnsubscribes[pendingKey]
			}
		})

		// Handle unsubscription for all watched keys with host migration
		connection.watch.forEach((cleanKey) => {
			handleUnsubscribe(connection, cleanKey)
		})

		const index = _connections.findIndex((c) => c.id === connection.id)
		if (index > -1) {
			_connections.splice(index, 1)
		}
	})

	ws.on('message', (message) => handleMessage(connection, message.toString()))
}

/**
 * Create and start the WebSocket server.
 */
function start() {
	_wss = new WebSocketServer({ noServer: true })
	syncLogger.debug('WebSocket server created successfully.')

	setInterval(monitorConnections, 30_000)

	_wss.on('connection', handleConnection)

	const engine = getServerEngine<NodeEngine>()
	engine.registerWebsocket('/sync', (req, socket, head) => {
		const wss = getSocketServer()
		wss?.handleUpgrade(req, socket, head, (ws) => {
			wss?.emit('connection', ws, req)
		})
	})
}

/**
 * Get a server-side Zone handle for direct state manipulation.
 *
 * @example
 * const zone = SyncServer.getZone(['game', 'room1'])
 * zone.setState({ score: 100 })
 * zone.broadcast({ event: 'powerup' })
 */
function getZone<T = unknown>(key: (string | null)[]): ServerZone<T> {
	const cleanKey = normalizeKey(key)
	// Filter out nulls for MessagePayload compatibility
	const keyArray = key.filter((k): k is string => k !== null)

	return {
		getState(): T | undefined {
			return _state[cleanKey] as T | undefined
		},

		setState(data: T): void {
			_state[cleanKey] = data
			syncLogger.debug(`Server set state for ${cleanKey}`)
			broadcastUpdate(cleanKey, data, keyArray)
		},

		setHost(clientId: string | null): void {
			if (clientId === null) {
				// Clear host - next subscriber will become host
				delete _keyHosts[cleanKey]
				syncLogger.debug(`Server cleared host for ${cleanKey}`)
			} else {
				// Verify client is subscribed before setting as host
				const subscribers = _keySubscribers[cleanKey] || []
				if (!subscribers.includes(clientId)) {
					syncLogger.warn(`Cannot set host to ${clientId} - not subscribed to ${cleanKey}`)
					return
				}
				_keyHosts[cleanKey] = clientId
				syncLogger.debug(`Server set host to ${clientId} for ${cleanKey}`)
			}

			// Broadcast updated clients/host info
			if (_keySubscribers[cleanKey]?.length > 0) {
				broadcastClientsUpdate(cleanKey)
			}

			// Send setHost message so clients know it was server-initiated
			const payload: MessagePayload = {
				data: { hostId: _keyHosts[cleanKey] || null },
				key: keyArray,
				type: 'setHost'
			}
			_connections
				.filter((c) => c.watch.includes(cleanKey))
				.forEach((c) => {
					syncLogger.debug(`Sending setHost to ${c.id}`)
					c.ws.send(JSON.stringify(payload))
				})
		},

		getHost(): string | undefined {
			return _keyHosts[cleanKey]
		},

		getClients(): Client[] {
			return getClientsForKey(cleanKey)
		},

		broadcast(payload: unknown): void {
			const broadcastPayload: MessagePayload = {
				data: payload,
				key: keyArray,
				type: 'broadcast',
				fromClientId: '__server__'
			}

			_connections
				.filter((c) => c.watch.includes(cleanKey))
				.forEach((c) => {
					syncLogger.debug(`Server broadcasting to ${c.id}`)
					c.ws.send(JSON.stringify(broadcastPayload))
				})
		},

		send(clientId: string, payload: unknown): void {
			const targetConnection = _connections.find((c) => c.id === clientId)

			if (!targetConnection) {
				syncLogger.warn(`Cannot send to ${clientId} - connection not found`)
				return
			}

			if (!targetConnection.watch.includes(cleanKey)) {
				syncLogger.warn(`Cannot send to ${clientId} - not watching ${cleanKey}`)
				return
			}

			const sendPayload: MessagePayload = {
				data: payload,
				key: keyArray,
				type: 'send',
				fromClientId: '__server__'
			}
			syncLogger.debug(`Server sending to ${clientId}`)
			targetConnection.ws.send(JSON.stringify(sendPayload))
		}
	}
}
