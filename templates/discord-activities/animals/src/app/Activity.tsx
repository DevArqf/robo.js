import { useRef, useCallback, useState, useEffect } from 'react'

import { useDiscordSdk } from '../hooks/useDiscordSdk'
import { usePixi } from '../hooks/usePixi'
import { useInput } from '../hooks/useInput'
import { usePhysics } from '../hooks/usePhysics'
import { useScene } from '../hooks/useScene'
import { usePlayer } from '../hooks/usePlayer'
import { useGameLoop } from '../hooks/useGameLoop'
import { usePlayerSync } from '../hooks/usePlayerSync'
import { useRemotePlayers } from '../hooks/useRemotePlayers'

import { MainMenu } from '../components/MainMenu'
import { CharacterSelect } from '../components/CharacterSelect'
import type { CharacterId } from '../types/character'

type GameScreen = 'menu' | 'character-select' | 'game'

export function Activity() {
	const containerRef = useRef<HTMLDivElement>(null)

	// Screen state
	const [screen, setScreen] = useState<GameScreen>('menu')
	const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>('weasel')

	// Discord SDK - always initialized
	const { session } = useDiscordSdk()
	const userId = session?.user?.id
	const username = session?.user?.username || 'Player'

	// Player sync - uses channelId directly from discordSdk
	const { players, initializePlayer, updatePosition, removePlayer } = usePlayerSync(userId)

	// Only initialize game systems when in game
	const isInGame = screen === 'game'

	// Pixi application
	const { app, isReady: pixiReady, width, height } = usePixi(containerRef, isInGame)

	// Input
	const { input, isReady: inputReady } = useInput()

	// Physics (floor at bottom of screen)
	const { world: physicsWorld, floorY, isReady: physicsReady } = usePhysics(width, height)

	// Scene (background, floor, game container)
	const { gameContainer, isLoaded: sceneLoaded } = useScene(app, width, height)

	// Local player
	const { player, isReady: playerReady } = usePlayer(
		gameContainer,
		physicsWorld,
		selectedCharacter,
		username,
		width,
		height
	)

	// Remote players - render other players from sync state
	useRemotePlayers(gameContainer, players, userId)

	// Initialize player in sync state when entering game
	useEffect(() => {
		if (isInGame && playerReady && player && userId) {
			const pos = player.getPosition()
			initializePlayer(pos.x, pos.y, selectedCharacter, username)
		}
	}, [isInGame, playerReady, player, userId, selectedCharacter, username, initializePlayer])

	// Remove player when leaving game
	useEffect(() => {
		return () => {
			if (userId) {
				removePlayer()
			}
		}
	}, [userId, removePlayer])

	// Navigation handlers
	const handlePlay = useCallback(() => {
		setScreen('character-select')
	}, [])

	const handleCharacterSelect = useCallback((characterId: CharacterId) => {
		setSelectedCharacter(characterId)
		setScreen('game')
	}, [])

	// Game loop
	const gameLoopEnabled = isInGame && pixiReady && inputReady && physicsReady && sceneLoaded && playerReady && !!player

	const handleGameLoop = useCallback(() => {
		if (!player) return

		// Update player with input
		player.update(input, width, floorY)

		// Sync position for multiplayer
		const pos = player.getPosition()
		updatePosition(pos.x, pos.y)
	}, [player, input, width, floorY, updatePosition])

	useGameLoop(app, handleGameLoop, gameLoopEnabled)

	// Render based on current screen
	if (screen === 'menu') {
		return <MainMenu onPlay={handlePlay} />
	}

	if (screen === 'character-select') {
		return <CharacterSelect onStart={handleCharacterSelect} />
	}

	return (
		<div
			ref={containerRef}
			style={{
				width: '100vw',
				height: '100vh',
				overflow: 'hidden'
			}}
		/>
	)
}
