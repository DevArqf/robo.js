import { useSyncBroadcast } from './useSyncBroadcast.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Client } from './types.js'

/**
 * Options for useSyncCursor hook.
 */
export interface CursorOptions {
	/** Milliseconds between cursor updates (default: 16 for ~60fps) */
	throttle?: number
	/** Convert coordinates to 0-1 viewport range (default: true) */
	normalize?: boolean
	/** Set active=false when mouse leaves window (default: true) */
	hideOnLeave?: boolean
	/** Milliseconds before removing inactive cursors (default: 3000) */
	inactiveTimeout?: number
	/** Automatically track mouse movement (default: false). Set to true for convenience, or false for manual control via updatePosition. */
	autoTrack?: boolean
}

/**
 * Cursor position data.
 */
export interface CursorPosition {
	x: number
	y: number
	active: boolean
}

/**
 * Represents a remote cursor with client info.
 */
export interface RemoteCursor<ClientData = unknown> {
	/** Client ID of cursor owner */
	clientId: string
	/** Client metadata */
	user: Client<ClientData>
	/** Cursor position */
	position: CursorPosition
	/** Whether this is the current client's cursor */
	isYou: boolean
}

/**
 * Result returned by useSyncCursor hook.
 */
export interface CursorResult<ClientData = unknown> {
	/** All cursors including yours */
	cursors: RemoteCursor<ClientData>[]
	/** Only other users' cursors (use this for rendering to avoid self-rerenders) */
	remoteCursors: RemoteCursor<ClientData>[]
	/** Manually update cursor position (useful for custom tracking) */
	updatePosition: (pos: { x: number; y: number; active?: boolean }) => void
	/** Current client ID */
	clientId: string
}

// Broadcast message type for cursor updates
interface CursorBroadcastPayload {
	type: 'cursor'
	position: CursorPosition
}

const DEFAULT_THROTTLE = 16 // ~60fps
const DEFAULT_INACTIVE_TIMEOUT = 3000

/**
 * Hook for tracking and broadcasting cursor positions in real-time.
 *
 * Optimized to avoid rerenders for your own cursor movement - only remote
 * cursor changes trigger React state updates.
 *
 * @example
 * // Manual tracking (default) - you control when to update
 * const { remoteCursors, updatePosition } = useSyncCursor(['room', odId])
 *
 * useEffect(() => {
 *   const handleMove = (e: MouseEvent) => {
 *     updatePosition({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight })
 *   }
 *   window.addEventListener('mousemove', handleMove)
 *   return () => window.removeEventListener('mousemove', handleMove)
 * }, [updatePosition])
 *
 * @example
 * // Auto tracking - cursor position is tracked automatically
 * const { remoteCursors } = useSyncCursor(['room', odId], { autoTrack: true })
 *
 * @example
 * // Render only remote cursors (your cursor is handled by the browser)
 * {remoteCursors.map((cursor) => (
 *   <div key={cursor.clientId} style={{ left: cursor.position.x * 100 + '%', top: cursor.position.y * 100 + '%' }}>
 *     {cursor.user.data?.name}
 *   </div>
 * ))}
 */
