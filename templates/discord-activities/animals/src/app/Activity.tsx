import { useRef, useCallback, useState, useEffect } from 'react'

import { useDiscordSdk } from '../hooks/useDiscordSdk'
import { usePixi } from '../hooks/usePixi'
import { useInput } from '../hooks/useInput'
import { usePhysics } from '../hooks/usePhysics'
import { useScene } from '../hooks/useScene'
import { usePlayer } from '../hooks/usePlayer'
import { useGameLoop } from '../hooks/useGameLoop'
import { usePlayerSync } from '../hooks/usePlayerSync'
import { useRemotePlayers, RemotePlayerRenderer } from '../hooks/useRemotePlayers'
import { useCloudPlatforms } from '../hooks/useCloudPlatforms'
import { useGameState } from '../hooks/useGameState'
import { useFood } from '../hooks/useFood'
import { GameMenu, MenuButton } from '../components/GameMenu'
import { Scoreboard } from '../components/Scoreboard'
import { SlowIndicator } from '../components/SlowIndicator'

import { MainMenu } from '../components/MainMenu'
import { CharacterSelect } from '../components/CharacterSelect'
import type { CharacterId } from '../types/character'
import { FOOD_SPAWN_CONFIG } from '../config/food'

type GameScreen = 'menu' | 'character-select' | 'game'

