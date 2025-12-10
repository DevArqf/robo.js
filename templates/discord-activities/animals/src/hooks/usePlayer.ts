import { Container } from 'pixi.js'
import Matter from 'matter-js'
import { useEffect, useRef, useState } from 'react'
import { Player } from '../systems/Player'
import { CHARACTERS } from '../config/characters'
import type { CharacterId } from '../types/character'

export interface UsePlayerResult {
	player: Player | null
	isReady: boolean
}

/**
 * Hook to manage local player creation and updates
 */
export function usePlayer(
	gameContainer: Container | null,
	physicsWorld: Matter.World | null,
	physicsEngine: Matter.Engine | null,
	characterId: CharacterId,
	username: string,
	screenWidth: number,
	screenHeight: number
): UsePlayerResult {
	const [isReady, setIsReady] = useState(false)
	const playerRef = useRef<Player | null>(null)

	// Create player when dependencies are ready
	useEffect(() => {
		if (!gameContainer || !physicsWorld || !physicsEngine || !screenWidth || !screenHeight) return

		let cancelled = false

		const createPlayer = async () => {
			const character = CHARACTERS[characterId]

			// Spawn at center, slightly above bottom
			const spawnX = screenWidth / 2
			const spawnY = screenHeight - 100

			const player = new Player(character, username, spawnX, spawnY, physicsWorld, physicsEngine)

			// Load animations
			try {
				await player.loadAnimations()
			} catch (err) {
				console.error('Failed to load player animations:', err)
			}

			if (cancelled) {
				player.destroy(physicsWorld)
				return
			}

			gameContainer.addChild(player.container)
			playerRef.current = player
			setIsReady(true)
		}

		createPlayer()

		return () => {
			cancelled = true
			if (playerRef.current && physicsWorld) {
				gameContainer.removeChild(playerRef.current.container)
				playerRef.current.destroy(physicsWorld)
				playerRef.current = null
			}
			setIsReady(false)
		}
	}, [gameContainer, physicsWorld, physicsEngine, characterId, username, screenWidth, screenHeight])

	return {
		player: playerRef.current,
		isReady
	}
}
