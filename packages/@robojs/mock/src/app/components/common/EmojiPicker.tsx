import { useEffect, useRef } from 'react'
import styles from './EmojiPicker.module.css'

interface EmojiPickerProps {
	onSelect: (emoji: string) => void
	onClose: () => void
}

// Common emoji set for MVP
const EMOJI_LIST = [
	// Reactions
	'👍', '👎', '❤️', '🔥', '🎉',
	'😂', '😢', '😮', '😡', '🤔',
	// Common
	'👀', '💯', '✅', '❌', '⭐',
	'🙏', '💪', '🚀', '💡', '📌',
	// Faces
	'😊', '😎', '🤣', '😍', '🥳',
	'😴', '🤯', '🥺', '😤', '🤝'
]

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
	const pickerRef = useRef<HTMLDivElement>(null)

	// Close on click outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
				onClose()
			}
		}

		// Use capture phase to handle click before it bubbles
		document.addEventListener('mousedown', handleClickOutside, true)
		return () => document.removeEventListener('mousedown', handleClickOutside, true)
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

	return (
		<div ref={pickerRef} className={styles.picker} role="dialog" aria-label="Emoji picker">
			<div className={styles.grid}>
				{EMOJI_LIST.map((emoji) => (
					<button
						key={emoji}
						className={styles.emoji}
						onClick={() => onSelect(emoji)}
						title={emoji}
					>
						{emoji}
					</button>
				))}
			</div>
		</div>
	)
}
