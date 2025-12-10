import { useState, useRef, useEffect } from 'react'
import styles from './SelectMenu.module.css'

// Discord select menu component types
const ComponentType = {
	StringSelect: 3,
	UserSelect: 5,
	RoleSelect: 6,
	MentionableSelect: 7,
	ChannelSelect: 8
} as const

interface SelectEmoji {
	id?: string | null
	name?: string | null
	animated?: boolean
}

interface SelectOption {
	label: string
	value: string
	description?: string
	emoji?: SelectEmoji
	default?: boolean
}

interface SelectMenuComponentData {
	type: 3 | 5 | 6 | 7 | 8
	custom_id: string
	options?: SelectOption[]
	placeholder?: string
	min_values?: number
	max_values?: number
	disabled?: boolean
}

interface SelectMenuProps {
	select: SelectMenuComponentData
	onSelect: (values: string[]) => Promise<void>
}

function getEmojiUrl(emoji: SelectEmoji): string {
	if (!emoji.id) return ''
	const ext = emoji.animated ? 'gif' : 'png'
	return `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}`
}

export function SelectMenu({ select, onSelect }: SelectMenuProps) {
	const [isOpen, setIsOpen] = useState(false)
	const [selected, setSelected] = useState<string[]>(() => {
		// Initialize with default options
		return select.options?.filter((o) => o.default).map((o) => o.value) || []
	})
	const [isLoading, setIsLoading] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	const minValues = select.min_values ?? 1
	const maxValues = select.max_values ?? 1
	const isSingleSelect = maxValues === 1

	// Close on click outside
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (!containerRef.current?.contains(e.target as Node)) {
				setIsOpen(false)
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [])

	// Close on escape key
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setIsOpen(false)
			}
		}
		if (isOpen) {
			document.addEventListener('keydown', handler)
			return () => document.removeEventListener('keydown', handler)
		}
	}, [isOpen])

	const handleSelect = async (value: string) => {
		if (select.disabled || isLoading) return

		let newSelected: string[]

		if (isSingleSelect) {
			newSelected = [value]
		} else {
			if (selected.includes(value)) {
				newSelected = selected.filter((v) => v !== value)
			} else if (selected.length < maxValues) {
				newSelected = [...selected, value]
			} else {
				return // Can't select more
			}
		}

		setSelected(newSelected)

		// Submit if single-select or reached min threshold
		if (isSingleSelect || newSelected.length >= minValues) {
			setIsOpen(false)
			setIsLoading(true)
			try {
				await onSelect(newSelected)
			} finally {
				setIsLoading(false)
				// Reset selection after submission for single-select
				if (isSingleSelect) {
					setSelected([])
				}
			}
		}
	}

	// Get placeholder based on select type
	const getPlaceholder = (): string => {
		if (select.placeholder) return select.placeholder

		switch (select.type) {
			case ComponentType.UserSelect:
				return 'Select a user'
			case ComponentType.RoleSelect:
				return 'Select a role'
			case ComponentType.ChannelSelect:
				return 'Select a channel'
			case ComponentType.MentionableSelect:
				return 'Select a user or role'
			default:
				return 'Make a selection'
		}
	}

	// For entity selects without options, show placeholder
	const options = select.options || []
	const hasOptions = options.length > 0

	// Get display text for trigger
	const getDisplayText = (): string => {
		if (selected.length === 0) return getPlaceholder()

		const selectedOptions = options.filter((o) => selected.includes(o.value))
		return selectedOptions.map((o) => o.label).join(', ')
	}

	const triggerClasses = [
		styles.trigger,
		select.disabled ? styles.disabled : '',
		isOpen ? styles.open : '',
		isLoading ? styles.loading : ''
	].filter(Boolean).join(' ')

	return (
		<div className={styles.container} ref={containerRef}>
			<div
				className={triggerClasses}
				onClick={() => !select.disabled && !isLoading && hasOptions && setIsOpen(!isOpen)}
				role="button"
				tabIndex={select.disabled ? -1 : 0}
				aria-haspopup="listbox"
				aria-expanded={isOpen}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault()
						if (!select.disabled && !isLoading && hasOptions) {
							setIsOpen(!isOpen)
						}
					}
				}}
			>
				<span className={selected.length > 0 ? styles.selectedText : styles.placeholder}>
					{getDisplayText()}
				</span>
				<ChevronIcon className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} />
			</div>

			{isOpen && hasOptions && (
				<div className={styles.dropdown} role="listbox">
					{options.map((option) => {
						const isSelected = selected.includes(option.value)
						const optionClasses = [styles.option, isSelected ? styles.optionSelected : ''].filter(Boolean).join(' ')

						return (
							<div
								key={option.value}
								className={optionClasses}
								onClick={() => handleSelect(option.value)}
								role="option"
								aria-selected={isSelected}
							>
								{option.emoji && (
									<span className={styles.optionEmoji}>
										{option.emoji.id ? (
											<img src={getEmojiUrl(option.emoji)} alt="" className={styles.emojiImage} />
										) : (
											option.emoji.name
										)}
									</span>
								)}
								<div className={styles.optionContent}>
									<div className={styles.optionLabel}>{option.label}</div>
									{option.description && <div className={styles.optionDescription}>{option.description}</div>}
								</div>
								{isSelected && <CheckIcon className={styles.optionCheck} />}
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
}

// SVG Icons
function ChevronIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" width="20" height="20">
			<path fill="currentColor" d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z" />
		</svg>
	)
}

function CheckIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" width="20" height="20">
			<path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
		</svg>
	)
}

export { ComponentType }
export type { SelectMenuComponentData, SelectOption, SelectEmoji }
