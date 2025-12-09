import { SyncContext } from './context.js'
import { useCallback, useContext } from 'react'
import { nanoid } from 'nanoid'

/**
 * Result of an RPC call.
 */
export interface CallResult<T = unknown> {
	success: boolean
	result?: T
	error?: string
}

/**
 * The call function type returned by useSyncCall.
 */
export type SyncCallFunction = <Payload = unknown, Result = unknown>(
	method: string,
	payload?: Payload
) => Promise<CallResult<Result>>

/**
 * Hook for making RPC calls to server-side sync handlers.
 *
 * Use this for server-authoritative operations where the server
 * should validate and process the action, rather than direct state updates.
 *
 * @example
 * // Basic usage
 * const call = useSyncCall(['game', roomId])
 *
 * const handleMove = async (x: number, y: number) => {
 *   const result = await call('move', { x, y })
 *   if (!result.success) {
 *     console.log('Move rejected:', result.error)
 *   }
 * }
 *
 * @example
 * // With typed result
 * interface CollectResult {
 *   points: number
 * }
 *
 * const result = await call<{ coinId: string }, CollectResult>('collectCoin', { coinId })
 * if (result.success) {
 *   console.log('Collected', result.result?.points, 'points!')
 * }
 */
export function useSyncCall(key: (string | null)[]): SyncCallFunction {
	const { connected, ws, registerCallResultCallback } = useContext(SyncContext)

	const call = useCallback<SyncCallFunction>(
		async <Payload = unknown, Result = unknown>(method: string, payload?: Payload): Promise<CallResult<Result>> => {
			if (!connected || !ws) {
				return { success: false, error: 'not_connected' }
			}

			const callId = nanoid()

			// Create promise that will be resolved when response arrives
			const resultPromise = new Promise<CallResult<Result>>((resolve) => {
				// Set up timeout
				const timeoutId = setTimeout(() => {
					resolve({ success: false, error: 'timeout' })
				}, 30000)

				// Register callback for this call's result
				registerCallResultCallback(callId, (result) => {
					clearTimeout(timeoutId)
					resolve(result as CallResult<Result>)
				})
			})

			// Send the call message
			ws.send(
				JSON.stringify({
					type: 'call',
					key,
					callId,
					method,
					data: payload
				})
			)

			return resultPromise
		},
		[connected, ws, key, registerCallResultCallback]
	)

	return call
}
