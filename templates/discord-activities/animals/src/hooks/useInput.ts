import { useEffect, useRef, useCallback, useState } from 'react'

export interface InputState {
	left: boolean
	right: boolean
	up: boolean
	down: boolean
	jump: boolean
	run: boolean
}

export interface UseInputResult {
	input: InputState
	isReady: boolean
}

const INITIAL_STATE: InputState = {
	left: false,
	right: false,
	up: false,
	down: false,
	jump: false,
	run: false
}

/**
 * Hook to manage keyboard input
 * Returns current input state updated in real-time
 */
export function useInput(): UseInputResult {
	const [isReady, setIsReady] = useState(false)
	const inputRef = useRef<InputState>({ ...INITIAL_STATE })
	const [, forceUpdate] = useState(0)

	const updateKey = useCallback((key: string, pressed: boolean) => {
		const lowerKey = key.toLowerCase()
		let changed = false

		switch (lowerKey) {
			case 'a':
			case 'arrowleft':
				if (inputRef.current.left !== pressed) {
					inputRef.current.left = pressed
					changed = true
				}
				break
			case 'd':
			case 'arrowright':
				if (inputRef.current.right !== pressed) {
					inputRef.current.right = pressed
					changed = true
				}
				break
			case 'w':
			case 'arrowup':
				if (inputRef.current.up !== pressed) {
					inputRef.current.up = pressed
					changed = true
				}
				break
			case 's':
			case 'arrowdown':
				if (inputRef.current.down !== pressed) {
					inputRef.current.down = pressed
					changed = true
				}
				break
			case ' ':
				if (inputRef.current.jump !== pressed) {
					inputRef.current.jump = pressed
					changed = true
				}
				break
			case 'shift':
				if (inputRef.current.run !== pressed) {
					inputRef.current.run = pressed
					changed = true
				}
				break
		}

		if (changed) {
			forceUpdate(n => n + 1)
		}
	}, [])

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Prevent default for game keys
			if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
				e.preventDefault()
			}
			updateKey(e.key, true)
		}

		const handleKeyUp = (e: KeyboardEvent) => {
			updateKey(e.key, false)
		}

		const handleBlur = () => {
			// Reset all inputs when window loses focus
			inputRef.current = { ...INITIAL_STATE }
			forceUpdate(n => n + 1)
		}

		const handleVisibilityChange = () => {
			if (document.hidden) {
				inputRef.current = { ...INITIAL_STATE }
				forceUpdate(n => n + 1)
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		window.addEventListener('keyup', handleKeyUp)
		window.addEventListener('blur', handleBlur)
		document.addEventListener('visibilitychange', handleVisibilityChange)

		setIsReady(true)

		return () => {
			window.removeEventListener('keydown', handleKeyDown)
			window.removeEventListener('keyup', handleKeyUp)
			window.removeEventListener('blur', handleBlur)
			document.removeEventListener('visibilitychange', handleVisibilityChange)
		}
	}, [updateKey])

	return {
		input: inputRef.current,
		isReady
	}
}
