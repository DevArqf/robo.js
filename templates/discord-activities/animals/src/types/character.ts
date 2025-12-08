export type CharacterId = 'weasel' | 'cat' | 'dog' | 'redpanda'

export type AnimationState = 'idle' | 'walk' | 'run' | 'jump'

export interface SpritesheetConfig {
	path: string
	columns: number
	rows: number
	totalFrames: number
}

export interface CharacterConfig {
	id: CharacterId
	name: string
	description: string
	// Spritesheets for different animation states
	spritesheets: Record<AnimationState, SpritesheetConfig>
	preview: string
	scale: number
	animationSpeed: number
	unlocked: boolean
	// Physics properties
	canFly: boolean
	mass: number
	jumpForce: number
}
