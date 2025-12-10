import type { FoodConfig, FoodType } from '../types/food'
import type { CharacterId } from '../types/character'

export const FOOD_CONFIG: Record<FoodType, FoodConfig> = {
	bamboo: {
		id: 'bamboo',
		name: 'Bamboo',
		asset: '/food/bamboo.png',
		targetAnimal: 'redpanda',
		basePoints: 1
	},
	dog_bone: {
		id: 'dog_bone',
		name: 'Dog Bone',
		asset: '/food/dog_bone.png',
		targetAnimal: 'dog',
		basePoints: 1
	},
	fish: {
		id: 'fish',
		name: 'Fish',
		asset: '/food/fish.png',
		targetAnimal: 'cat',
		basePoints: 1
	},
	mouse: {
		id: 'mouse',
		name: 'Mouse',
		asset: '/food/mouse.png',
		targetAnimal: 'weasel',
		basePoints: 1
	}
}

// Map from character to their food
export const CHARACTER_TO_FOOD: Record<CharacterId, FoodType> = {
	redpanda: 'bamboo',
	dog: 'dog_bone',
	cat: 'fish',
	weasel: 'mouse'
}

// Map from food to character
export const FOOD_TO_CHARACTER: Record<FoodType, CharacterId> = {
	bamboo: 'redpanda',
	dog_bone: 'dog',
	fish: 'cat',
	mouse: 'weasel'
}

export const FOOD_TYPES: FoodType[] = ['bamboo', 'dog_bone', 'fish', 'mouse']

// Game config for food spawning
export const FOOD_SPAWN_CONFIG = {
	spawnIntervalMs: 5000, // Spawn new food every 5 seconds
	maxFoodItems: 20, // Maximum food items on map at once
	specialFoodChance: 0.15, // 15% chance for special (5 point) food
	specialFoodPoints: 5,
	normalFoodPoints: 1,
	slowDurationMs: 3000 // Slow effect duration when eating wrong food
}
