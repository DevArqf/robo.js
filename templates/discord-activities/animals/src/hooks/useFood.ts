import { useEffect, useRef, useState, useCallback } from 'react'
import { Container } from 'pixi.js'
import { FoodRenderer } from '../systems/FoodRenderer'
import type { FoodItem } from '../types/food'
import type { CloudPosition } from './useCloudPlatforms'

export interface UseFoodResult {
	isReady: boolean
	updateFood: (foodItems: FoodItem[], time: number, cloudPositions: CloudPosition[]) => void
	checkCollision: (playerX: number, playerY: number, cloudPositions: CloudPosition[]) => FoodItem | null
	showPointIndicator: (x: number, y: number, points: number, isCorrectFood: boolean) => void
	removeFood: (foodId: string) => void
}

export function useFood(gameContainer: Container | null): UseFoodResult {
	const [isReady, setIsReady] = useState(false)
	const rendererRef = useRef<FoodRenderer | null>(null)

	// Initialize food renderer
	useEffect(() => {
		if (!gameContainer) return

		const renderer = new FoodRenderer(gameContainer)
		rendererRef.current = renderer

		renderer.loadTextures().then(() => {
			setIsReady(true)
		})

		return () => {
			renderer.destroy()
			rendererRef.current = null
			setIsReady(false)
		}
	}, [gameContainer])

	const updateFood = useCallback((foodItems: FoodItem[], time: number, cloudPositions: CloudPosition[]) => {
		if (!rendererRef.current) return
		rendererRef.current.update(foodItems, cloudPositions)
		rendererRef.current.animate(time)
	}, [])

	const checkCollision = useCallback(
		(playerX: number, playerY: number, cloudPositions: CloudPosition[]): FoodItem | null => {
			if (!rendererRef.current) return null
			return rendererRef.current.getFoodAtPosition(playerX, playerY, 50, cloudPositions) // Increased collision radius
		},
		[]
	)

	const showPointIndicator = useCallback((x: number, y: number, points: number, isCorrectFood: boolean) => {
		if (!rendererRef.current) return
		rendererRef.current.showPointIndicator(x, y, points, isCorrectFood)
	}, [])

	const removeFood = useCallback((foodId: string) => {
		if (!rendererRef.current) return
		rendererRef.current.removeFood(foodId)
	}, [])

	return {
		isReady,
		updateFood,
		checkCollision,
		showPointIndicator,
		removeFood
	}
}
