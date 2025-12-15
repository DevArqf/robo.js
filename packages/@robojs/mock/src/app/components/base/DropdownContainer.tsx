import { forwardRef } from 'react'
import styles from './DropdownContainer.module.css'

type DropdownPosition = 'absolute' | 'fixed'
type DropdownPlacement = 'bottom' | 'top' | 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'

interface DropdownContainerProps {
	/** Content to render inside the dropdown */
	children: React.ReactNode
	/** CSS position type */
	position?: DropdownPosition
	/** Placement relative to trigger (for absolute positioning) */
	placement?: DropdownPlacement
	/** Custom position coordinates (for fixed positioning like context menus) */
	coordinates?: { x: number; y: number }
	/** Whether position has been calculated (for fixed positioning) */
	isPositioned?: boolean
	/** Maximum height before scrolling */
	maxHeight?: number
	/** Minimum width */
	minWidth?: number
	/** Maximum width */
	maxWidth?: number
	/** Additional CSS class */
	className?: string
	/** ARIA role */
	role?: 'listbox' | 'menu' | 'dialog'
	/** ARIA label */
	'aria-label'?: string
}

/**
 * Base container component for dropdowns, popovers, and context menus.
 * Provides consistent styling for floating UI elements.
 */
export const DropdownContainer = forwardRef<HTMLDivElement, DropdownContainerProps>(
	function DropdownContainer(
		{
			children,
			position = 'absolute',
			placement = 'bottom-start',
			coordinates,
			isPositioned = true,
			maxHeight,
			minWidth,
			maxWidth,
			className,
			role = 'listbox',
			'aria-label': ariaLabel
		},
		ref
	) {
		const positionStyles: React.CSSProperties = {}

		if (position === 'fixed' && coordinates) {
			positionStyles.position = 'fixed'
			positionStyles.top = coordinates.y
			positionStyles.left = coordinates.x
			positionStyles.visibility = isPositioned ? 'visible' : 'hidden'
		} else {
			positionStyles.position = 'absolute'

			// Handle placement
			switch (placement) {
				case 'bottom':
				case 'bottom-start':
					positionStyles.top = 'calc(100% + 4px)'
					positionStyles.left = 0
					break
				case 'bottom-end':
					positionStyles.top = 'calc(100% + 4px)'
					positionStyles.right = 0
					break
				case 'top':
				case 'top-start':
					positionStyles.bottom = 'calc(100% + 4px)'
					positionStyles.left = 0
					break
				case 'top-end':
					positionStyles.bottom = 'calc(100% + 4px)'
					positionStyles.right = 0
					break
			}
		}

		if (maxHeight) {
			positionStyles.maxHeight = maxHeight
		}
		if (minWidth) {
			positionStyles.minWidth = minWidth
		}
		if (maxWidth) {
			positionStyles.maxWidth = maxWidth
		}

		const containerClasses = [styles.container, className].filter(Boolean).join(' ')

		return (
			<div
				ref={ref}
				className={containerClasses}
				style={positionStyles}
				role={role}
				aria-label={ariaLabel}
			>
				{children}
			</div>
		)
	}
)
