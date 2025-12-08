import { useCallback, useEffect } from 'react'
import { useSyncState } from '@robojs/sync'
import { useDiscordSdk } from './useDiscordSdk'
import type { Players } from '../types/game'
import type { CharacterId } from '../types/character'

export interface UsePlayerSyncResult {
	players: Players
	initializePlayer: (x: number, y: number, characterId: CharacterId, username: string) => void
	updatePosition: (x: number, y: number) => void
	removePlayer: () => void
}

/**
 * Hook to manage player state synchronization
 * Handles syncing player positions and data across clients
 */
export function usePlayerSync(currentUserId: string | undefined): UsePlayerSyncResult {
	// Get discordSdk from context to ensure proper initialization
	const { discordSdk } = useDiscordSdk()

	// Debug logging
	useEffect(() => {
		console.log('[usePlayerSync] channelId:', discordSdk.channelId)
		console.log('[usePlayerSync] currentUserId:', currentUserId)
	}, [discordSdk.channelId, currentUserId])

	// Use a fixed key with channelId from context - all clients in same channel will sync together
	const [players, setPlayers] = useSyncState<Players>({}, ['players', discordSdk.channelId])

	// Debug: log players state changes
	useEffect(() => {
		console.log('[usePlayerSync] players state:', players)
		console.log('[usePlayerSync] player count:', Object.keys(players).length)
	}, [players])

	// Initialize player with full data (called once when entering game)
	const initializePlayer = useCallback(
		(x: number, y: number, characterId: CharacterId, username: string) => {
			if (!currentUserId) {
				console.log('[usePlayerSync] initializePlayer: no currentUserId')
				return
			}

			console.log('[usePlayerSync] initializePlayer:', { currentUserId, x, y, characterId, username })
			setPlayers((prev) => ({
				...prev,
				[currentUserId]: { x, y, characterId, username }
			}))
		},
		[currentUserId, setPlayers]
	)

	// Update player position (called from game loop)
	const updatePosition = useCallback(
		(x: number, y: number) => {
			if (!currentUserId) return

			setPlayers((prev) => {
				const existing = prev[currentUserId]
				if (!existing) return prev

				return {
					...prev,
					[currentUserId]: { ...existing, x, y }
				}
			})
		},
		[currentUserId, setPlayers]
	)

	// Remove player (called when leaving)
	const removePlayer = useCallback(() => {
		if (!currentUserId) return

		console.log('[usePlayerSync] removePlayer:', currentUserId)
		setPlayers((prev) => {
			const next = { ...prev }
			delete next[currentUserId]
			return next
		})
	}, [currentUserId, setPlayers])

	return {
		players,
		initializePlayer,
		updatePosition,
		removePlayer
	}
}
