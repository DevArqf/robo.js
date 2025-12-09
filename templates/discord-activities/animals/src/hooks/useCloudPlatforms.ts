import { Container } from 'pixi.js'
import Matter from 'matter-js'
import { useEffect, useRef, useState, useCallback } from 'react'
import { CloudPlatforms } from '../systems/CloudPlatforms'

export interface UseCloudPlatformsResult {
	cloudPlatforms: CloudPlatforms | null
	isReady: boolean
	updateClouds: (deltaTime: number) => void
}

/**
 * Hook to manage cloud platforms in the game
 */
export function useCloudPlatforms(
	gameContainer: Container | null,
	physicsWorld: Matter.World | null,
	width: number,
	height: number,
	cloudCount: number = 5
): UseCloudPlatformsResult {
	const [isReady, setIsReady] = useState(false)
	const cloudPlatformsRef = useRef<CloudPlatforms | null>(null)

	useEffect(() => {
		if (!gameContainer || !physicsWorld || !width || !height) return

		let cancelled = false

		const initClouds = async () => {
			// Create cloud platforms system
			const clouds = new CloudPlatforms(gameContainer, physicsWorld)

			try {
				await clouds.spawn(cloudCount, width, height)

				if (cancelled) {
					clouds.destroy()
					return
				}

				cloudPlatformsRef.current = clouds
				setIsReady(true)
			} catch (err) {
				console.error('Failed to load cloud platforms:', err)
				clouds.destroy()
			}
		}

		initClouds()

		return () => {
			cancelled = true
			if (cloudPlatformsRef.current) {
				cloudPlatformsRef.current.destroy()
				cloudPlatformsRef.current = null
			}
			setIsReady(false)
		}
	}, [gameContainer, physicsWorld, width, height, cloudCount])

	const updateClouds = useCallback((deltaTime: number) => {
		if (cloudPlatformsRef.current) {
			cloudPlatformsRef.current.update(deltaTime)
		}
	}, [])

	return {
		cloudPlatforms: cloudPlatformsRef.current,
		isReady,
		updateClouds
	}
}
