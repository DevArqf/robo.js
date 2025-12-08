import { AnimatedSprite, Assets, Texture, Rectangle } from 'pixi.js'
import type { AnimationState, CharacterConfig, SpritesheetConfig } from '../types/character'

/**
 * Manages animation states and spritesheet switching for a character
 */
export class AnimationController {
	private sprite: AnimatedSprite
	private character: CharacterConfig
	private textures: Map<AnimationState, Texture[]> = new Map()
	private currentState: AnimationState = 'idle'
	private facingRight: boolean = false

	constructor(sprite: AnimatedSprite, character: CharacterConfig) {
		this.sprite = sprite
		this.character = character
	}

	/**
	 * Load all spritesheets for the character
	 * Returns a promise that resolves when all textures are loaded
	 */
	async loadAllTextures(): Promise<void> {
		// Only load walk for now, use first frame as idle
		try {
			const walkTextures = await this.loadSpritesheet(this.character.spritesheets.walk)
			this.textures.set('walk', walkTextures)

			// Use first frame of walk as idle
			if (walkTextures.length > 0) {
				this.textures.set('idle', [walkTextures[0]])
			}

			// Try to load run and jump, fall back to walk
			try {
				const runTextures = await this.loadSpritesheet(this.character.spritesheets.run)
				this.textures.set('run', runTextures)
			} catch {
				this.textures.set('run', walkTextures)
			}

			try {
				const jumpTextures = await this.loadSpritesheet(this.character.spritesheets.jump)
				this.textures.set('jump', jumpTextures)
			} catch {
				// Use first frame of walk for jump
				if (walkTextures.length > 0) {
					this.textures.set('jump', [walkTextures[0]])
				}
			}
		} catch (err) {
			throw new Error('Failed to load walk spritesheet - required')
		}

		// Set initial state to idle (stopped)
		this.applyState('idle')
	}

	private async loadSpritesheet(config: SpritesheetConfig): Promise<Texture[]> {
		const cacheKey = config.path
		Assets.cache.remove(cacheKey)

		const texture = await Assets.load(config.path)
		texture.source.scaleMode = 'nearest'

		const frameWidth = texture.width / config.columns
		const frameHeight = texture.height / config.rows
		const textures: Texture[] = []

		for (let i = 0; i < config.totalFrames; i++) {
			const col = i % config.columns
			const row = Math.floor(i / config.columns)

			const frame = new Texture({
				source: texture.source,
				frame: new Rectangle(col * frameWidth, row * frameHeight, frameWidth, frameHeight)
			})
			textures.push(frame)
		}

		return textures
	}

	/**
	 * Update animation state based on player input and physics
	 */
	update(
		velocityX: number,
		_velocityY: number,
		isMovingLeft: boolean,
		isMovingRight: boolean,
		isRunning: boolean,
		_isJumping: boolean,
		isGrounded: boolean
	): void {
		// Update facing direction
		if (isMovingLeft) {
			this.facingRight = false
		} else if (isMovingRight) {
			this.facingRight = true
		}

		// Determine animation state
		let newState: AnimationState
		const isMoving = Math.abs(velocityX) > 0.5

		if (!isGrounded) {
			newState = 'jump'
		} else if (isMoving) {
			newState = isRunning ? 'run' : 'walk'
		} else {
			// Not moving - go to idle immediately
			newState = 'idle'
		}

		// Apply state change
		if (newState !== this.currentState) {
			this.applyState(newState)
		}

		// Update sprite direction
		this.updateDirection()
	}

	private applyState(state: AnimationState): void {
		const textures = this.textures.get(state)
		if (!textures || textures.length === 0) return

		this.currentState = state
		this.sprite.textures = textures

		if (state === 'idle' || state === 'jump') {
			// Static frame - don't animate
			this.sprite.stop()
			this.sprite.gotoAndStop(0)
		} else {
			// Animate walk/run
			this.sprite.animationSpeed = this.character.animationSpeed
			if (state === 'run') {
				this.sprite.animationSpeed = this.character.animationSpeed * 1.5
			}
			this.sprite.gotoAndPlay(0)
		}
	}

	private updateDirection(): void {
		const scale = this.character.scale
		// Sprites face left by default, flip for right
		this.sprite.scale.x = this.facingRight ? -scale : scale
	}

	get state(): AnimationState {
		return this.currentState
	}

	get isFacingRight(): boolean {
		return this.facingRight
	}
}
