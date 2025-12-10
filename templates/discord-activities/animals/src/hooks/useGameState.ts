import { useCallback, useRef, useState } from 'react'
import { useSyncState } from '@robojs/sync'
import { useDiscordSdk } from './useDiscordSdk'
import type { CharacterId } from '../types/character'
import type { TeamId, GameState } from '../types/team'
import type { FoodItem, FoodState, FoodType } from '../types/food'
import { createInitialTeams } from '../config/teams'
import { FOOD_SPAWN_CONFIG, FOOD_TYPES, FOOD_TO_CHARACTER } from '../config/food'

interface FullGameState {
	game: GameState
	food: FoodState
}

export interface CloudPosition {
	x: number
	y: number
	index: number
}

export interface UseGameStateResult {
	teams: GameState['teams']
	foodItems: FoodItem[]
	isSlowed: boolean
	joinTeam: (characterId: CharacterId, username: string) => void
	leaveTeam: () => void
	collectFood: (
		foodId: string,
		characterId: CharacterId
	) => { points: number; isCorrectFood: boolean; x: number; y: number } | null
	spawnFood: (screenWidth: number, screenHeight: number, cloudPositions: CloudPosition[]) => void
	getTeamScore: (teamId: TeamId) => number
}

const createInitialState = (): FullGameState => ({
	game: {
		teams: createInitialTeams(),
		slowEffects: {}
	},
	food: {
		items: {},
		lastSpawnTime: 0
	}
})

// Seeded random number generator for deterministic spawning
function seededRandom(seed: number): () => number {
	return () => {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff
		return seed / 0x7fffffff
	}
}

// Max food items per type
const MAX_FOOD_PER_TYPE = 4

