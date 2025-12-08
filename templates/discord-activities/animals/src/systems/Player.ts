import { AnimatedSprite, Container, Text, TextStyle, Texture } from 'pixi.js'
import Matter from 'matter-js'
import type { CharacterConfig } from '../types/character'
import type { InputState } from '../hooks/useInput'
import { AnimationController } from './AnimationController'
import { GAME_CONFIG } from '../config/game'

const NAME_STYLE = new TextStyle({
	fontFamily: 'Silkscreen, Arial',
	fontSize: 14,
	fill: 0xffffff,
	stroke: { color: 0x000000, width: 3 },
	align: 'center'
})

export class Player {
	readonly container: Container
	readonly sprite: AnimatedSprite
	readonly nameLabel: Text
	readonly body: Matter.Body

	private animationController: AnimationController
	private character: CharacterConfig
	private isOnGround: boolean = false
	private jumpRequested: boolean = false

	constructor(
		character: CharacterConfig,
		username: string,
		spawnX: number,
		spawnY: number,
		physicsWorld: Matter.World
	) {
		this.character = character

		// Create container
		this.container = new Container()

		// Create sprite with placeholder texture
		this.sprite = new AnimatedSprite([Texture.EMPTY])
		this.sprite.anchor.set(0.5, 1)
		this.sprite.scale.set(character.scale)
		this.sprite.animationSpeed = character.animationSpeed
		this.sprite.loop = true
		this.sprite.y = 0

		// Create name label
		this.nameLabel = new Text({ text: username, style: NAME_STYLE })
		this.nameLabel.anchor.set(0.5, 1)
		this.nameLabel.y = -this.estimatedHeight - 10

		this.container.addChild(this.sprite)
		this.container.addChild(this.nameLabel)

		// Position container
		this.container.x = spawnX
		this.container.y = spawnY

		// Create physics body
		this.body = Matter.Bodies.rectangle(
			spawnX,
			spawnY - this.estimatedHeight / 2,
			this.estimatedWidth * 0.5,
			this.estimatedHeight * 0.8,
			{
				friction: 0,
				frictionAir: 0.01,
				restitution: 0,
				mass: character.mass,
				inertia: Infinity, // Prevent rotation
				label: 'player'
			}
		)

		Matter.World.add(physicsWorld, this.body)

		// Create animation controller
		this.animationController = new AnimationController(this.sprite, character)
	}

	private get estimatedWidth(): number {
		// Estimate based on typical 64x64 frame * scale
		return 64 * this.character.scale
	}

	private get estimatedHeight(): number {
		return 64 * this.character.scale
	}

	/**
	 * Load all animation spritesheets
	 */
	async loadAnimations(): Promise<void> {
		await this.animationController.loadAllTextures()
		// Update name label position based on actual sprite height
		this.nameLabel.y = -this.sprite.height - 10
	}

	/**
	 * Update player physics and animation
	 */
	update(input: InputState, screenWidth: number, floorY: number): void {
		this.handleMovement(input)
		this.handleJump(input)
		this.syncSpriteToBody()
		this.constrainToScreen(screenWidth)
		this.updateAnimation(input)
		this.checkGrounded(floorY)
	}

	private handleMovement(input: InputState): void {
		const isRunning = input.run
		const force = isRunning ? GAME_CONFIG.RUN_FORCE : GAME_CONFIG.WALK_FORCE
		const maxVel = isRunning ? GAME_CONFIG.MAX_RUN_VELOCITY : GAME_CONFIG.MAX_WALK_VELOCITY

		let isMoving = false

		if (input.left) {
			Matter.Body.applyForce(this.body, this.body.position, { x: -force * this.character.mass, y: 0 })
			isMoving = true
		}
		if (input.right) {
			Matter.Body.applyForce(this.body, this.body.position, { x: force * this.character.mass, y: 0 })
			isMoving = true
		}

		// Apply damping when not moving
		if (!isMoving) {
			Matter.Body.setVelocity(this.body, {
				x: this.body.velocity.x * GAME_CONFIG.HORIZONTAL_DAMPING,
				y: this.body.velocity.y
			})
		}

		// Clamp velocity
		if (Math.abs(this.body.velocity.x) > maxVel) {
			Matter.Body.setVelocity(this.body, {
				x: Math.sign(this.body.velocity.x) * maxVel,
				y: this.body.velocity.y
			})
		}
	}

	private handleJump(input: InputState): void {
		// Only allow jump if on ground and jump just pressed
		if (input.jump && this.isOnGround && !this.jumpRequested) {
			this.jumpRequested = true

			// Calculate jump direction based on facing and input
			let horizontalBoost = 0
			if (input.left) {
				horizontalBoost = -2
			} else if (input.right) {
				horizontalBoost = 2
			} else if (this.animationController.isFacingRight) {
				horizontalBoost = 1
			} else {
				horizontalBoost = -1
			}

			Matter.Body.applyForce(this.body, this.body.position, {
				x: horizontalBoost * this.character.jumpForce * 0.3,
				y: -this.character.jumpForce * this.character.mass
			})

			this.isOnGround = false
		}

		// Reset jump request when key released
		if (!input.jump) {
			this.jumpRequested = false
		}
	}

	private checkGrounded(floorY: number): void {
		// Check if body is near ground level
		const bodyBottom = this.body.position.y + this.estimatedHeight * 0.4
		this.isOnGround = bodyBottom >= floorY - 5 && this.body.velocity.y >= -0.1
	}

	private syncSpriteToBody(): void {
		// Body position is center, container position is at sprite feet
		this.container.x = this.body.position.x
		this.container.y = this.body.position.y + this.estimatedHeight * 0.4
	}

	private constrainToScreen(screenWidth: number): void {
		const halfWidth = this.estimatedWidth / 2

		if (this.body.position.x < halfWidth) {
			Matter.Body.setPosition(this.body, { x: halfWidth, y: this.body.position.y })
			Matter.Body.setVelocity(this.body, { x: 0, y: this.body.velocity.y })
		} else if (this.body.position.x > screenWidth - halfWidth) {
			Matter.Body.setPosition(this.body, { x: screenWidth - halfWidth, y: this.body.position.y })
			Matter.Body.setVelocity(this.body, { x: 0, y: this.body.velocity.y })
		}
	}

	private updateAnimation(input: InputState): void {
		this.animationController.update(
			this.body.velocity.x,
			this.body.velocity.y,
			input.left,
			input.right,
			input.run,
			input.jump,
			this.isOnGround
		)
	}

	/**
	 * Get current position for sync
	 */
	getPosition(): { x: number; y: number } {
		return {
			x: this.container.x,
			y: this.container.y
		}
	}

	/**
	 * Cleanup resources
	 */
	destroy(physicsWorld: Matter.World): void {
		Matter.World.remove(physicsWorld, this.body)
		this.container.destroy({ children: true })
	}
}
