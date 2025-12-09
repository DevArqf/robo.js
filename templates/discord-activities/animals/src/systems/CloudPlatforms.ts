import { Container, Sprite, Assets } from 'pixi.js'
import Matter from 'matter-js'

interface CloudPlatform {
	sprite: Sprite
	body: Matter.Body
	baseX: number
	baseY: number
	phaseX: number
	phaseY: number
	speedX: number
	speedY: number
	amplitudeX: number
	amplitudeY: number
}

export class CloudPlatforms {
	private container: Container
	private clouds: CloudPlatform[] = []
	private physicsWorld: Matter.World
	private time: number = 0

	constructor(parentContainer: Container, physicsWorld: Matter.World) {
		this.container = new Container()
		this.physicsWorld = physicsWorld
		parentContainer.addChild(this.container)
	}

	/**
	 * Load cloud texture and spawn random platforms without overlap
	 */
	async spawn(count: number, screenWidth: number, screenHeight: number): Promise<void> {
		const texture = await Assets.load('/clouditem.png')
		texture.source.scaleMode = 'nearest'

		const cloudWidth = 69
		const cloudHeight = 40
		const scale = 2
		const scaledWidth = cloudWidth * scale

		// Define spawn area (lower so players can jump to them)
		const minY = screenHeight * 0.4
		const maxY = screenHeight * 0.75
		const padding = 120

		// Minimum distance between cloud centers to prevent overlap
		const minDistance = scaledWidth * 1.5

		// Store placed positions to check for overlap
		const placedPositions: { x: number; y: number }[] = []

		const isOverlapping = (x: number, y: number): boolean => {
			for (const pos of placedPositions) {
				const dx = x - pos.x
				const dy = y - pos.y
				const distance = Math.sqrt(dx * dx + dy * dy)
				if (distance < minDistance) {
					return true
				}
			}
			return false
		}

		for (let i = 0; i < count; i++) {
			// Try to find a non-overlapping position
			let x: number, y: number
			let attempts = 0
			const maxAttempts = 50

			do {
				x = padding + Math.random() * (screenWidth - padding * 2)
				y = minY + Math.random() * (maxY - minY)
				attempts++
			} while (isOverlapping(x, y) && attempts < maxAttempts)

			// Store position
			placedPositions.push({ x, y })

			// Create sprite
			const sprite = new Sprite(texture)
			sprite.anchor.set(0.5, 0.5)
			sprite.scale.set(scale)
			sprite.x = x
			sprite.y = y

			// Create physics body (static platform at center of cloud)
			const body = Matter.Bodies.rectangle(
				x,
				y, // Center of cloud
				cloudWidth * scale * 0.8, // Width
				cloudHeight * scale * 0.4, // Thin-ish platform
				{
					isStatic: true,
					friction: 0.8,
					restitution: 0,
					label: 'cloud-platform'
				}
			)

			Matter.World.add(this.physicsWorld, body)
			this.container.addChild(sprite)

			console.log(
				'[CloudPlatforms] Added cloud at',
				x,
				y,
				'body position:',
				body.position,
				'isStatic:',
				body.isStatic,
				'world bodies count:',
				this.physicsWorld.bodies.length
			)

			// Random animation parameters for each cloud
			this.clouds.push({
				sprite,
				body,
				baseX: x,
				baseY: y,
				phaseX: Math.random() * Math.PI * 2,
				phaseY: Math.random() * Math.PI * 2,
				speedX: 0.3 + Math.random() * 0.4,
				speedY: 0.5 + Math.random() * 0.5,
				amplitudeX: 20 + Math.random() * 30,
				amplitudeY: 8 + Math.random() * 12
			})
		}
	}

	/**
	 * Get all cloud platforms
	 */
	getClouds(): CloudPlatform[] {
		return this.clouds
	}

	/**
	 * Update clouds with floating animation
	 */
	update(deltaTime: number): void {
		this.time += deltaTime * 0.016

		for (const cloud of this.clouds) {
			// Calculate new position with sine wave animation
			const offsetX = Math.sin(this.time * cloud.speedX + cloud.phaseX) * cloud.amplitudeX
			const offsetY = Math.sin(this.time * cloud.speedY + cloud.phaseY) * cloud.amplitudeY

			const newX = cloud.baseX + offsetX
			const newY = cloud.baseY + offsetY

			// Update sprite position
			cloud.sprite.x = newX
			cloud.sprite.y = newY

			// Update physics body position (same as sprite)
			Matter.Body.setPosition(cloud.body, {
				x: newX,
				y: newY
			})
		}
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		for (const cloud of this.clouds) {
			Matter.World.remove(this.physicsWorld, cloud.body)
			cloud.sprite.destroy()
		}
		this.clouds = []
		this.container.destroy({ children: true })
	}
}
