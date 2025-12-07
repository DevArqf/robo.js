import { normalizeKey } from './utils.js'
import React, { createContext, useEffect, useRef, useState } from 'react'
import type { BroadcastCallback, Client, ContextCallback, ContextEvent, MessagePayload } from './types.js'

interface SyncContextValue {
	cache: Record<string, unknown>
	clientId: string
	clientsCache: Record<string, Client[]>
	connected: boolean
	hostsCache: Record<string, string>
	registerBroadcastCallback: (key: (string | null)[], callback: BroadcastCallback) => string
	registerCallback: (key: (string | null)[], callback: UpdateCallback) => string
	registerContextCallback: (key: (string | null)[], callback: ContextCallback) => string
	unregisterBroadcastCallback: (callbackId: string) => void
	unregisterCallback: (callbackId: string) => void
	unregisterContextCallback: (callbackId: string) => void
	ws: WebSocket | null
}

export const SyncContext = createContext<SyncContextValue>({
	cache: {},
	clientId: '',
	clientsCache: {},
	connected: false,
	hostsCache: {},
	registerBroadcastCallback: () => '',
	registerCallback: () => '',
	registerContextCallback: () => '',
	unregisterBroadcastCallback: () => {
		/* no-op */
	},
	unregisterCallback: () => {
		/* no-op */
	},
	unregisterContextCallback: () => {
		/* no-op */
	},
	ws: null as WebSocket | null
})

interface SyncContextProviderProps<ClientData = unknown> {
	children: React.ReactNode
	clientData?: ClientData
	loadingScreen?: React.ReactNode
}

export function SyncContextProvider<ClientData = unknown>(props: SyncContextProviderProps<ClientData>) {
	const { children, clientData, loadingScreen = null } = props
	const context = setupSyncState(clientData)

	if (loadingScreen && (!context.connected || !context.ws)) {
		return <>{loadingScreen}</>
	}

	return <SyncContext.Provider value={context}>{children}</SyncContext.Provider>
}

type CallbackEntry = { key: string; callback: UpdateCallback; originalKey: (string | null)[] }
type ContextCallbackEntry = { key: string; callback: ContextCallback; originalKey: (string | null)[] }
type BroadcastCallbackEntry = { key: string; callback: BroadcastCallback; originalKey: (string | null)[] }
type UpdateCallback = (data: unknown, key: (string | null)[]) => void

let IdCounter = 0

