import type { ReactNode } from 'react'
import styles from './IconButton.module.css'

export interface IconButtonProps {
	children: ReactNode
	ariaLabel: string
	title?: string
	size?: 'md' | 'sm'
	className?: string
	onClick?: () => void
}

export function IconButton({ children, ariaLabel, title, size = 'md', className, onClick }: IconButtonProps) {
	const sizeClass = size === 'sm' ? styles.buttonSmall : styles.button
	const classes = ['icon-button', sizeClass, className].filter(Boolean).join(' ')

	return (
		<button className={classes} aria-label={ariaLabel} title={title ?? ariaLabel} onClick={onClick} type="button">
			{children}
		</button>
	)
}


