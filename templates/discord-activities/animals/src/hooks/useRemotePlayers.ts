import { Container, Assets, AnimatedSprite, Text, Rectangle, Texture } from 'pixi.js'
import { useEffect, useRef } from 'react'
import { useSyncState } from '@robojs/sync'
import { CHARACTERS } from '../config/characters'
import type { CharacterId } from '../types/character'

interface RemotePlayerSprite {
	container: Container
	sprite: AnimatedSprite
	nameLabel: Text
	characterId: CharacterId
}

interface PlayerData {
	x: number
	y: number
	characterId: CharacterId
	username: string
}

type AllPlayers = Record<string, PlayerData>

/**
 * Hook to render remote players from sync state
 * Simplified version that just uses useSyncState for everything
 */
export function useRemotePlayers(gameContainer: Container | null, currentClientId: string | undefined) {
	const remotePlayers = useRef<Map<string, RemotePlayerSprite>>(new Map())

	// Shared state for all players (positions + metadata)
	// Use 'game-room' as a shared room for all local testing
	const [players, setPlayers] = useSyncState<AllPlayers>({}, ['game-room', 'all-players'])

	console.log('[useRemotePlayers] Sync key:', ['game-room', 'all-players'])
	console.log('[useRemotePlayers] setPlayers type:', typeof setPlayers)

	// Debug logging
	useEffect(() => {
		console.log('[useRemotePlayers] players:', players)
		console.log('[useRemotePlayers] currentClientId:', currentClientId)
		console.log('[useRemotePlayers] gameContainer:', !!gameContainer)

		const otherPlayerIds = Object.keys(players).filter((id) => id !== currentClientId)
		console.log('[useRemotePlayers] other players:', otherPlayerIds)
	}, [players, currentClientId, gameContainer])

	useEffect(() => {
		if (!gameContainer || !currentClientId) {
			console.log('[useRemotePlayers] skipping - no gameContainer or currentClientId')
			return
		}

		const updateRemotePlayers = async () => {
			const currentRemote = remotePlayers.current
			const activePlayerIds = new Set(Object.keys(players).filter((id) => id !== currentClientId))

			console.log('[useRemotePlayers] activePlayerIds:', Array.from(activePlayerIds))

			// Remove players who left
			for (const [playerId, player] of currentRemote.entries()) {
				if (!activePlayerIds.has(playerId)) {
					console.log('[useRemotePlayers] removing player:', playerId)
					gameContainer.removeChild(player.container)
					player.container.destroy({ children: true })
					currentRemote.delete(playerId)
				}
			}

			// Add or update players
			for (const playerId of activePlayerIds) {
				const playerData = players[playerId]
				if (!playerData) continue

				let remotePlayer = currentRemote.get(playerId)

				// Create new player sprite if needed
				if (!remotePlayer || remotePlayer.characterId !== playerData.characterId) {
					console.log('[useRemotePlayers] creating player:', playerId, playerData)

					// Remove old if character changed
					if (remotePlayer) {
						gameContainer.removeChild(remotePlayer.container)
						remotePlayer.container.destroy({ children: true })
					}

					// Create new
					const newPlayer = await createRemotePlayer(playerData.characterId, playerData.username)
					if (newPlayer) {
						gameContainer.addChild(newPlayer.container)
						currentRemote.set(playerId, newPlayer)
						remotePlayer = newPlayer
						console.log('[useRemotePlayers] player created successfully:', playerId)
					}
				}

				// Update position from synced state
				if (remotePlayer) {
					remotePlayer.container.x = playerData.x
					remotePlayer.container.y = playerData.y

					// Update name if changed
					if (remotePlayer.nameLabel.text !== playerData.username) {
						remotePlayer.nameLabel.text = playerData.username
					}
				}
			}
		}

		updateRemotePlayers()
	}, [gameContainer, players, currentClientId])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			for (const player of remotePlayers.current.values()) {
				player.container.destroy({ children: true })
			}
			remotePlayers.current.clear()
		}
	}, [])

	// Return the players setter so Activity can update player data
	return setPlayers
}

async function createRemotePlayer(characterId: CharacterId, username: string): Promise<RemotePlayerSprite | null> {
	try {
		console.log('[createRemotePlayer] creating:', characterId, username)
		const character = CHARACTERS[characterId]
		console.log('[createRemotePlayer] character config:', character)

		if (!character) {
			throw new Error(`Character not found: ${characterId}`)
		}

		const walkSheet = character.spritesheets.walk
		console.log('[createRemotePlayer] loading texture:', walkSheet.path)

		// Load texture
		const texture = await Assets.load(walkSheet.path)
		console.log('[createRemotePlayer] texture loaded successfully')
		texture.source.scaleMode = 'nearest'

		// Create frames from spritesheet
		const frameWidth = texture.width / walkSheet.columns
		const frameHeight = texture.height / walkSheet.rows
		const frames = []

		for (let i = 0; i < walkSheet.totalFrames; i++) {
			const col = i % walkSheet.columns
			const row = Math.floor(i / walkSheet.columns)
			const frameRect = new Rectangle(col * frameWidth, row * frameHeight, frameWidth, frameHeight)
			// Use PixiJS v8 Texture constructor with source and frame
			const frameTexture = new Texture({
				source: texture.source,
				frame: frameRect
			})
			frames.push(frameTexture)
		}

		console.log('[createRemotePlayer] created', frames.length, 'frames')

		// Create animated sprite with animation frames
		const sprite = new AnimatedSprite(frames)
		sprite.anchor.set(0.5, 1)
		sprite.scale.set(character.scale)
		sprite.animationSpeed = character.animationSpeed
		sprite.play() // Start animation

		// Create name label
		const nameLabel = new Text({
			text: username,
			style: {
				fontFamily: 'Silkscreen, monospace',
				fontSize: 12,
				fill: 0xffffff,
				stroke: { color: 0x000000, width: 3 },
				align: 'center'
			}
		})
		nameLabel.anchor.set(0.5, 1)
		nameLabel.y = -sprite.height - 5

		// Create container
		const container = new Container()
		container.addChild(sprite)
		container.addChild(nameLabel)

		console.log('[createRemotePlayer] success:', characterId, username)
		return {
			container,
			sprite,
			nameLabel,
			characterId
		}
	} catch (err) {
		console.error('[createRemotePlayer] Failed to create remote player:', characterId, username)
		console.error('[createRemotePlayer] Error details:', err)
		console.error('[createRemotePlayer] Error stack:', err instanceof Error ? err.stack : 'No stack')
		return null
	}
}
