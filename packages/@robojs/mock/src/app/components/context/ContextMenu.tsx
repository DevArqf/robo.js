import { useEffect, useRef, useState } from 'react'
import type { StageApplicationCommand, StageMessage, StageUser } from '../../types/stage'
import styles from './ContextMenu.module.css'

interface ContextMenuProps {
	type: 'user' | 'message'
	targetId: string
	targetData: StageMessage | StageUser
	position: { x: number; y: number }
	commands: StageApplicationCommand[]
	onClose: () => void
	onCommandClick: (command: StageApplicationCommand) => Promise<void>
}

export function ContextMenu({
	type,
	targetId,
	targetData,
	position,
	commands,
	onClose,
	onCommandClick
}: ContextMenuProps) {
	const menuRef = useRef<HTMLDivElement>(null)
	const [adjustedPosition, setAdjustedPosition] = useState(position)
	const [isPositioned, setIsPositioned] = useState(false)

	// Filter commands by type (2 = USER, 3 = MESSAGE)
	const contextCommands = commands.filter((cmd) => (type === 'user' ? cmd.type === 2 : cmd.type === 3))

	// Close on click outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				onClose()
			}
		}

		// Delay to prevent immediate close from the same click
		const timer = setTimeout(() => {
			document.addEventListener('mousedown', handleClickOutside)
		}, 0)

		return () => {
			clearTimeout(timer)
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [onClose])

	// Close on Escape
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose()
			}
		}

		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [onClose])

	// Adjust position to keep menu in viewport (runs after first render when we know the size)
	useEffect(() => {
		if (!menuRef.current) return

		const menu = menuRef.current
		const rect = menu.getBoundingClientRect()
		const viewportWidth = window.innerWidth
		const viewportHeight = window.innerHeight

		let { x, y } = position

		// Adjust horizontal position if menu would overflow right
		if (x + rect.width > viewportWidth - 8) {
			x = viewportWidth - rect.width - 8
		}

		// Adjust vertical position if menu would overflow bottom
		if (y + rect.height > viewportHeight - 8) {
			y = viewportHeight - rect.height - 8
		}

		// Ensure minimum position
		x = Math.max(8, x)
		y = Math.max(8, y)

		setAdjustedPosition({ x, y })
		setIsPositioned(true)
	}, [position.x, position.y])

	const handleCommandClick = async (command: StageApplicationCommand) => {
		onClose()
		await onCommandClick(command)
	}

	const handleCopyId = () => {
		navigator.clipboard.writeText(targetId)
		onClose()
	}

	const handleCopyText = () => {
		if (type === 'message') {
			const message = targetData as StageMessage
			navigator.clipboard.writeText(message.content)
		}
		onClose()
	}

	return (
		<div
			ref={menuRef}
			className={styles.menu}
			style={{
				top: adjustedPosition.y,
				left: adjustedPosition.x,
				visibility: isPositioned ? 'visible' : 'hidden'
			}}
			role="menu"
		>
			{/* App commands section */}
			{contextCommands.length > 0 && (
				<>
					<div className={styles.header}>Apps</div>
					{contextCommands.map((cmd) => (
						<button
							key={cmd.id}
							className={styles.item}
							onClick={() => handleCommandClick(cmd)}
							role="menuitem"
						>
							<span className={styles.itemIcon}>
								<CommandIcon />
							</span>
							<span className={styles.itemLabel}>{cmd.name}</span>
						</button>
					))}
					<div className={styles.separator} />
				</>
			)}

			{/* Standard Discord actions */}
			{type === 'message' && (
				<>
					<button className={styles.item} onClick={handleCopyText} role="menuitem">
						<span className={styles.itemIcon}>
							<CopyIcon />
						</span>
						<span className={styles.itemLabel}>Copy Text</span>
					</button>
					<button className={styles.item} onClick={handleCopyId} role="menuitem">
						<span className={styles.itemIcon}>
							<IdIcon />
						</span>
						<span className={styles.itemLabel}>Copy Message ID</span>
					</button>
				</>
			)}

			{type === 'user' && (
				<>
					<button className={styles.item} onClick={handleCopyId} role="menuitem">
						<span className={styles.itemIcon}>
							<IdIcon />
						</span>
						<span className={styles.itemLabel}>Copy User ID</span>
					</button>
				</>
			)}
		</div>
	)
}

// Simple icons
function CommandIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
			<path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zm0 9h7v7h-7v-7zm-9 0h7v7H4v-7z" opacity="0.6" />
		</svg>
	)
}

function CopyIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
			<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
		</svg>
	)
}

function IdIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
			<path d="M14.5 3H9.5C6.46 3 4 5.46 4 8.5V15.5C4 18.54 6.46 21 9.5 21H14.5C17.54 21 20 18.54 20 15.5V8.5C20 5.46 17.54 3 14.5 3ZM8 8H10V16H8V8ZM16 16H12V14H16V16ZM16 12H12V10H16V12Z" />
		</svg>
	)
}
