import { Container, Assets, AnimatedSprite, Text, Rectangle } from 'pixi.js'
import { useEffect, useRef } from 'react'
import { CHARACTERS } from '../config/characters'
import type { Players } from '../types/game'
import type { CharacterId } from '../types/character'

interface RemotePlayerSprite {
	container: Container
	sprite: AnimatedSprite
	nameLabel: Text
	characterId: CharacterId
}

/**
 * Hook to render remote players from sync state
 */
export function useRemotePlayers(gameContainer: Container | null, players: Players, currentUserId: string | undefined) {
	const remotePlayers = useRef<Map<string, RemotePlayerSprite>>(new Map())

	// Debug logging
	useEffect(() => {
		console.log('[useRemotePlayers] players:', players)
		console.log('[useRemotePlayers] currentUserId:', currentUserId)
		console.log('[useRemotePlayers] gameContainer:', !!gameContainer)

		const otherPlayers = Object.keys(players).filter((id) => id !== currentUserId)
		console.log('[useRemotePlayers] other players:', otherPlayers)
	}, [players, currentUserId, gameContainer])

	useEffect(() => {
		if (!gameContainer || !currentUserId) {
			console.log('[useRemotePlayers] skipping - no gameContainer or currentUserId')
			return
		}

		const updateRemotePlayers = async () => {
			const currentRemote = remotePlayers.current
			const activeUserIds = new Set(Object.keys(players).filter((id) => id !== currentUserId))

			console.log('[useRemotePlayers] activeUserIds:', Array.from(activeUserIds))

			// Remove players who left
			for (const [userId, player] of currentRemote.entries()) {
				if (!activeUserIds.has(userId)) {
					console.log('[useRemotePlayers] removing player:', userId)
					gameContainer.removeChild(player.container)
					player.container.destroy({ children: true })
					currentRemote.delete(userId)
				}
			}

			// Add or update players
			for (const userId of activeUserIds) {
				const playerData = players[userId]
				if (!playerData) continue

				let remotePlayer = currentRemote.get(userId)

				// Create new player sprite if needed
				if (!remotePlayer || remotePlayer.characterId !== playerData.characterId) {
					console.log('[useRemotePlayers] creating player:', userId, playerData)

					// Remove old if character changed
					if (remotePlayer) {
						gameContainer.removeChild(remotePlayer.container)
						remotePlayer.container.destroy({ children: true })
					}

					// Create new
					const newPlayer = await createRemotePlayer(playerData.characterId, playerData.username)
					if (newPlayer) {
						gameContainer.addChild(newPlayer.container)
						currentRemote.set(userId, newPlayer)
						remotePlayer = newPlayer
						console.log('[useRemotePlayers] player created successfully:', userId)
					}
				}

				// Update position
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
	}, [gameContainer, players, currentUserId])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			for (const player of remotePlayers.current.values()) {
				player.container.destroy({ children: true })
			}
			remotePlayers.current.clear()
		}
	}, [])
}

async function createRemotePlayer(characterId: CharacterId, username: string): Promise<RemotePlayerSprite | null> {
	try {
		console.log('[createRemotePlayer] creating:', characterId, username)
		const character = CHARACTERS[characterId]
		const walkSheet = character.spritesheets.walk

		// Load texture
		const texture = await Assets.load(walkSheet.path)
		texture.source.scaleMode = 'nearest'

		// Create frames from spritesheet
		const frameWidth = texture.width / walkSheet.columns
		const frameHeight = texture.height / walkSheet.rows
		const frames = []

		for (let i = 0; i < walkSheet.totalFrames; i++) {
			const col = i % walkSheet.columns
			const row = Math.floor(i / walkSheet.columns)
			const frame = new Rectangle(col * frameWidth, row * frameHeight, frameWidth, frameHeight)
			frames.push((texture.clone().frame = frame ? texture : texture))
		}

		// Create animated sprite with first frame
		const sprite = new AnimatedSprite([texture])
		sprite.anchor.set(0.5, 1)
		sprite.scale.set(character.scale)
		sprite.animationSpeed = character.animationSpeed

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
		console.error('[createRemotePlayer] Failed to create remote player:', err)
		return null
	}
}
