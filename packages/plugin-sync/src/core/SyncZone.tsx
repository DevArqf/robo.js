import { SyncContext } from './context.js'
import { useSyncContext } from './useSyncContext.js'
import React, { createContext, useContext, useMemo } from 'react'
import type { ConnectionStatus, SyncZoneProps, ZoneContextValue } from './types.js'

/**
 * Context for zone prefix inheritance.
 * Used internally by SyncZone and consumed by useZoneContext/useZoneKey.
 */
export const ZoneContext = createContext<ZoneContextValue | null>(null)

/**
 * A context provider that establishes a sync zone with key prefix inheritance.
 *
 * Zones enable:
 * - Key prefix accumulation (nested zones combine prefixes)
 * - Host inheritance (all children share the zone's host determination)
 * - Component reusability (same component can be used in different zones)
 *
 * @example
 * // Basic zone
 * <SyncZone id={['game', 'room1']}>
 *   <SyncBox id={['player']} />  // key becomes 'game.room1.player'
 * </SyncZone>
 *
 * @example
 * // Nested zones
 * <SyncZone id={['game']}>
 *   <SyncZone id={['board']}>
 *     <SyncBox id={['piece']} />  // key becomes 'game.board.piece'
 *   </SyncZone>
 * </SyncZone>
 *
 * @example
 * // Explicit host
 * <SyncZone id={['match']} hostRules="explicit" host={adminClientId}>
 *   <GameBoard />
 * </SyncZone>
 */
export function SyncZone(props: SyncZoneProps) {
	const { id, hostRules = 'first', host: explicitHost, children } = props

	// Get parent zone context (if nested)
	const parentZone = useContext(ZoneContext)

	// Get root sync context for connection status
	const { connected, ws } = useContext(SyncContext)

	// Compute accumulated prefix
	const prefix = useMemo(() => {
		const parentPrefix = parentZone?.prefix ?? []
		return [...parentPrefix, ...id]
	}, [parentZone?.prefix, id])

	// Get sync context for this zone's key
	const syncContext = useSyncContext(prefix)

	// Determine connection status
	const connectionStatus: ConnectionStatus = useMemo(() => {
		if (!ws) return 'disconnected'
		if (!connected) return 'connecting'
		return 'connected'
	}, [ws, connected])

	// Determine host based on rules
	const hostId = useMemo(() => {
		if (hostRules === 'explicit' && explicitHost) {
			return explicitHost
		}
		// 'first' strategy: use the context's determined host (server-assigned)
		// The first subscriber becomes host automatically on the server
		if (syncContext.isHost) {
			return syncContext.clientId
		}
		// Find the first client in the list (that's the host)
		return syncContext.clients[0]?.id ?? ''
	}, [hostRules, explicitHost, syncContext.isHost, syncContext.clientId, syncContext.clients])

	const value: ZoneContextValue = useMemo(
		() => ({
			prefix,
			hostId,
			isHost: syncContext.clientId === hostId && hostId !== '',
			connectionStatus,
			clients: syncContext.clients,
			broadcast: syncContext.broadcast,
			send: syncContext.send
		}),
		[prefix, hostId, syncContext, connectionStatus]
	)

	return <ZoneContext.Provider value={value}>{children}</ZoneContext.Provider>
}

/**
 * Hook to access the current zone context.
 * Returns null if not within a SyncZone.
 *
 * @example
 * function GameComponent() {
 *   const zone = useZoneContext()
 *   if (!zone) return <div>Not in a zone</div>
 *
 *   return (
 *     <div>
 *       Host: {zone.isHost ? 'You' : zone.hostId}
 *       Players: {zone.clients.length}
 *     </div>
 *   )
 * }
 */
export function useZoneContext<ClientData = unknown>(): ZoneContextValue<ClientData> | null {
	return useContext(ZoneContext) as ZoneContextValue<ClientData> | null
}

/**
 * Hook to compute the full key by combining zone prefix with a local id.
 * If not in a zone, returns the local id as-is.
 *
 * @example
 * function PlayerMarker({ playerId }) {
 *   const fullKey = useZoneKey(['player', playerId])
 *   // In <SyncZone id={['game']}>, fullKey = ['game', 'player', playerId]
 *   const [position, setPosition] = useSyncState({ x: 0, y: 0 }, fullKey)
 *   ...
 * }
 */
export function useZoneKey(localId: (string | null)[]): (string | null)[] {
	const zone = useContext(ZoneContext)
	return useMemo(() => {
		const prefix = zone?.prefix ?? []
		return [...prefix, ...localId]
	}, [zone?.prefix, localId])
}
