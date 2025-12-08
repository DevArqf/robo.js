import type { CharacterConfig, CharacterId, SpritesheetConfig } from '../types/character'

// Default spritesheet config (320x1216, 5 columns, 19 rows, 64x64 frames)
const DEFAULT_SPRITESHEET: SpritesheetConfig = {
	path: '',
	columns: 5,
	rows: 19,
	totalFrames: 95
}

// Helper to create spritesheet configs for a character
function createSpritesheets(basePath: string): CharacterConfig['spritesheets'] {
	return {
		idle: { ...DEFAULT_SPRITESHEET, path: `${basePath}/idle.png` },
		walk: { ...DEFAULT_SPRITESHEET, path: `${basePath}/walking.png` },
		run: { ...DEFAULT_SPRITESHEET, path: `${basePath}/running.png` },
		jump: { ...DEFAULT_SPRITESHEET, path: `${basePath}/jumping.png` }
	}
}

export const CHARACTERS: Record<CharacterId, CharacterConfig> = {
	weasel: {
		id: 'weasel',
		name: 'Weasel',
		description: 'Quick and cunning',
		spritesheets: createSpritesheets('/characters/weasel'),
		preview: '/characters/weasel/walking.png',
		scale: 2,
		animationSpeed: 0.5,
		unlocked: true,
		canFly: false,
		mass: 1,
		jumpForce: 0.015
	},
	cat: {
		id: 'cat',
		name: 'Cat',
		description: 'Graceful and mysterious',
		spritesheets: createSpritesheets('/characters/cat'),
		preview: '/characters/cat/walking.png', // Placeholder
		scale: 2,
		animationSpeed: 0.5,
		unlocked: true,
		canFly: false,
		mass: 1,
		jumpForce: 0.25
	},
	dog: {
		id: 'dog',
		name: 'Dog',
		description: 'Loyal and brave',
		spritesheets: createSpritesheets('/characters/dog'),
		preview: '/characters/dog/walking.png',
		scale: 2,
		animationSpeed: 0.5,
		unlocked: true,
		canFly: false,
		mass: 1.2,
		jumpForce: 0.012
	},
	redpanda: {
		id: 'redpanda',
		name: 'Red Panda',
		description: 'Cute and fluffy',
		spritesheets: createSpritesheets('/characters/red_panda'),
		preview: '/characters/red_panda/walking.png',
		scale: 2,
		animationSpeed: 0.5,
		unlocked: true,
		canFly: false,
		mass: 0.8,
		jumpForce: 0.02
	}
}

export const CHARACTER_LIST = Object.values(CHARACTERS)
export const DEFAULT_CHARACTER: CharacterId = 'weasel'
