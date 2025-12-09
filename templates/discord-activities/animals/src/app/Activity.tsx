import { useRef, useCallback, useState, useEffect } from 'react'

import { useDiscordSdk } from '../hooks/useDiscordSdk'
import { usePixi } from '../hooks/usePixi'
import { useInput } from '../hooks/useInput'
import { usePhysics } from '../hooks/usePhysics'
import { useScene } from '../hooks/useScene'
import { usePlayer } from '../hooks/usePlayer'
import { useGameLoop } from '../hooks/useGameLoop'
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
	const { discordSdk, session, status } = useDiscordSdk()
	const userId = session?.user?.id
	const username = session?.user?.username || 'Player'

	// For local testing, generate a stable client ID
	const localClientId = useRef(`local-${Math.random().toString(36).substring(7)}`)
	const clientId = userId || localClientId.current

	// Debug: log Discord SDK state
	useEffect(() => {
		console.log('[Activity] Discord SDK status:', status)
		console.log('[Activity] channelId:', discordSdk?.channelId)
		console.log('[Activity] clientId:', clientId)
		console.log('[Activity] username:', username)
	}, [status, discordSdk?.channelId, clientId, username])

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
	const setPlayers = useRemotePlayers(gameContainer, clientId)

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

	// Debug: log game loop state
	useEffect(() => {
		console.log('[Activity] Game loop conditions:', {
			isInGame,
			pixiReady,
			inputReady,
			physicsReady,
			sceneLoaded,
			playerReady,
			hasPlayer: !!player,
			gameLoopEnabled
		})
	}, [isInGame, pixiReady, inputReady, physicsReady, sceneLoaded, playerReady, player, gameLoopEnabled])

	const handleGameLoop = useCallback(() => {
		if (!player || !clientId) {
			console.log('[Activity] Game loop skipped - missing player or clientId:', { hasPlayer: !!player, clientId })
			return
		}

		// Update player with input
		player.update(input, width, floorY)

		// Sync position and player data for multiplayer
		const pos = player.getPosition()
		console.log('[Activity] Updating player position:', clientId, pos)
		console.log('[Activity] About to call setPlayers, type:', typeof setPlayers)

		setPlayers((prev) => {
			console.log('[Activity] Inside setPlayers callback, prev:', prev)
			const newState = {
				...prev,
				[clientId]: {
					x: pos.x,
					y: pos.y,
					characterId: selectedCharacter,
					username
				}
			}
			console.log('[Activity] New players state:', newState)
			console.log('[Activity] Returning new state to sync')
			return newState
		})
	}, [player, input, width, floorY, clientId, selectedCharacter, username, setPlayers])

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
