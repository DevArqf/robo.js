import { useEffect } from 'react'
import './GameMenu.css'

interface GameMenuProps {
	isOpen: boolean
	onClose: () => void
	onCharacterSelect: () => void
	onMainMenu: () => void
	onInfo: () => void
}

export function GameMenu({ isOpen, onClose, onCharacterSelect, onMainMenu, onInfo }: GameMenuProps) {
	// Handle Escape key
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose()
			}
		}

		if (isOpen) {
			window.addEventListener('keydown', handleKeyDown)
			return () => window.removeEventListener('keydown', handleKeyDown)
		}
	}, [isOpen, onClose])

	if (!isOpen) return null

	return (
		<div className="game-menu-overlay" onClick={onClose}>
			<div className="game-menu-panel" onClick={(e) => e.stopPropagation()}>
				<h2 className="game-menu-title">PAUSED</h2>
				<div className="game-menu-buttons">
					<button className="game-menu-btn" onClick={onClose}>
						Resume
					</button>
					<button className="game-menu-btn" onClick={onCharacterSelect}>
						Character
					</button>
					<button className="game-menu-btn" onClick={onMainMenu}>
						Main Menu
					</button>
					<button className="game-menu-btn" onClick={onInfo}>
						Information
					</button>
				</div>
			</div>
		</div>
	)
}

interface MenuButtonProps {
	onClick: () => void
}

export function MenuButton({ onClick }: MenuButtonProps) {
	return (
		<button className="menu-toggle-btn" onClick={onClick} title="Menu (Esc)">
			<span className="menu-icon">&#9776;</span>
		</button>
	)
}
