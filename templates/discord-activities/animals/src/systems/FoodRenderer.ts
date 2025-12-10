import { Container, Sprite, Assets, Text, TextStyle } from 'pixi.js'
import type { FoodItem } from '../types/food'
import { FOOD_CONFIG } from '../config/food'
import type { CloudPosition } from '../hooks/useCloudPlatforms'

const SPECIAL_STYLE = new TextStyle({
	fontFamily: 'Silkscreen, Arial',
	fontSize: 12,
	fill: 0xffd700,
	stroke: { color: 0x000000, width: 2 },
	align: 'center'
})

const POINT_STYLE = new TextStyle({
	fontFamily: 'Silkscreen, Arial',
	fontSize: 16,
	fill: 0x00ff00,
	stroke: { color: 0x000000, width: 3 },
	align: 'center'
})

const NEGATIVE_POINT_STYLE = new TextStyle({
	fontFamily: 'Silkscreen, Arial',
	fontSize: 16,
	fill: 0xff4444,
	stroke: { color: 0x000000, width: 3 },
	align: 'center'
})

interface RenderedFood {
	sprite: Sprite
	specialLabel?: Text
	item: FoodItem
	currentX: number // Actual rendered X position (may differ from item.x for cloud-attached food)
	currentY: number // Actual rendered Y position
}

interface FloatingText {
	text: Text
	startY: number
	startTime: number
	duration: number
}

export class FoodRenderer {
	private container: Container
	private renderedItems: Map<string, RenderedFood> = new Map()
	private texturesLoaded: boolean = false
	private textures: Map<string, Awaited<ReturnType<typeof Assets.load>>> = new Map()
	private floatingTexts: FloatingText[] = []

	constructor(parentContainer: Container) {
		this.container = new Container()
		parentContainer.addChild(this.container)
	}

	async loadTextures(): Promise<void> {
		if (this.texturesLoaded) return

		for (const config of Object.values(FOOD_CONFIG)) {
			try {
				const texture = await Assets.load(config.asset)
				texture.source.scaleMode = 'nearest'
				this.textures.set(config.id, texture)
			} catch (err) {
				console.error(`Failed to load texture for ${config.id}:`, err)
			}
		}

		this.texturesLoaded = true
	}

	update(foodItems: FoodItem[], cloudPositions: CloudPosition[] = []): void {
		if (!this.texturesLoaded) return

		const currentIds = new Set(foodItems.map((f) => f.id))

		// Remove sprites for collected/removed food
		for (const [id, rendered] of this.renderedItems) {
			if (!currentIds.has(id)) {
				this.container.removeChild(rendered.sprite)
				rendered.sprite.destroy()
				if (rendered.specialLabel) {
					this.container.removeChild(rendered.specialLabel)
					rendered.specialLabel.destroy()
				}
				this.renderedItems.delete(id)
			}
		}

		// Add/update sprites for current food
		for (const item of foodItems) {
			let rendered = this.renderedItems.get(item.id)

			// Calculate actual position (follow cloud if attached)
			let actualX = item.x
			let actualY = item.y
			if (item.cloudIndex !== undefined && item.cloudOffsetX !== undefined) {
				const cloud = cloudPositions.find((c) => c.index === item.cloudIndex)
				if (cloud) {
					actualX = cloud.x + item.cloudOffsetX
					actualY = cloud.y - 20 // On top of cloud
				}
			}

			if (!rendered) {
				// Create new sprite
				const texture = this.textures.get(item.type)
				if (!texture) continue

				const sprite = new Sprite(texture)
				sprite.anchor.set(0.5, 1) // Anchor at bottom center so food sits on ground
				sprite.scale.set(2)
				sprite.x = actualX
				sprite.y = actualY

				this.container.addChild(sprite)

				rendered = { sprite, item, currentX: actualX, currentY: actualY }

				// Add special indicator for 5-point food
				if (item.isSpecial) {
					const label = new Text({ text: '5', style: SPECIAL_STYLE })
					label.anchor.set(0.5, 0.5)
					label.x = actualX
					label.y = actualY - 40 // Above the sprite
					this.container.addChild(label)
					rendered.specialLabel = label

					// Make special food glow/pulse
					sprite.tint = 0xffd700
				}

				this.renderedItems.set(item.id, rendered)
			} else {
				// Update position (especially important for cloud-attached food)
				rendered.sprite.x = actualX
				rendered.sprite.y = actualY
				rendered.currentX = actualX
				rendered.currentY = actualY
				rendered.item = item

				if (rendered.specialLabel) {
					rendered.specialLabel.x = actualX
					rendered.specialLabel.y = actualY - 40
				}
			}
		}
	}

	// Animate special food items and floating texts
	animate(time: number): void {
		for (const rendered of this.renderedItems.values()) {
			if (rendered.item.isSpecial) {
				// Pulse effect
				const scale = 2 + Math.sin(time * 0.005) * 0.2
				rendered.sprite.scale.set(scale)

				// Floating effect
				const floatOffset = Math.sin(time * 0.003) * 3
				rendered.sprite.y = rendered.item.y + floatOffset

				if (rendered.specialLabel) {
					rendered.specialLabel.y = rendered.item.y - 25 + floatOffset
				}
			}
		}

		// Animate floating point texts
		const now = Date.now()
		for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
			const ft = this.floatingTexts[i]
			const elapsed = now - ft.startTime
			const progress = elapsed / ft.duration

			if (progress >= 1) {
				// Remove finished text
				this.container.removeChild(ft.text)
				ft.text.destroy()
				this.floatingTexts.splice(i, 1)
			} else {
				// Animate upward and fade out
				ft.text.y = ft.startY - progress * 50
				ft.text.alpha = 1 - progress
			}
		}
	}

	// Show floating point indicator
	showPointIndicator(x: number, y: number, points: number, isCorrectFood: boolean): void {
		const style = isCorrectFood ? POINT_STYLE : NEGATIVE_POINT_STYLE
		const displayText = points > 0 ? `+${points}` : `${points}`

		const text = new Text({ text: displayText, style })
		text.anchor.set(0.5, 0.5)
		text.x = x
		text.y = y - 20

		this.container.addChild(text)
		this.floatingTexts.push({
			text,
			startY: y - 20,
			startTime: Date.now(),
			duration: 1000
		})
	}

	getFoodAtPosition(x: number, y: number, radius: number = 30, _cloudPositions: CloudPosition[] = []): FoodItem | null {
		for (const rendered of this.renderedItems.values()) {
			// Use current rendered position (accounts for cloud movement)
			const dx = rendered.currentX - x
			const dy = rendered.currentY - y
			const distance = Math.sqrt(dx * dx + dy * dy)

			if (distance < radius) {
				return rendered.item
			}
		}
		return null
	}

	// Immediately remove a food item from rendering (called when collected)
	removeFood(foodId: string): void {
		const rendered = this.renderedItems.get(foodId)
		if (rendered) {
			this.container.removeChild(rendered.sprite)
			rendered.sprite.destroy()
			if (rendered.specialLabel) {
				this.container.removeChild(rendered.specialLabel)
				rendered.specialLabel.destroy()
			}
			this.renderedItems.delete(foodId)
		}
	}

	destroy(): void {
		for (const rendered of this.renderedItems.values()) {
			rendered.sprite.destroy()
			if (rendered.specialLabel) {
				rendered.specialLabel.destroy()
			}
		}
		this.renderedItems.clear()

		for (const ft of this.floatingTexts) {
			ft.text.destroy()
		}
		this.floatingTexts = []

		this.container.destroy({ children: true })
	}
}
