import type { CharacterConfig, CharacterId, SpritesheetConfig } from '../types/character'

// Spritesheet config for 320x1216 sprites (5 columns, 19 rows, 64x64 frames)
const SPRITESHEET_19_ROWS: SpritesheetConfig = {
	path: '',
	columns: 5,
	rows: 19,
	totalFrames: 95
}

// Spritesheet config for 320x1280 sprites (5 columns, 20 rows, 64x64 frames)
const SPRITESHEET_20_ROWS: SpritesheetConfig = {
	path: '',
	columns: 5,
	rows: 20,
	totalFrames: 100
}

// Helper to create spritesheet configs for a character
function createSpritesheets(basePath: string, rows: 19 | 20 = 19): CharacterConfig['spritesheets'] {
	const baseConfig = rows === 20 ? SPRITESHEET_20_ROWS : SPRITESHEET_19_ROWS
	return {
		idle: { ...baseConfig, path: `${basePath}/idle.png` },
		walk: { ...baseConfig, path: `${basePath}/walking.png` },
		run: { ...baseConfig, path: `${basePath}/running.png` },
		jump: { ...baseConfig, path: `${basePath}/jumping.png` }
	}
}

export const CHARACTERS: Record<CharacterId, CharacterConfig> = {
	weasel: {
		id: 'weasel',
		name: 'Weasel',
		description: 'Quick and cunning',
		spritesheets: createSpritesheets('/characters/weasel', 20),
		preview: '/characters/weasel/walking.png',
		scale: 1.8,
		animationSpeed: 0.5,
		unlocked: true,
		canFly: false,
		mass: 1,
		jumpForce: 0.035
	},
	cat: {
		id: 'cat',
		name: 'Cat',
		description: 'Graceful and mysterious',
		spritesheets: createSpritesheets('/characters/cat', 20),
		preview: '/characters/cat/walking.png',
		scale: 2,
		animationSpeed: 0.5,
		unlocked: true,
		canFly: false,
		mass: 1,
		jumpForce: 0.04
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
		jumpForce: 0.035
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
		jumpForce: 0.04
	}
}

export const CHARACTER_LIST = Object.values(CHARACTERS)
export const DEFAULT_CHARACTER: CharacterId = 'weasel'