function setupSyncState<ClientData = unknown>(clientData?: ClientData): SyncContextValue {
	const [ws, setWs] = useState<WebSocket | null>(null)
	const [connected, setConnected] = useState(false)
	const [clientId, setClientId] = useState('')

	const cache = useRef<Record<string, unknown>>({}).current
	const clientsCache = useRef<Record<string, Client[]>>({}).current
	const hostsCache = useRef<Record<string, string>>({}).current

	// Unified subscription tracking - counts total subscriptions per key
	const subscriptionCounts = useRef<Record<string, number>>({}).current

	const callbacks = useRef<Record<string, UpdateCallback[]>>({}).current
	const callbackMap = useRef<Record<string, CallbackEntry>>({}).current

	const contextCallbacks = useRef<Record<string, ContextCallback[]>>({}).current
	const contextCallbackMap = useRef<Record<string, ContextCallbackEntry>>({}).current

	const broadcastCallbacks = useRef<Record<string, BroadcastCallback[]>>({}).current
	const broadcastCallbackMap = useRef<Record<string, BroadcastCallbackEntry>>({}).current

	const isRunning = useRef(false)
	const pendingMetadata = useRef<ClientData | undefined>(clientData)
	const wsRef = useRef<WebSocket | null>(null)

	// Helper to subscribe to a key (sends 'on' if first subscription)
	const subscribe = (cleanKey: string, originalKey: (string | null)[]) => {
		const currentWs = wsRef.current
		if (!subscriptionCounts[cleanKey]) {
			subscriptionCounts[cleanKey] = 0
		}
		subscriptionCounts[cleanKey]++

		// Send 'on' message if this is the first subscription for this key
		if (subscriptionCounts[cleanKey] === 1 && currentWs?.readyState === WebSocket.OPEN) {
			currentWs.send(JSON.stringify({ key: originalKey, type: 'on' }))
		}
	}

	// Helper to unsubscribe from a key (sends 'off' if last subscription)
	const unsubscribe = (cleanKey: string, originalKey: (string | null)[]) => {
		const currentWs = wsRef.current
		if (subscriptionCounts[cleanKey]) {
			subscriptionCounts[cleanKey]--

			// Send 'off' message if this was the last subscription for this key
			if (subscriptionCounts[cleanKey] === 0 && currentWs?.readyState === WebSocket.OPEN) {
				currentWs.send(JSON.stringify({ key: originalKey, type: 'off' }))
			}
		}
	}

	useEffect(() => {
		if (isRunning.current) {
			return
		}

		isRunning.current = true
		const wsProtocol = location.protocol === 'http:' ? 'ws' : 'wss'
		const websocket = new WebSocket(`${wsProtocol}://${location.host}/sync`)
		wsRef.current = websocket

		websocket.onopen = () => {
			console.log('Connection established at', new Date().toISOString())
			setConnected(true)
		}

		websocket.onclose = () => {
			console.log('Connection closed at', new Date().toISOString())
			setConnected(false)
		}

		websocket.onerror = (error) => {
			console.error('Websocket error:', error)
		}

		websocket.onmessage = (event) => {
			// Only handle parseable messages
			if (typeof event.data !== 'string') {
				return
			}

			const payload = JSON.parse(event.data) as MessagePayload
			let response: MessagePayload | null = null

			switch (payload.type) {
				case 'ping':
					response = { data: undefined, type: 'pong' }
					break

				case 'connected': {
					// Server assigns our client ID
					const { clientId: id } = payload.data as { clientId: string }
					setClientId(id)

					// Send pending metadata if any
					if (pendingMetadata.current !== undefined) {
						websocket.send(
							JSON.stringify({
								data: pendingMetadata.current,
								type: 'metadata'
							})
						)
					}
					break
				}

				case 'clients': {
					// Server sends updated clients list for a key
					const { clients, hostId } = payload.data as { clients: Client[]; hostId: string }
					const cleanKey = normalizeKey(payload.key)

					clientsCache[cleanKey] = clients
					hostsCache[cleanKey] = hostId

					// Notify context callbacks
					if (contextCallbacks[cleanKey]) {
						const event: ContextEvent = { type: 'clients', clients, hostId }
						contextCallbacks[cleanKey].forEach((callback) => {
							try {
								callback(event)
							} catch (error) {
								console.error('Context callback error:', error)
							}
						})
					}
					break
				}

				case 'join': {
					// A client joined this key/room
					const client = payload.data as Client
					const cleanKey = normalizeKey(payload.key)

					if (contextCallbacks[cleanKey]) {
						const event: ContextEvent = { type: 'join', client }
						contextCallbacks[cleanKey].forEach((callback) => {
							try {
								callback(event)
							} catch (error) {
								console.error('Context callback error:', error)
							}
						})
					}
					break
				}

				case 'leave': {
					// A client left this key/room
					const client = payload.data as Client
					const cleanKey = normalizeKey(payload.key)

					if (contextCallbacks[cleanKey]) {
						const event: ContextEvent = { type: 'leave', client }
						contextCallbacks[cleanKey].forEach((callback) => {
							try {
								callback(event)
							} catch (error) {
								console.error('Context callback error:', error)
							}
						})
					}
					break
				}

				case 'broadcast':
				case 'send': {
					// Ephemeral message from another client
					const { fromClientId } = payload
					const cleanKey = normalizeKey(payload.key)

					if (broadcastCallbacks[cleanKey]) {
						const senderClient = clientsCache[cleanKey]?.find((c) => c.id === fromClientId) || {
							id: fromClientId || ''
						}
						broadcastCallbacks[cleanKey].forEach((callback) => {
							try {
								callback(payload.data, senderClient)
							} catch (error) {
								console.error('Broadcast callback error:', error)
							}
						})
					}
					break
				}

				case 'update': {
					const { key, data } = payload
					const cleanKey = normalizeKey(key)

					// Ignore if data is undefined
					if (data === undefined) {
						break
					}

					// Broadcast the update to all callbacks
					if (callbacks[cleanKey]) {
						callbacks[cleanKey].forEach((callback) => {
							try {
								callback(data, key as string[])
							} catch (error) {
								console.error('Callback error:', error)
							}
						})
					}

					// Cache the data
					cache[cleanKey] = data
					break
				}
			}

			if (response) {
				websocket.send(JSON.stringify(response))
			}
		}

		setWs(websocket)
	}, [])

	const registerCallback = (key: (string | null)[], callback: UpdateCallback) => {
		const cleanKey = normalizeKey(key)
		const callbackId = '' + IdCounter++

		// Add the callback to indices
		if (!callbacks[cleanKey]) {
			callbacks[cleanKey] = []
		}

		callbacks[cleanKey].push(callback)
		callbackMap[callbackId] = {
			key: cleanKey,
			callback,
			originalKey: key
		}

		// Subscribe to updates for this key
		subscribe(cleanKey, key)

		// Apply last known state to the new callback if available
		if (cache[cleanKey] !== undefined) {
			callback(cache[cleanKey], key)
		}

		return callbackId
	}

	const unregisterCallback = (callbackId: string) => {
		const entry = callbackMap[callbackId]
		if (!entry) return

		const index = callbacks[entry.key].findIndex((cb) => cb === entry.callback)

		// Remove the callback from indices
		if (index > -1) {
			callbacks[entry.key].splice(index, 1)
		}
		delete callbackMap[callbackId]

		// Unsubscribe from this key
		unsubscribe(entry.key, entry.originalKey)
	}

	const registerContextCallback = (key: (string | null)[], callback: ContextCallback) => {
		const cleanKey = normalizeKey(key)
		const callbackId = '' + IdCounter++

		// Add the callback to indices
		if (!contextCallbacks[cleanKey]) {
			contextCallbacks[cleanKey] = []
		}

		contextCallbacks[cleanKey].push(callback)
		contextCallbackMap[callbackId] = {
			key: cleanKey,
			callback,
			originalKey: key
		}

		// Subscribe to updates for this key
		subscribe(cleanKey, key)

		// If we already have cached clients, immediately notify
		if (clientsCache[cleanKey]) {
			const event: ContextEvent = {
				type: 'clients',
				clients: clientsCache[cleanKey],
				hostId: hostsCache[cleanKey] || ''
			}
			try {
				callback(event)
			} catch (error) {
				console.error('Context callback error:', error)
			}
		}

		return callbackId
	}

	const unregisterContextCallback = (callbackId: string) => {
		const entry = contextCallbackMap[callbackId]
		if (!entry) return

		const index = contextCallbacks[entry.key].findIndex((cb) => cb === entry.callback)

		if (index > -1) {
			contextCallbacks[entry.key].splice(index, 1)
		}
		delete contextCallbackMap[callbackId]

		// Unsubscribe from this key
		unsubscribe(entry.key, entry.originalKey)
	}

	const registerBroadcastCallback = (key: (string | null)[], callback: BroadcastCallback) => {
		const cleanKey = normalizeKey(key)
		const callbackId = '' + IdCounter++

		// Add the callback to indices
		if (!broadcastCallbacks[cleanKey]) {
			broadcastCallbacks[cleanKey] = []
		}

		broadcastCallbacks[cleanKey].push(callback)
		broadcastCallbackMap[callbackId] = {
			key: cleanKey,
			callback,
			originalKey: key
		}

		// Subscribe to updates for this key
		subscribe(cleanKey, key)

		return callbackId
	}

	const unregisterBroadcastCallback = (callbackId: string) => {
		const entry = broadcastCallbackMap[callbackId]
		if (!entry) return

		const index = broadcastCallbacks[entry.key].findIndex((cb) => cb === entry.callback)

		if (index > -1) {
			broadcastCallbacks[entry.key].splice(index, 1)
		}
		delete broadcastCallbackMap[callbackId]

		// Unsubscribe from this key
		unsubscribe(entry.key, entry.originalKey)
	}

	return {
		cache,
		clientId,
		clientsCache,
		connected,
		hostsCache,
		registerBroadcastCallback,
		registerCallback,
		registerContextCallback,
		unregisterBroadcastCallback,
		unregisterCallback,
		unregisterContextCallback,
		ws
	}
}