export function useSyncCursor<ClientData = unknown>(
	key: (string | null)[],
	options?: CursorOptions
): CursorResult<ClientData> {
	const { throttle = DEFAULT_THROTTLE, normalize = true, hideOnLeave = true, inactiveTimeout = DEFAULT_INACTIVE_TIMEOUT, autoTrack = false } = options ?? {}

	// Cursor-specific key
	const cursorKey = [...key, '__cursors']

	// Remote cursors state - only this triggers rerenders
	const [remoteCursorsMap, setRemoteCursorsMap] = useState<Map<string, { position: CursorPosition; lastSeen: number }>>(
		new Map()
	)

	// Own cursor position stored in ref (no rerender on own movement)
	const ownPositionRef = useRef<CursorPosition>({ x: 0.5, y: 0.5, active: false })

	// Throttling refs
	const lastSentRef = useRef(0)
	const throttleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const pendingPositionRef = useRef<CursorPosition | null>(null)

	// Set up broadcast for cursor updates
	const { broadcast, context } = useSyncBroadcast<ClientData>(
		(payload, { client }) => {
			const cursorPayload = payload as CursorBroadcastPayload
			if (cursorPayload.type !== 'cursor') return

			// Update remote cursor map (triggers rerender)
			setRemoteCursorsMap((prev) => {
				const next = new Map(prev)
				next.set(client.id, {
					position: cursorPayload.position,
					lastSeen: Date.now()
				})
				return next
			})
		},
		cursorKey
	)

	// Clean up inactive cursors periodically
	useEffect(() => {
		const interval = setInterval(() => {
			setRemoteCursorsMap((prev) => {
				const now = Date.now()
				let hasChanges = false
				const next = new Map(prev)

				for (const [clientId, data] of next) {
					if (now - data.lastSeen > inactiveTimeout) {
						next.delete(clientId)
						hasChanges = true
					}
				}

				return hasChanges ? next : prev
			})
		}, 1000)

		return () => clearInterval(interval)
	}, [inactiveTimeout])

	// Clean up throttle timeout on unmount
	useEffect(() => {
		return () => {
			if (throttleTimeoutRef.current) {
				clearTimeout(throttleTimeoutRef.current)
			}
		}
	}, [])

	// Send cursor update with throttling
	const sendUpdate = useCallback(
		(position: CursorPosition) => {
			const payload: CursorBroadcastPayload = { type: 'cursor', position }
			broadcast(payload)
			lastSentRef.current = Date.now()
		},
		[broadcast]
	)

	// Update position function with throttling
	const updatePosition = useCallback(
		(pos: { x: number; y: number; active?: boolean }) => {
			const position: CursorPosition = {
				x: pos.x,
				y: pos.y,
				active: pos.active ?? true
			}

			// Update own ref (no rerender)
			ownPositionRef.current = position

			// Throttled broadcast
			const now = Date.now()
			const timeSinceLastSent = now - lastSentRef.current

			if (timeSinceLastSent >= throttle) {
				// Enough time passed, send immediately
				sendUpdate(position)
				if (throttleTimeoutRef.current) {
					clearTimeout(throttleTimeoutRef.current)
					throttleTimeoutRef.current = null
				}
				pendingPositionRef.current = null
			} else {
				// Schedule send for later
				pendingPositionRef.current = position
				if (!throttleTimeoutRef.current) {
					throttleTimeoutRef.current = setTimeout(() => {
						if (pendingPositionRef.current) {
							sendUpdate(pendingPositionRef.current)
							pendingPositionRef.current = null
						}
						throttleTimeoutRef.current = null
					}, throttle - timeSinceLastSent)
				}
			}
		},
		[throttle, sendUpdate]
	)

	// Set up automatic mouse tracking (only when autoTrack is enabled)
	useEffect(() => {
		if (!autoTrack) return

		const handleMouseMove = (e: MouseEvent) => {
			const x = normalize ? e.clientX / window.innerWidth : e.clientX
			const y = normalize ? e.clientY / window.innerHeight : e.clientY
			updatePosition({ x, y, active: true })
		}

		const handleMouseLeave = () => {
			if (hideOnLeave) {
				updatePosition({ ...ownPositionRef.current, active: false })
			}
		}

		const handleMouseEnter = () => {
			if (hideOnLeave) {
				updatePosition({ ...ownPositionRef.current, active: true })
			}
		}

		document.addEventListener('mousemove', handleMouseMove)
		document.addEventListener('mouseleave', handleMouseLeave)
		document.addEventListener('mouseenter', handleMouseEnter)

		return () => {
			document.removeEventListener('mousemove', handleMouseMove)
			document.removeEventListener('mouseleave', handleMouseLeave)
			document.removeEventListener('mouseenter', handleMouseEnter)
		}
	}, [autoTrack, normalize, hideOnLeave, updatePosition])

	// Build remote cursors array from map and clients
	const remoteCursors: RemoteCursor<ClientData>[] = []
	const allCursors: RemoteCursor<ClientData>[] = []

	// Add own cursor to all cursors list
	const ownClient = context.clients.find((c) => c.id === context.clientId)
	if (ownClient) {
		allCursors.push({
			clientId: context.clientId,
			user: ownClient,
			position: ownPositionRef.current,
			isYou: true
		})
	}

	// Add remote cursors
	for (const client of context.clients) {
		if (client.id === context.clientId) continue

		const cursorData = remoteCursorsMap.get(client.id)
		if (cursorData) {
			const cursor: RemoteCursor<ClientData> = {
				clientId: client.id,
				user: client,
				position: cursorData.position,
				isYou: false
			}
			remoteCursors.push(cursor)
			allCursors.push(cursor)
		}
	}

	return {
		cursors: allCursors,
		remoteCursors,
		updatePosition,
		clientId: context.clientId
	}
}
