import { SyncContext } from './context.js'
import { normalizeKey } from './utils.js'
import { useSyncContext } from './useSyncContext.js'
import { useContext, useEffect, useRef } from 'react'
import type { Client, SyncBroadcastResult } from './types.js'

type BroadcastHandler<ClientData = unknown> = (payload: unknown, context: { client: Client<ClientData> }) => void

/**
 * Hook for sending and receiving ephemeral broadcasts in a sync room.
 *
 * Unlike state updates, broadcasts are fire-and-forget messages that don't
 * persist and don't trigger re-renders of other components. They're ideal
 * for things like cursor movements, typing indicators, or game actions.
 *
 * @example
 * const { broadcast, context, send } = useSyncBroadcast((message, { client }) => {
 *   console.log(client.id, 'said', message)
 * }, ['chat-room'])
 *
 * // Send to everyone
 * broadcast('Hello!')
 *
 * // Send to specific client
 * send(targetClientId, 'Private message')
 */
export function useSyncBroadcast<ClientData = unknown>(
	handler: BroadcastHandler<ClientData>,
	key: (string | null)[]
): SyncBroadcastResult<ClientData> {
	const { connected, registerBroadcastCallback, unregisterBroadcastCallback, ws } = useContext(SyncContext)

	const context = useSyncContext<ClientData>(key)
	const handlerRef = useRef(handler)
	handlerRef.current = handler
	const cleanKey = normalizeKey(key)

	useEffect(() => {
		if (!connected || !ws) return

		const callbackId = registerBroadcastCallback(key, (payload, client) => {
			handlerRef.current(payload, { client: client as Client<ClientData> })
		})

		return () => {
			unregisterBroadcastCallback(callbackId)
		}
	}, [connected, ws, cleanKey])

	return {
		broadcast: context.broadcast,
		context,
		send: context.send
	}
}
