import { SyncContext } from './context.js'
import { normalizeKey } from './utils.js'
import { useSyncContext } from './useSyncContext.js'
import { useContext, useEffect, useState } from 'react'
import type { SyncContext as SyncContextType } from './types.js'

/**
 * Hook for synchronized state across clients.
 *
 * Works like React's useState, but the state is shared across all clients
 * subscribed to the same key. Updates from any client are broadcast to all others.
 *
 * @example
 * // Basic usage (backward compatible)
 * const [position, setPosition] = useSyncState({ x: 0, y: 0 }, ['player-position'])
 *
 * @example
 * // With context (new in v2)
 * const [gameState, setGameState, context] = useSyncState(initialGameState, ['game-room'])
 * console.log(context.clients, context.isHost)
 */
export function useSyncState<T, ClientData = unknown>(
	initialState: T,
	key: (string | null)[]
): readonly [T, (newState: Partial<T> | ((prevState: T) => T)) => void, SyncContextType<ClientData>] {
	const { cache, connected, registerCallback, unregisterCallback, ws } = useContext(SyncContext)
	const [state, setState] = useState(initialState)
	const [queuedState, setQueuedState] = useState<Partial<T> | null>(null)
	const hasWs = !!ws
	const cleanKey = normalizeKey(key)

	// Get context for this key
	const context = useSyncContext<ClientData>(key)

	const setSyncState = (newState: Partial<T> | ((prevState: T) => T)) => {
		// Run updater function if provided that way
		const currentState = (cache[cleanKey] as T) ?? initialState

		if (typeof newState === 'function') {
			newState = newState(currentState)
		}

		// Send the state update to the server
		if (connected && ws) {
			ws.send(JSON.stringify({ data: newState, key, type: 'update' }))
		} else {
			// Queue the state update
			setQueuedState(newState)
		}
	}

	useEffect(() => {
		// Send the queued state if the connection is established
		if (queuedState && connected && hasWs) {
			setSyncState(queuedState)
			setQueuedState(null)
		}

		if (connected && hasWs) {
			// Register the callback to update the state
			const callbackId = registerCallback(key, (data, receivedKey) => {
				const receivedCleanKey = normalizeKey(receivedKey)
				if (receivedCleanKey === cleanKey) {
					setState(data as T)
				}
			})

			// Unregister the callback when the component unmounts
			return () => {
				unregisterCallback(callbackId)
			}
		}
	}, [connected, hasWs])

	return [state, setSyncState, context] as const
}
