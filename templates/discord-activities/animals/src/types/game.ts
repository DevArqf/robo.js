import type { AnimatedSprite } from 'pixi.js'
import type { CharacterId } from './character'

export interface PlayerData {
	x: number
	y: number
	characterId: CharacterId
	username: string
}

export interface Players {
	[userId: string]: PlayerData
}

export interface Sprites {
	[userId: string]: AnimatedSprite
}
