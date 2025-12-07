import { SyncContext } from './context.js'
import { normalizeKey } from './utils.js'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { Client, SyncContext as SyncContextType, SyncContextOptions } from './types.js'

type UseSyncContextOptions<ClientData> = SyncContextOptions<ClientData> | (string | null)[]

/**
 * Hook to access the sync context for a given key/room.
 *
 * @example
 * // Basic usage - get context only
 * const ctx = useSyncContext(['game-room'])
 * console.log(ctx.clients, ctx.isHost)
 *
 * @example
 * // With callbacks for connect/disconnect events
 * useSyncContext({
 *   onConnect: (client) => console.log(client.id, 'joined'),
 *   onDisconnect: (client) => console.log(client.id, 'left')
 * }, ['game-room'])
 */
export function useSyncContext<ClientData = unknown>(
	optionsOrKey: UseSyncContextOptions<ClientData>,
	keyIfOptions?: (string | null)[]
): SyncContextType<ClientData> {
	// Parse arguments - support both signatures
	const options: SyncContextOptions<ClientData> = Array.isArray(optionsOrKey) ? {} : optionsOrKey
	const key = Array.isArray(optionsOrKey) ? optionsOrKey : keyIfOptions!

	const {
		clientId: ownClientId,
		clientsCache,
		connected,
		hostsCache,
		registerContextCallback,
		unregisterContextCallback,
		ws
	} = useContext(SyncContext)

	const [clients, setClients] = useState<Client<ClientData>[]>([])
	const [hostId, setHostId] = useState<string>('')
	const cleanKey = normalizeKey(key)

	const optionsRef = useRef(options)
	optionsRef.current = options

	useEffect(() => {
		if (!connected || !ws) return

		// Initialize from cache if available
		if (clientsCache[cleanKey]) {
			setClients(clientsCache[cleanKey] as Client<ClientData>[])
			setHostId(hostsCache[cleanKey] || '')
		}

		const callbackId = registerContextCallback(key, (event) => {
			switch (event.type) {
				case 'clients':
					setClients(event.clients as Client<ClientData>[])
					setHostId(event.hostId)
					break
				case 'join':
					optionsRef.current.onConnect?.(event.client as Client<ClientData>)
					break
				case 'leave':
					optionsRef.current.onDisconnect?.(event.client as Client<ClientData>)
					break
			}
		})

		return () => {
			unregisterContextCallback(callbackId)
		}
	}, [connected, ws, cleanKey])

	const broadcast = useCallback(
		(payload: unknown) => {
			if (connected && ws) {
				ws.send(JSON.stringify({ data: payload, key, type: 'broadcast' }))
			}
		},
		[connected, ws, cleanKey]
	)

	const send = useCallback(
		(clientId: string, payload: unknown) => {
			if (connected && ws) {
				ws.send(
					JSON.stringify({
						data: payload,
						key,
						type: 'send',
						targetClientId: clientId
					})
				)
			}
		},
		[connected, ws, cleanKey]
	)

	return {
		clients,
		clientId: ownClientId,
		isHost: hostId === ownClientId && ownClientId !== '',
		broadcast,
		send
	}
}
