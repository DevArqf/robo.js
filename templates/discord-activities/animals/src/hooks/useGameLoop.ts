import { Application } from 'pixi.js'
import { useEffect, useRef } from 'react'

export type TickerCallback = (delta: number) => void

/**
 * Hook to manage game loop callbacks
 * Properly adds/removes ticker callbacks with cleanup
 */
export function useGameLoop(app: Application | null, callback: TickerCallback, enabled: boolean = true): void {
	const callbackRef = useRef(callback)
	const appRef = useRef(app)

	// Keep refs updated
	useEffect(() => {
		callbackRef.current = callback
	}, [callback])

	useEffect(() => {
		appRef.current = app
	}, [app])

	useEffect(() => {
		if (!app || !enabled) return

		const tickerCallback = (ticker: { deltaTime: number }) => {
			callbackRef.current(ticker.deltaTime)
		}

		app.ticker.add(tickerCallback)

		return () => {
			// Check if app and ticker still exist before removing
			if (appRef.current?.ticker) {
				try {
					appRef.current.ticker.remove(tickerCallback)
				} catch {
					// Ticker may already be destroyed
				}
			}
		}
	}, [app, enabled])
}
