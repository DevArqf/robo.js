import { forwardRef } from 'react'
import styles from './ListItem.module.css'

interface ListItemProps {
	/** Main label text */
	label: string
	/** Optional description text */
	description?: string
	/** Icon or emoji to show on the left */
	icon?: React.ReactNode
	/** Content to show on the right (e.g., checkmark, chevron) */
	rightContent?: React.ReactNode
	/** Whether the item is currently selected */
	isSelected?: boolean
	/** Whether the item is highlighted (e.g., via keyboard navigation) */
	isHighlighted?: boolean
	/** Whether the item is disabled */
	isDisabled?: boolean
	/** Click handler */
	onClick?: () => void
	/** Mouse enter handler (for keyboard navigation) */
	onMouseEnter?: () => void
	/** ARIA role */
	role?: 'option' | 'menuitem' | 'button'
	/** Additional CSS class */
	className?: string
	/** Whether to truncate text with ellipsis */
	truncate?: boolean
}

/**
 * Reusable list item component for dropdowns, menus, and selectable lists.
 * Provides consistent styling for interactive list items across the app.
 */
export const ListItem = forwardRef<HTMLDivElement, ListItemProps>(
	function ListItem(
		{
			label,
			description,
			icon,
			rightContent,
			isSelected = false,
			isHighlighted = false,
			isDisabled = false,
			onClick,
			onMouseEnter,
			role = 'option',
			className,
			truncate = true
		},
		ref
	) {
		const itemClasses = [
			styles.item,
			isSelected && styles.selected,
			isHighlighted && styles.highlighted,
			isDisabled && styles.disabled,
			className
		].filter(Boolean).join(' ')

		const handleClick = () => {
			if (!isDisabled && onClick) {
				onClick()
			}
		}

		const handleKeyDown = (e: React.KeyboardEvent) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault()
				handleClick()
			}
		}

		return (
			<div
				ref={ref}
				className={itemClasses}
				onClick={handleClick}
				onMouseEnter={onMouseEnter}
				onKeyDown={handleKeyDown}
				role={role}
				aria-selected={role === 'option' ? isSelected : undefined}
				aria-disabled={isDisabled}
				tabIndex={isDisabled ? -1 : 0}
			>
				{icon && <span className={styles.icon}>{icon}</span>}
				<div className={styles.content}>
					<span className={`${styles.label} ${truncate ? styles.truncate : ''}`}>
						{label}
					</span>
					{description && (
						<span className={`${styles.description} ${truncate ? styles.truncate : ''}`}>
							{description}
						</span>
					)}
				</div>
				{rightContent && <span className={styles.rightContent}>{rightContent}</span>}
			</div>
		)
	}
)

interface ListItemSeparatorProps {
	className?: string
}

/**
 * Separator line between list item groups
 */
export function ListItemSeparator({ className }: ListItemSeparatorProps) {
	return <div className={`${styles.separator} ${className || ''}`} role="separator" />
}

interface ListItemHeaderProps {
	children: React.ReactNode
	className?: string
}

/**
 * Header/label for a group of list items
 */
export function ListItemHeader({ children, className }: ListItemHeaderProps) {
	return <div className={`${styles.header} ${className || ''}`}>{children}</div>
}
