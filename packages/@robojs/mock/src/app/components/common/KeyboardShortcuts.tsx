import { useEffect, useCallback, useRef } from 'react'
import { usePlaybackControls } from '../../stores/playbackStore'

/**
 * Check if the currently focused element is an input or textarea
 */
function isInputFocused(): boolean {
	const activeElement = document.activeElement
	if (!activeElement) return false

	const tagName = activeElement.tagName.toLowerCase()
	if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true

	// Check for contentEditable
	if ((activeElement as HTMLElement).isContentEditable) return true

	return false
}

/**
 * Global keyboard shortcuts handler
 * - Ctrl/Cmd+K → Focus command input
 * - Space (when not in input) → Toggle playback
 * - Left/Right Arrow (when not in input) → Seek playback ±5 seconds
 * - Escape → Dispatch escape event for modals/dropdowns
 */
export function KeyboardShortcuts() {
	const { togglePlay, seek, currentTime, mode, eventCount, setMode } = usePlaybackControls()

	// Use refs to avoid recreating the callback on every state change
	const stateRef = useRef({ currentTime, mode, eventCount })
	stateRef.current = { currentTime, mode, eventCount }

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			const { currentTime, mode, eventCount } = stateRef.current

			// Ctrl/Cmd+K → Focus command input
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault()
				const commandInput = document.querySelector<HTMLTextAreaElement>('[data-command-input]')
				if (commandInput) {
					commandInput.focus()
					// If not already starting with /, add it
					if (!commandInput.value.startsWith('/')) {
						commandInput.value = '/'
						// Trigger input event to update React state
						commandInput.dispatchEvent(new Event('input', { bubbles: true }))
					}
				}
				return
			}

			// Skip other shortcuts if in input
			if (isInputFocused()) return

			// Space → Toggle playback (works in both modes if there are events)
			if (e.key === ' ' || e.code === 'Space') {
				e.preventDefault()
				if (eventCount > 0) {
					// Auto-switch to playback mode if in live mode
					if (mode === 'live') {
						setMode('playback')
					}
					togglePlay()
				}
				return
			}

			// Left Arrow → Seek back 5 seconds
			if (e.key === 'ArrowLeft') {
				e.preventDefault()
				if (eventCount > 0) {
					if (mode === 'live') {
						setMode('playback')
					}
					seek(Math.max(0, currentTime - 5000))
				}
				return
			}

			// Right Arrow → Seek forward 5 seconds
			if (e.key === 'ArrowRight') {
				e.preventDefault()
				if (eventCount > 0) {
					if (mode === 'live') {
						setMode('playback')
					}
					seek(currentTime + 5000)
				}
				return
			}

			// Escape is handled by individual components via event bubbling
		},
		[togglePlay, seek, setMode]
	)

	useEffect(() => {
		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [handleKeyDown])

	// This component doesn't render anything
	return null
}