export function Activity() {
	const containerRef = useRef<HTMLDivElement>(null)

	// Screen state
	const [screen, setScreen] = useState<GameScreen>('menu')
	const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>('weasel')
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [showScoreboard, setShowScoreboard] = useState(true)

	// Discord SDK
	const { discordSdk, session, status } = useDiscordSdk()
	const userId = session?.user?.id
	const username = session?.user?.username || 'Player'

	// Debug logging
	useEffect(() => {
		console.log('[Activity] Discord SDK status:', status)
		console.log('[Activity] channelId:', discordSdk?.channelId)
		console.log('[Activity] userId:', userId)
	}, [status, discordSdk?.channelId, userId])

	// Player sync - uses per-player sync keys
	const syncResult = usePlayerSync(userId)
	const { initializePlayer, updatePosition, removePlayer } = syncResult
	const playerIds = (syncResult as { playerIds?: string[] }).playerIds || []

	// Debug: log players
	useEffect(() => {
		console.log('[Activity] playerIds:', playerIds)
	}, [playerIds])

	// Only initialize game systems when in game
	const isInGame = screen === 'game'

	// Pixi application
	const { app, isReady: pixiReady, width, height } = usePixi(containerRef, isInGame)

	// Input
	const { input, isReady: inputReady } = useInput()

	// Physics
	const { engine: physicsEngine, world: physicsWorld, floorY, isReady: physicsReady } = usePhysics(width, height)

	// Scene
	const { gameContainer, isLoaded: sceneLoaded } = useScene(app, width, height)

	// Cloud platforms (spawn clouds at various heights for jumping)
	const {
		isReady: cloudsReady,
		updateClouds,
		getCloudPositions
	} = useCloudPlatforms(
		gameContainer,
		physicsWorld,
		width,
		height,
		10 // Number of clouds - enough to jump between
	)

	// Game state (teams, food, scores)
	const { teams, foodItems, isSlowed, joinTeam, leaveTeam, collectFood, spawnFood } = useGameState(userId)

	// Food rendering
	const {
		isReady: foodReady,
		updateFood,
		checkCollision: checkFoodCollision,
		showPointIndicator,
		removeFood
	} = useFood(gameContainer)

	// Track time for animations
	const gameTimeRef = useRef(0)

	// Store foodItems in a ref to avoid recreating the game loop callback
	const foodItemsRef = useRef(foodItems)
	foodItemsRef.current = foodItems

	// Store isSlowed in a ref
	const isSlowedRef = useRef(isSlowed)
	isSlowedRef.current = isSlowed

	// Track locally collected food IDs to prevent reappearing before sync
	const locallyCollectedRef = useRef<Set<string>>(new Set())

	// Local player
	const { player, isReady: playerReady } = usePlayer(
		gameContainer,
		physicsWorld,
		physicsEngine,
		selectedCharacter,
		username,
		width,
		height
	)

	// Remote players
	const {
		remotePlayers,
		channelId,
		remotePlayerIds,
		gameContainer: remoteGameContainer
	} = useRemotePlayers(gameContainer, playerIds, userId)

	// Initialize player in sync when entering game
	const hasInitialized = useRef(false)
	useEffect(() => {
		if (!isInGame) {
			hasInitialized.current = false
			return
		}

		if (isInGame && playerReady && player && userId && !hasInitialized.current) {
			const pos = player.getPosition()
			console.log('[Activity] Initializing player:', userId, pos)
			hasInitialized.current = true
			initializePlayer(pos.x, pos.y, selectedCharacter, username)
			// Join the team for the selected character
			joinTeam(selectedCharacter, username)
		}
	}, [isInGame, playerReady, player, userId, selectedCharacter, username, initializePlayer, joinTeam])

	// Remove player when leaving game
	useEffect(() => {
		return () => {
			if (userId) {
				removePlayer()
				leaveTeam()
			}
		}
	}, [userId, removePlayer, leaveTeam])

	// Handle Escape key for menu and Tab key for scoreboard
	useEffect(() => {
		if (!isInGame) return

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setIsMenuOpen((prev) => !prev)
			}
			if (e.key === 'Tab') {
				e.preventDefault() // Prevent default tab behavior
				setShowScoreboard((prev) => !prev)
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [isInGame])

	// Navigation handlers
	const handlePlay = useCallback(() => {
		setScreen('character-select')
	}, [])

	const handleCharacterSelect = useCallback((characterId: CharacterId) => {
		setSelectedCharacter(characterId)
		setScreen('game')
	}, [])

	// Menu handlers
	const handleMenuClose = useCallback(() => {
		setIsMenuOpen(false)
	}, [])

	const handleMenuCharacter = useCallback(() => {
		setIsMenuOpen(false)
		removePlayer()
		setScreen('character-select')
	}, [removePlayer])

	const handleMenuMainMenu = useCallback(() => {
		setIsMenuOpen(false)
		removePlayer()
		setScreen('menu')
	}, [removePlayer])

	const handleMenuInfo = useCallback(() => {
		// TODO: Hook up info functionality later
		console.log('Info clicked')
	}, [])

	// Game loop
	const gameLoopEnabled =
		isInGame &&
		pixiReady &&
		inputReady &&
		physicsReady &&
		sceneLoaded &&
		cloudsReady &&
		foodReady &&
		playerReady &&
		!!player &&
		!isMenuOpen

	const handleGameLoop = useCallback(() => {
		if (!player) return

		gameTimeRef.current += 16 // Approximate frame time

		// Update cloud animations
		updateClouds(1)

		// Update player with slow effect (use ref to avoid dependency)
		player.update(input, width, floorY, isSlowedRef.current)

		const pos = player.getPosition()
		updatePosition(pos.x, pos.y)

		// Get cloud positions for food positioning
		const cloudPositions = getCloudPositions()

		// Filter out locally collected food to prevent reappearing
		const visibleFood = foodItemsRef.current.filter((f) => !locallyCollectedRef.current.has(f.id))

		// Update food rendering and animations
		updateFood(visibleFood, gameTimeRef.current, cloudPositions)

		// Check for food collision
		const collidedFood = checkFoodCollision(pos.x, pos.y, cloudPositions)
		if (collidedFood && !locallyCollectedRef.current.has(collidedFood.id)) {
			// Mark as locally collected immediately
			locallyCollectedRef.current.add(collidedFood.id)

			// Immediately remove from rendering
			removeFood(collidedFood.id)

			const result = collectFood(collidedFood.id, selectedCharacter)
			if (result) {
				// Show floating point indicator
				showPointIndicator(result.x, result.y, result.points, result.isCorrectFood)
			}

			// Clean up old collected IDs after a delay (sync should have caught up by then)
			setTimeout(() => {
				locallyCollectedRef.current.delete(collidedFood.id)
			}, 5000)
		}

		// Spawn food periodically (useGameState handles throttling internally)
		spawnFood(width, height, cloudPositions)
	}, [
		player,
		input,
		width,
		height,
		floorY,
		updatePosition,
		updateClouds,
		updateFood,
		checkFoodCollision,
		collectFood,
		selectedCharacter,
		getCloudPositions,
		spawnFood,
		showPointIndicator,
		removeFood
	])

	useGameLoop(app, handleGameLoop, gameLoopEnabled)

	// Render based on current screen
	if (screen === 'menu') {
		return <MainMenu onPlay={handlePlay} />
	}

	if (screen === 'character-select') {
		return <CharacterSelect onStart={handleCharacterSelect} />
	}

	return (
		<>
			<MenuButton onClick={() => setIsMenuOpen(true)} />
			<GameMenu
				isOpen={isMenuOpen}
				onClose={handleMenuClose}
				onCharacterSelect={handleMenuCharacter}
				onMainMenu={handleMenuMainMenu}
				onInfo={handleMenuInfo}
			/>
			{showScoreboard && <Scoreboard teams={teams} currentTeam={selectedCharacter} />}
			<SlowIndicator isSlowed={isSlowed} duration={FOOD_SPAWN_CONFIG.slowDurationMs} />
			<div
				ref={containerRef}
				style={{
					width: '100vw',
					height: '100vh',
					overflow: 'hidden'
				}}
			/>
			{/* Render remote players */}
			{remoteGameContainer &&
				remotePlayerIds.map((oduserId) => (
					<RemotePlayerRenderer
						key={oduserId}
						oduserId={oduserId}
						channelId={channelId}
						gameContainer={remoteGameContainer}
						remotePlayers={remotePlayers}
					/>
				))}
		</>
	)
}
