import { useEffect, useRef, useState, useCallback } from 'react'

interface UseDropdownOptions {
	/** Close when clicking outside the dropdown */
	closeOnClickOutside?: boolean
	/** Close when pressing Escape key */
	closeOnEscape?: boolean
	/** Delay before adding click outside listener (prevents immediate close) */
	clickOutsideDelay?: number
	/** Callback when dropdown closes */
	onClose?: () => void
}

interface UseDropdownReturn<T extends HTMLElement> {
	/** Ref to attach to the dropdown container */
	containerRef: React.RefObject<T>
	/** Whether the dropdown is currently open */
	isOpen: boolean
	/** Open the dropdown */
	open: () => void
	/** Close the dropdown */
	close: () => void
	/** Toggle the dropdown */
	toggle: () => void
	/** Set open state directly */
	setIsOpen: (open: boolean) => void
}

/**
 * Hook for managing dropdown open/close behavior with click-outside and escape key handling.
 * Consolidates common dropdown logic used across SelectMenu, ContextMenu, EmojiPicker, etc.
 */
export function useDropdown<T extends HTMLElement = HTMLDivElement>(
	options: UseDropdownOptions = {}
): UseDropdownReturn<T> {
	const {
		closeOnClickOutside = true,
		closeOnEscape = true,
		clickOutsideDelay = 0,
		onClose
	} = options

	const [isOpen, setIsOpen] = useState(false)
	const containerRef = useRef<T>(null)

	const close = useCallback(() => {
		setIsOpen(false)
		onClose?.()
	}, [onClose])

	const open = useCallback(() => {
		setIsOpen(true)
	}, [])

	const toggle = useCallback(() => {
		setIsOpen((prev) => {
			if (prev) {
				onClose?.()
			}
			return !prev
		})
	}, [onClose])

	// Close on click outside
	useEffect(() => {
		if (!isOpen || !closeOnClickOutside) return

		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				close()
			}
		}

		// Delay to prevent immediate close from the same click that opened it
		const timer = setTimeout(() => {
			document.addEventListener('mousedown', handleClickOutside)
		}, clickOutsideDelay)

		return () => {
			clearTimeout(timer)
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [isOpen, closeOnClickOutside, clickOutsideDelay, close])

	// Close on Escape key
	useEffect(() => {
		if (!isOpen || !closeOnEscape) return

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				close()
			}
		}

		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [isOpen, closeOnEscape, close])

	return {
		containerRef,
		isOpen,
		open,
		close,
		toggle,
		setIsOpen
	}
}

interface Position {
	x: number
	y: number
}

interface UseDropdownPositionOptions {
	/** Initial position */
	position: Position
	/** Padding from viewport edges */
	viewportPadding?: number
}

interface UseDropdownPositionReturn {
	/** Ref to attach to the dropdown element */
	dropdownRef: React.RefObject<HTMLDivElement>
	/** Adjusted position that keeps dropdown in viewport */
	adjustedPosition: Position
	/** Whether position has been calculated */
	isPositioned: boolean
}

/**
 * Hook for adjusting dropdown position to keep it within viewport bounds.
 * Used by ContextMenu and other position-sensitive dropdowns.
 */
export function useDropdownPosition(options: UseDropdownPositionOptions): UseDropdownPositionReturn {
	const { position, viewportPadding = 8 } = options

	const dropdownRef = useRef<HTMLDivElement>(null)
	const [adjustedPosition, setAdjustedPosition] = useState(position)
	const [isPositioned, setIsPositioned] = useState(false)

	useEffect(() => {
		if (!dropdownRef.current) return

		const dropdown = dropdownRef.current
		const rect = dropdown.getBoundingClientRect()
		const viewportWidth = window.innerWidth
		const viewportHeight = window.innerHeight

		let { x, y } = position

		// Adjust horizontal position if dropdown would overflow right
		if (x + rect.width > viewportWidth - viewportPadding) {
			x = viewportWidth - rect.width - viewportPadding
		}

		// Adjust vertical position if dropdown would overflow bottom
		if (y + rect.height > viewportHeight - viewportPadding) {
			y = viewportHeight - rect.height - viewportPadding
		}

		// Ensure minimum position
		x = Math.max(viewportPadding, x)
		y = Math.max(viewportPadding, y)

		setAdjustedPosition({ x, y })
		setIsPositioned(true)
	}, [position.x, position.y, viewportPadding])

	return {
		dropdownRef,
		adjustedPosition,
		isPositioned
	}
}
