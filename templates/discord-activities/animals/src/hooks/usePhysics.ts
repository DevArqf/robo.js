import Matter from 'matter-js'
import { useEffect, useRef, useState } from 'react'
import { GAME_CONFIG } from '../config/game'

export interface UsePhysicsResult {
	engine: Matter.Engine | null
	world: Matter.World | null
	floorBody: Matter.Body | null
	floorY: number
	isReady: boolean
}

/**
 * Hook to manage Matter.js physics engine
 * Floor is always at the bottom of the screen (100vh)
 */
export function usePhysics(screenWidth: number, screenHeight: number): UsePhysicsResult {
	const [isReady, setIsReady] = useState(false)

	const engineRef = useRef<Matter.Engine | null>(null)
	const runnerRef = useRef<Matter.Runner | null>(null)
	const floorBodyRef = useRef<Matter.Body | null>(null)

	// Floor Y is at the very bottom of the screen
	const floorY = screenHeight

	// Initialize physics engine
	useEffect(() => {
		// Create engine with gravity
		const engine = Matter.Engine.create({
			gravity: GAME_CONFIG.GRAVITY
		})

		// Create runner
		const runner = Matter.Runner.create()
		Matter.Runner.run(runner, engine)

		// Create floor body at bottom of screen
		const floorThickness = 50
		const floorBody = Matter.Bodies.rectangle(
			screenWidth / 2,
			screenHeight + floorThickness / 2, // Position below visible area
			screenWidth * 3, // Extra wide
			floorThickness,
			{
				isStatic: true,
				friction: 0.8,
				label: 'floor'
			}
		)

		Matter.World.add(engine.world, floorBody)

		// One-way platform logic for clouds (Mario-style)
		// In screen coordinates: Y increases downward, so smaller Y = higher on screen
		Matter.Events.on(engine, 'beforeUpdate', () => {
			const bodies = Matter.Composite.allBodies(engine.world)
			const player = bodies.find((b) => b.label === 'player')
			const clouds = bodies.filter((b) => b.label === 'cloud-platform')

			if (!player) return

			for (const cloud of clouds) {
				// Player feet position (bottom of player hitbox)
				const playerFeet = player.position.y + 35
				// Platform top position
				const platformTop = cloud.position.y - 1

				// Player is "above" the platform when playerFeet Y < platformTop Y
				// (smaller Y = higher on screen)
				const isPlayerAboveCloud = playerFeet < platformTop

				// Player is moving upward (jumping through platform)
				const isPlayerMovingUp = player.velocity.y < -0.5

				// Player is below the platform (coming from underneath)
				const isPlayerBelowCloud = playerFeet > platformTop + 10

				if (isPlayerMovingUp || isPlayerBelowCloud) {
					// Disable collision - player passes through from below
					cloud.collisionFilter.category = 0x0000
					cloud.collisionFilter.mask = 0x0000
				} else if (isPlayerAboveCloud || player.velocity.y >= 0) {
					// Enable collision - player can land on cloud or is standing on it
					cloud.collisionFilter.category = 0x0002
					cloud.collisionFilter.mask = 0xffff
				}
			}
		})

		engineRef.current = engine
		runnerRef.current = runner
		floorBodyRef.current = floorBody
		setIsReady(true)

		return () => {
			Matter.Runner.stop(runner)
			Matter.Engine.clear(engine)
			engineRef.current = null
			runnerRef.current = null
			floorBodyRef.current = null
			setIsReady(false)
		}
	}, [])

	// Update floor position on resize
	useEffect(() => {
		if (!floorBodyRef.current || !isReady) return

		const floorThickness = 50
		Matter.Body.setPosition(floorBodyRef.current, {
			x: screenWidth / 2,
			y: screenHeight + floorThickness / 2
		})
	}, [screenWidth, screenHeight, isReady])

	return {
		engine: engineRef.current,
		world: engineRef.current?.world ?? null,
		floorBody: floorBodyRef.current,
		floorY,
		isReady
	}
}
