import { useSyncState } from './useSyncState.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Client, SyncContext } from './types.js'

/**
 * Options for useSyncPresence hook.
 */
export interface PresenceOptions<T> {
	/** Initial presence data for this client */
	initialPresence?: T
	/** Milliseconds before marking a user as stale (default: 5000) */
	staleTimeout?: number
	/** Interval for sending heartbeat updates (default: 2000ms) */
	heartbeatInterval?: number
}

/**
 * Represents a participant in the presence system.
 */
export interface Participant<T, ClientData = unknown> {
	/** The client's unique identifier */
	clientId: string
	/** Client metadata (name, avatar, etc.) */
	user: Client<ClientData>
	/** The client's presence data */
	presence: T
	/** Whether this participant's presence data is stale */
	isStale: boolean
	/** Whether this is the current client */
	isYou: boolean
}

/**
 * Result returned by useSyncPresence hook.
 */
export interface PresenceResult<T, ClientData = unknown> {
	/** Array of all participants with their presence data */
	participants: Participant<T, ClientData>[]
	/** Update the current client's presence data */
	updatePresence: (update: Partial<T> | ((prev: T) => T)) => void
	/** Current client's ID */
	clientId: string
	/** Whether current client is host */
	isHost: boolean
	/** Full sync context for advanced usage */
	context: SyncContext<ClientData>
}

// Internal state shape for presence map
interface PresenceEntry<T> {
	presence: T
	lastSeen: number
}

type PresenceMap<T> = Record<string, PresenceEntry<T>>

const DEFAULT_STALE_TIMEOUT = 5000
const DEFAULT_HEARTBEAT_INTERVAL = 2000

/**
 * Hook for tracking participant presence with arbitrary metadata.
 *
 * Provides a simple way to track who's connected and their current status,
 * activity, or any custom presence data.
 *
 * @example
 * const { participants, updatePresence } = useSyncPresence(['room', odId], {
 *   initialPresence: { status: 'online', activity: 'idle' }
 * })
 *
 * // Update your presence
 * updatePresence({ activity: 'typing' })
 *
 * // Render participants
 * {participants.map((p) => (
 *   <div key={p.clientId}>
 *     {p.user.data?.name} - {p.presence.status}
 *     {p.isStale && ' (away)'}
 *   </div>
 * ))}
 */
export function useSyncPresence<T = unknown, ClientData = unknown>(
	key: (string | null)[],
	options?: PresenceOptions<T>
): PresenceResult<T, ClientData> {
	const {
		initialPresence = {} as T,
		staleTimeout = DEFAULT_STALE_TIMEOUT,
		heartbeatInterval = DEFAULT_HEARTBEAT_INTERVAL
	} = options ?? {}

	// Full key for presence data
	const presenceKey = [...key, '__presence']

	// Sync the presence map across all clients
	const [presenceMap, setPresenceMap, context] = useSyncState<PresenceMap<T>, ClientData>({}, presenceKey)

	// Track our own presence locally for immediate updates
	const [localPresence, setLocalPresence] = useState<T>(initialPresence)
	const localPresenceRef = useRef(localPresence)
	localPresenceRef.current = localPresence

	// Track current time for stale detection
	const [now, setNow] = useState(Date.now())

	// Update stale detection periodically
	useEffect(() => {
		const interval = setInterval(() => {
			setNow(Date.now())
		}, 1000) // Check every second

		return () => clearInterval(interval)
	}, [])

	// Send heartbeat updates periodically
	useEffect(() => {
		if (!context.clientId) return

		// Initial presence update
		const sendUpdate = () => {
			setPresenceMap((prev) => ({
				...prev,
				[context.clientId]: {
					presence: localPresenceRef.current,
					lastSeen: Date.now()
				}
			}))
		}

		sendUpdate()

		// Periodic heartbeat
		const interval = setInterval(sendUpdate, heartbeatInterval)

		return () => {
			clearInterval(interval)
		}
	}, [context.clientId, heartbeatInterval, setPresenceMap])

	// Update presence function
	const updatePresence = useCallback(
		(update: Partial<T> | ((prev: T) => T)) => {
			setLocalPresence((prev) => {
				const newPresence = typeof update === 'function' ? update(prev) : { ...prev, ...update }
				return newPresence
			})

			// Immediately send the update
			setPresenceMap((prev) => ({
				...prev,
				[context.clientId]: {
					presence:
						typeof update === 'function'
							? update(localPresenceRef.current)
							: { ...localPresenceRef.current, ...update },
					lastSeen: Date.now()
				}
			}))
		},
		[context.clientId, setPresenceMap]
	)

	// Compute participants array from presence map and clients list
	const participants = useMemo((): Participant<T, ClientData>[] => {
		// Use context.clients as the source of truth for who's connected
		return context.clients
			.map((client) => {
				const entry = presenceMap[client.id]
				const isStale = entry ? now - entry.lastSeen > staleTimeout : true

				return {
					clientId: client.id,
					user: client,
					presence: entry?.presence ?? initialPresence,
					isStale: entry ? isStale : false, // New clients without presence data aren't stale, just not initialized
					isYou: client.id === context.clientId
				}
			})
			.sort((a, b) => {
				// Put current user first, then sort by client ID for consistency
				if (a.isYou) return -1
				if (b.isYou) return 1
				return a.clientId.localeCompare(b.clientId)
			})
	}, [context.clients, context.clientId, presenceMap, now, staleTimeout, initialPresence])

	return {
		participants,
		updatePresence,
		clientId: context.clientId,
		isHost: context.isHost,
		context
	}
}
