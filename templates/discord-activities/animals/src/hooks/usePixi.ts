import { Application } from 'pixi.js'
import { useEffect, useRef, useState } from 'react'
import { GAME_CONFIG } from '../config/game'

export interface UsePixiResult {
	app: Application | null
	isReady: boolean
	width: number
	height: number
}

/**
 * Hook to manage PixiJS Application lifecycle
 * Handles initialization, cleanup, resize, and visibility changes
 */
export function usePixi(containerRef: React.RefObject<HTMLDivElement | null>, enabled: boolean = true): UsePixiResult {
	const [app, setApp] = useState<Application | null>(null)
	const [isReady, setIsReady] = useState(false)
	const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight })

	const appRef = useRef<Application | null>(null)
	const initializingRef = useRef(false)

	// Initialize PixiJS
	useEffect(() => {
		const container = containerRef.current
		if (!enabled || !container || initializingRef.current) return

		let cancelled = false
		initializingRef.current = true

		const init = async () => {
			const pixiApp = new Application()

			try {
				await pixiApp.init({
					backgroundColor: GAME_CONFIG.BACKGROUND_COLOR,
					antialias: false, // Better for pixel art
					resolution: window.devicePixelRatio || 1,
					autoDensity: true,
					resizeTo: window
				})
			} catch (err) {
				console.error('Failed to initialize Pixi app:', err)
				initializingRef.current = false
				return
			}

			if (cancelled) {
				pixiApp.destroy(true, { children: true })
				initializingRef.current = false
				return
			}

			appRef.current = pixiApp
			container.appendChild(pixiApp.canvas)

			setApp(pixiApp)
			setDimensions({ width: pixiApp.screen.width, height: pixiApp.screen.height })
			setIsReady(true)
			initializingRef.current = false
		}

		init()

		return () => {
			cancelled = true
			setIsReady(false)
			setApp(null)

			if (appRef.current) {
				appRef.current.destroy(true, { children: true })
				appRef.current = null
			}
			initializingRef.current = false
		}
	}, [containerRef, enabled])

	// Handle resize
	useEffect(() => {
		if (!app) return

		const handleResize = () => {
			setDimensions({ width: app.screen.width, height: app.screen.height })
		}

		window.addEventListener('resize', handleResize)
		return () => window.removeEventListener('resize', handleResize)
	}, [app])

	// Handle visibility changes (tab switching)
	useEffect(() => {
		if (!app) return

		const handleVisibilityChange = () => {
			if (document.hidden) {
				app.ticker.stop()
			} else {
				app.ticker.start()
			}
		}

		document.addEventListener('visibilitychange', handleVisibilityChange)
		return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
	}, [app])

	return { app, isReady, width: dimensions.width, height: dimensions.height }
}