export function useGameState(currentUserId: string | undefined): UseGameStateResult {
	const { discordSdk } = useDiscordSdk()
	const syncKey: [string, string | null] = ['gameState', discordSdk.channelId]

	const [state, setState] = useSyncState<FullGameState>(createInitialState(), syncKey)

	// Track local slow effect (not synced - each client tracks their own)
	const [localSlowEndTime, setLocalSlowEndTime] = useState<number>(0)

	const joinTeam = useCallback(
		(characterId: CharacterId, username: string) => {
			if (!currentUserId) return

			setState((prev) => {
				const teamId = characterId as TeamId
				const updatedTeams = { ...prev.game.teams }

				// Remove player from any existing team first
				for (const tid of Object.keys(updatedTeams) as TeamId[]) {
					updatedTeams[tid] = {
						...updatedTeams[tid],
						members: updatedTeams[tid].members.filter((id) => id !== currentUserId)
					}
				}

				// Add player to their character's team
				updatedTeams[teamId] = {
					...updatedTeams[teamId],
					members: [...updatedTeams[teamId].members, currentUserId]
				}

				console.log('[GameState] Player joined team:', { odId: currentUserId, teamId, username })

				return {
					...prev,
					game: {
						...prev.game,
						teams: updatedTeams
					}
				}
			})
		},
		[currentUserId, setState]
	)

	const leaveTeam = useCallback(() => {
		if (!currentUserId) return

		setState((prev) => {
			const updatedTeams = { ...prev.game.teams }

			// Remove player from all teams
			for (const tid of Object.keys(updatedTeams) as TeamId[]) {
				updatedTeams[tid] = {
					...updatedTeams[tid],
					members: updatedTeams[tid].members.filter((id) => id !== currentUserId)
				}
			}

			// Remove any slow effects
			const updatedSlowEffects = { ...prev.game.slowEffects }
			delete updatedSlowEffects[currentUserId]

			return {
				...prev,
				game: {
					...prev.game,
					teams: updatedTeams,
					slowEffects: updatedSlowEffects
				}
			}
		})
	}, [currentUserId, setState])

	// Track recently collected food to prevent double-collection
	const recentlyCollectedRef = useRef<Set<string>>(new Set())

	// Store food items ref for synchronous access without causing callback recreation
	const foodItemsRef = useRef(state.food.items)
	foodItemsRef.current = state.food.items

	const collectFood = useCallback(
		(
			foodId: string,
			characterId: CharacterId
		): { points: number; isCorrectFood: boolean; x: number; y: number } | null => {
			if (!currentUserId) return null

			// Prevent double-collection
			if (recentlyCollectedRef.current.has(foodId)) {
				return null
			}

			// Check food exists in current state BEFORE calling setState (use ref for synchronous access)
			const currentFood = foodItemsRef.current[foodId]
			if (!currentFood || currentFood.collected) {
				return null
			}

			// Mark as recently collected immediately
			recentlyCollectedRef.current.add(foodId)
			setTimeout(() => recentlyCollectedRef.current.delete(foodId), 1000)

			const targetAnimal = FOOD_TO_CHARACTER[currentFood.type]
			const isCorrectFood = targetAnimal === characterId
			const playerTeam = characterId as TeamId

			// Calculate points before setState
			let points = 0
			if (isCorrectFood) {
				points = currentFood.isSpecial ? FOOD_SPAWN_CONFIG.specialFoodPoints : FOOD_SPAWN_CONFIG.normalFoodPoints
			} else {
				points = -1
			}

			// Apply slow effect if wrong food
			if (!isCorrectFood) {
				setLocalSlowEndTime(Date.now() + FOOD_SPAWN_CONFIG.slowDurationMs)
			}

			// Update state
			setState((prev) => {
				// Double-check food is still available
				const food = prev.food.items[foodId]
				if (!food || food.collected) {
					return prev
				}

				const updatedFood = {
					...prev.food.items,
					[foodId]: { ...food, collected: true, collectedBy: currentUserId }
				}

				const updatedTeams = { ...prev.game.teams }

				if (isCorrectFood) {
					// Correct food: add points to player's team
					updatedTeams[playerTeam] = {
						...updatedTeams[playerTeam],
						score: updatedTeams[playerTeam].score + points
					}
				} else {
					// Wrong food: subtract point from the food's target team
					const targetTeam = targetAnimal as TeamId
					updatedTeams[targetTeam] = {
						...updatedTeams[targetTeam],
						score: Math.max(0, updatedTeams[targetTeam].score - 1)
					}
				}

				console.log('[GameState] Food collected:', {
					odId: currentUserId,
					foodId,
					isCorrectFood,
					points,
					newScores: updatedTeams
				})

				return {
					...prev,
					game: {
						...prev.game,
						teams: updatedTeams
					},
					food: {
						...prev.food,
						items: updatedFood
					}
				}
			})

			// Return result synchronously since we calculated it before setState
			return { points, isCorrectFood, x: currentFood.x, y: currentFood.y }
		},
		[currentUserId, setState]
	)

	const spawnFood = useCallback(
		(screenWidth: number, screenHeight: number, cloudPositions: CloudPosition[]) => {
			setState((prev) => {
				// Only spawn if enough time has passed (check inside setState for accuracy)
				// Use a rounded timestamp for deterministic spawning across clients
				const now = Date.now()
				const spawnWindow = Math.floor(now / FOOD_SPAWN_CONFIG.spawnIntervalMs)
				const lastSpawnWindow = Math.floor(prev.food.lastSpawnTime / FOOD_SPAWN_CONFIG.spawnIntervalMs)

				if (spawnWindow <= lastSpawnWindow) {
					return prev
				}

				// Keep uncollected items, remove collected ones (cleanup)
				const newItems: Record<string, FoodItem> = {}
				for (const [id, item] of Object.entries(prev.food.items)) {
					if (!item.collected) {
						newItems[id] = item
					}
				}

				// Count existing uncollected food per type
				const countByType: Record<FoodType, number> = {
					bamboo: 0,
					dog_bone: 0,
					fish: 0,
					mouse: 0
				}
				for (const item of Object.values(newItems)) {
					countByType[item.type]++
				}

				// Get all existing food positions for overlap checking
				const existingPositions = Object.values(newItems).map((item) => ({
					x: item.x,
					y: item.y,
					cloudIndex: item.cloudIndex,
					cloudOffsetX: item.cloudOffsetX
				}))

				// Minimum distance between food items
				const MIN_DISTANCE = 80

				// Helper to check if position overlaps with existing food
				const isPositionClear = (x: number, y: number, cloudIdx?: number, cloudOff?: number): boolean => {
					for (const pos of existingPositions) {
						// For cloud items, compare cloud index and offset
						if (cloudIdx !== undefined && pos.cloudIndex === cloudIdx) {
							const offsetDiff = Math.abs((cloudOff || 0) - (pos.cloudOffsetX || 0))
							if (offsetDiff < MIN_DISTANCE) return false
						}
						// For ground items or cross-checking
						const dx = x - pos.x
						const dy = y - pos.y
						const distance = Math.sqrt(dx * dx + dy * dy)
						if (distance < MIN_DISTANCE) return false
					}
					return true
				}

				// Use spawn window as seed for deterministic random
				const random = seededRandom(spawnWindow)

				// Spawn one food item for each type that needs it
				let spawnedCount = 0
				for (const foodType of FOOD_TYPES) {
					// Strict check: only spawn if under limit
					if (countByType[foodType] >= MAX_FOOD_PER_TYPE) continue

					// Deterministic ID based on spawn window, type, and current count
					const id = `food_${spawnWindow}_${foodType}_${countByType[foodType]}`

					// Check if this exact ID already exists (prevent duplicates)
					if (newItems[id]) continue

					const isSpecial = random() < FOOD_SPAWN_CONFIG.specialFoodChance

					// Try to find a valid spawn position (up to 10 attempts)
					let x: number = 0
					let y: number = 0
					let cloudIndex: number | undefined
					let cloudOffsetX: number | undefined
					let foundValidPosition = false

					for (let attempt = 0; attempt < 10; attempt++) {
						if (cloudPositions.length > 0 && random() < 0.5) {
							// Try spawn on a random cloud
							const cloudIdx = Math.floor(random() * cloudPositions.length)
							const cloud = cloudPositions[cloudIdx]
							const tryOffsetX = (random() - 0.5) * 60
							const tryX = cloud.x + tryOffsetX
							const tryY = cloud.y - 20

							if (isPositionClear(tryX, tryY, cloudIdx, tryOffsetX)) {
								x = tryX
								y = tryY
								cloudIndex = cloudIdx
								cloudOffsetX = tryOffsetX
								foundValidPosition = true
								break
							}
						} else {
							// Try spawn on ground level
							const tryX = 100 + random() * (screenWidth - 200)
							const tryY = screenHeight - 80

							if (isPositionClear(tryX, tryY)) {
								x = tryX
								y = tryY
								foundValidPosition = true
								break
							}
						}
					}

					// Skip if no valid position found
					if (!foundValidPosition) continue

					newItems[id] = {
						id,
						type: foodType,
						x,
						y,
						isSpecial,
						collected: false,
						cloudIndex,
						cloudOffsetX
					}

					// Update count and positions for next iteration
					countByType[foodType]++
					existingPositions.push({ x, y, cloudIndex, cloudOffsetX })
					spawnedCount++
				}

				if (spawnedCount > 0) {
					console.log('[GameState] Spawned', spawnedCount, 'food items. Counts:', countByType)
				}

				return {
					...prev,
					food: {
						items: newItems,
						lastSpawnTime: now
					}
				}
			})
		},
		[setState]
	)

	const getTeamScore = useCallback(
		(teamId: TeamId) => {
			return state.game.teams[teamId]?.score ?? 0
		},
		[state.game.teams]
	)

	// Check if current user is slowed (using local state for responsiveness)
	const isSlowed = localSlowEndTime > Date.now()

	// Convert food items object to array
	const foodItems = Object.values(state.food.items).filter((f) => !f.collected)

	return {
		teams: state.game.teams,
		foodItems,
		isSlowed,
		joinTeam,
		leaveTeam,
		collectFood,
		spawnFood,
		getTeamScore
	}
}
