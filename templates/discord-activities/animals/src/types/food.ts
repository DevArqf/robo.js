import type { CharacterId } from './character'

export type FoodType = 'bamboo' | 'dog_bone' | 'fish' | 'mouse'

export interface FoodConfig {
	id: FoodType
	name: string
	asset: string
	targetAnimal: CharacterId
	basePoints: number
}

export interface FoodItem {
	id: string
	type: FoodType
	x: number
	y: number
	isSpecial: boolean // Special food gives 5 points
	collected: boolean
	collectedBy?: string // odId of player who collected it
	// Cloud attachment - if set, food follows this cloud
	cloudIndex?: number // Index of the cloud this food is attached to
	cloudOffsetX?: number // Offset from cloud center
}

export interface FoodState {
	items: Record<string, FoodItem>
	lastSpawnTime: number
}
