import { useState } from 'react'
import styles from './Button.module.css'

// Discord button styles
const ButtonStyle = {
	Primary: 1,
	Secondary: 2,
	Success: 3,
	Danger: 4,
	Link: 5
} as const

interface ButtonEmoji {
	id?: string | null
	name?: string | null
	animated?: boolean
}

interface ButtonComponentData {
	type: 2
	style: number
	label?: string
	emoji?: ButtonEmoji
	custom_id?: string
	url?: string
	disabled?: boolean
}

interface ButtonProps {
	button: ButtonComponentData
	onClick: () => Promise<void>
}

function getEmojiUrl(emoji: ButtonEmoji): string {
	if (!emoji.id) return ''
	const ext = emoji.animated ? 'gif' : 'png'
	return `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}`
}

export function Button({ button, onClick }: ButtonProps) {
	const [isLoading, setIsLoading] = useState(false)

	const handleClick = async () => {
		if (button.disabled || isLoading) return

		// Link buttons open URL in new tab
		if (button.style === ButtonStyle.Link && button.url) {
			window.open(button.url, '_blank', 'noopener,noreferrer')
			return
		}

		setIsLoading(true)
		try {
			await onClick()
		} finally {
			setIsLoading(false)
		}
	}

	const styleClass = {
		[ButtonStyle.Primary]: styles.primary,
		[ButtonStyle.Secondary]: styles.secondary,
		[ButtonStyle.Success]: styles.success,
		[ButtonStyle.Danger]: styles.danger,
		[ButtonStyle.Link]: styles.link
	}[button.style] || styles.secondary

	const classNames = [
		styles.button,
		styleClass,
		button.disabled ? styles.disabled : '',
		isLoading ? styles.loading : ''
	].filter(Boolean).join(' ')

	return (
		<button
			className={classNames}
			onClick={handleClick}
			disabled={button.disabled || isLoading}
			type="button"
		>
			{button.emoji && (
				<span className={styles.emoji}>
					{button.emoji.id ? (
						<img src={getEmojiUrl(button.emoji)} alt="" className={styles.emojiImage} />
					) : (
						button.emoji.name
					)}
				</span>
			)}
			{button.label && <span className={styles.label}>{button.label}</span>}
			{button.style === ButtonStyle.Link && (
				<svg className={styles.linkIcon} viewBox="0 0 24 24" width="16" height="16">
					<path
						fill="currentColor"
						d="M10 5V3H5.375C4.06519 3 3 4.06519 3 5.375V18.625C3 19.936 4.06519 21 5.375 21H18.625C19.936 21 21 19.936 21 18.625V14H19V19H5V5H10Z"
					/>
					<path fill="currentColor" d="M21 2.99902H14V4.99902H17.586L9.29297 13.292L10.707 14.706L19 6.41302V9.99902H21V2.99902Z" />
				</svg>
			)}
			{isLoading && (
				<span className={styles.spinner}>
					<svg viewBox="0 0 24 24" width="16" height="16">
						<circle
							cx="12"
							cy="12"
							r="10"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeDasharray="31.4 31.4"
							strokeLinecap="round"
						/>
					</svg>
				</span>
			)}
		</button>
	)
}

export { ButtonStyle }
export type { ButtonComponentData, ButtonEmoji }
