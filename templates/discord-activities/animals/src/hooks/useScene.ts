import { Application, Assets, Container, Sprite, TilingSprite } from 'pixi.js'
import { useEffect, useRef, useState } from 'react'
import { GAME_CONFIG } from '../config/game'

export interface UseSceneResult {
	gameContainer: Container | null
	isLoaded: boolean
}

/**
 * Hook to manage scene background layers, tiled floor, and game container
 */
export function useScene(app: Application | null, width: number, height: number): UseSceneResult {
	const [isLoaded, setIsLoaded] = useState(false)
	const containerRef = useRef<Container | null>(null)
	const gameContainerRef = useRef<Container | null>(null)
	const floorRef = useRef<TilingSprite | null>(null)
	const cloudsBackRef = useRef<Sprite | null>(null)
	const cloudsFrontRef = useRef<Sprite | null>(null)
	const loadingRef = useRef(false)

	// Load scene
	useEffect(() => {
		if (!app || loadingRef.current) return

		let cancelled = false
		loadingRef.current = true

		const loadScene = async () => {
			try {
				// Load background and floor textures
				const [backgroundTex, moonTex, cloudsBackTex, cloudsFrontTex, floorTex] = await Promise.all([
					Assets.load(GAME_CONFIG.ASSETS.CLOUDS.BACKGROUND),
					Assets.load(GAME_CONFIG.ASSETS.CLOUDS.MOON),
					Assets.load(GAME_CONFIG.ASSETS.CLOUDS.LAYER_3),
					Assets.load(GAME_CONFIG.ASSETS.CLOUDS.LAYER_4),
					Assets.load('/floors/grass_floor.png')
				])

				if (cancelled) return

				// Set pixel art scaling
				for (const tex of [backgroundTex, moonTex, cloudsBackTex, cloudsFrontTex, floorTex]) {
					tex.source.scaleMode = 'nearest'
				}

				// Create main container
				const container = new Container()

				// Create background sprites with center anchor
				const background = new Sprite(backgroundTex)
				background.anchor.set(0.5)

				const cloudsBack = new Sprite(cloudsBackTex)
				cloudsBack.anchor.set(0.5)

				const moon = new Sprite(moonTex)
				moon.anchor.set(0.5)

				const cloudsFront = new Sprite(cloudsFrontTex)
				cloudsFront.anchor.set(0.5)

				// Create tiled floor (32x32 tile repeated across screen)
				const FLOOR_HEIGHT = 32 // Height of floor visual (2 tiles high)
				const floor = new TilingSprite({
					texture: floorTex,
					width: width,
					height: FLOOR_HEIGHT
				})
				floor.tileScale.set(1, 1) // Keep original 32x32 pixel size
				floor.x = 0
				floor.y = height - FLOOR_HEIGHT // Position at bottom

				// Game container for players
				const gameContainer = new Container()

				// Add layers (back to front)
				// Layer order: background -> cloudsBack -> moon -> cloudsFront -> floor -> gameContainer
				// This ensures floor and players are always in front of sky/clouds
				container.addChild(background) // 0
				container.addChild(cloudsBack) // 1
				container.addChild(moon) // 2
				container.addChild(cloudsFront) // 3
				container.addChild(floor) // 4
				container.addChild(gameContainer) // 5

				// Scale and position background to cover screen
				const updateLayout = () => {
					const bgRatio = backgroundTex.width / backgroundTex.height
					const screenRatio = width / height
					const scale = screenRatio > bgRatio ? width / backgroundTex.width : height / backgroundTex.height

					for (const layer of [background, cloudsBack, moon, cloudsFront]) {
						layer.scale.set(scale)
						layer.x = width / 2
						layer.y = height / 2
					}

					// Update floor dimensions
					floor.width = width
					floor.y = height - FLOOR_HEIGHT
				}

				updateLayout()

				if (cancelled) {
					container.destroy({ children: true })
					return
				}

				app.stage.addChild(container)
				containerRef.current = container
				gameContainerRef.current = gameContainer
				floorRef.current = floor
				cloudsBackRef.current = cloudsBack
				cloudsFrontRef.current = cloudsFront

				// Store for resize
				;(container as any)._texWidth = backgroundTex.width
				;(container as any)._texHeight = backgroundTex.height
				;(container as any)._floorHeight = FLOOR_HEIGHT

				setIsLoaded(true)
			} catch (err) {
				console.error('Failed to load scene:', err)
			} finally {
				loadingRef.current = false
			}
		}

		loadScene()

		return () => {
			cancelled = true
			if (containerRef.current) {
				containerRef.current.destroy({ children: true })
				containerRef.current = null
				gameContainerRef.current = null
				floorRef.current = null
				cloudsBackRef.current = null
				cloudsFrontRef.current = null
			}
			setIsLoaded(false)
			loadingRef.current = false
		}
	}, [app])

	// Handle resize
	useEffect(() => {
		const container = containerRef.current
		const floor = floorRef.current
		if (!container || !floor || !isLoaded) return

		const texWidth = (container as any)._texWidth
		const texHeight = (container as any)._texHeight
		const floorHeight = (container as any)._floorHeight
		if (!texWidth || !texHeight) return

		const bgRatio = texWidth / texHeight
		const screenRatio = width / height
		const scale = screenRatio > bgRatio ? width / texWidth : height / texHeight

		// Update all background children (indices 0-3)
		for (let i = 0; i <= 3; i++) {
			const sprite = container.children[i] as Sprite
			sprite.scale.set(scale)
			sprite.x = width / 2
			sprite.y = height / 2
		}

		// Update floor
		floor.width = width
		floor.y = height - floorHeight
	}, [width, height, isLoaded])

	// Parallax animation
	useEffect(() => {
		if (!app || !isLoaded) return

		const cloudsBack = cloudsBackRef.current
		const cloudsFront = cloudsFrontRef.current
		if (!cloudsBack || !cloudsFront) return

		let time = 0

		const animate = (ticker: { deltaTime: number }) => {
			time += ticker.deltaTime * 0.01
			const baseX = width / 2

			cloudsBack.x = baseX + Math.sin(time * 0.3) * 15
			cloudsFront.x = baseX + Math.sin(time * 0.5) * 30
		}

		app.ticker.add(animate)
		return () => {
			// Check if ticker still exists before removing
			if (app?.ticker) {
				try {
					app.ticker.remove(animate)
				} catch {
					// Ticker may already be destroyed
				}
			}
		}
	}, [app, isLoaded, width])

	return {
		gameContainer: gameContainerRef.current,
		isLoaded
	}
}
