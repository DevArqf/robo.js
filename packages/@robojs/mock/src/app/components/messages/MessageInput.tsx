import { useState, useRef, useCallback, type KeyboardEvent, type ChangeEvent } from 'react'
import { useSession } from '../../hooks/useSession'
import { CommandAutocomplete } from './CommandAutocomplete'
import type { StageApplicationCommand } from '../../types/stage'
import styles from './MessageInput.module.css'

interface MessageInputProps {
	channelId: string
	channelName: string
}

export function MessageInput({ channelId, channelName }: MessageInputProps) {
	const { sendMessage, invokeCommand, slashCommands } = useSession()
	const [value, setValue] = useState('')
	const [showCommands, setShowCommands] = useState(false)
	const [commandSearch, setCommandSearch] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const inputRef = useRef<HTMLTextAreaElement>(null)

	// Only show autocomplete when there are commands to show
	const showAutocomplete = showCommands && slashCommands.length > 0

	const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
		const newValue = e.target.value
		setValue(newValue)

		// Check for slash command trigger
		if (newValue.startsWith('/')) {
			setShowCommands(true)
			setCommandSearch(newValue.slice(1))
		} else {
			setShowCommands(false)
			setCommandSearch('')
		}
	}, [])

	const handleSendMessage = useCallback(async () => {
		const trimmed = value.trim()
		if (!trimmed || isLoading) return

		setIsLoading(true)
		try {
			await sendMessage(trimmed, channelId)
			setValue('')
		} catch (err) {
			console.error('Failed to send message:', err)
		} finally {
			setIsLoading(false)
		}
	}, [value, channelId, sendMessage, isLoading])

	const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
		// Only let CommandAutocomplete handle keyboard when it's actually rendered
		if (showAutocomplete) {
			if (e.key === 'Escape') {
				e.preventDefault()
				setShowCommands(false)
				setValue('')
				return
			}
			// Arrow keys, Enter, and Tab are handled by CommandAutocomplete
			if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Tab') {
				return
			}
		}

		// Close command mode on Escape even when no commands shown
		if (showCommands && e.key === 'Escape') {
			e.preventDefault()
			setShowCommands(false)
			setValue('')
			return
		}

		// Send message on Enter (without shift)
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			handleSendMessage()
		}
	}, [showCommands, showAutocomplete, handleSendMessage])

	const handleCommandSelect = useCallback(async (command: StageApplicationCommand, options: Record<string, unknown>) => {
		setShowCommands(false)
		setValue('')
		setIsLoading(true)

		try {
			await invokeCommand(command.name, options, channelId)
		} catch (err) {
			console.error('Failed to invoke command:', err)
		} finally {
			setIsLoading(false)
		}
	}, [channelId, invokeCommand])

	const handleCloseAutocomplete = useCallback(() => {
		setShowCommands(false)
	}, [])

	return (
		<div className={styles.container}>
			{showCommands && slashCommands.length > 0 && (
				<CommandAutocomplete
					search={commandSearch}
					commands={slashCommands}
					onSelect={handleCommandSelect}
					onClose={handleCloseAutocomplete}
				/>
			)}

			<div className={styles.inputWrapper}>
				<button className={styles.attachButton} type="button" aria-label="Add attachment">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
						<path d="M12 2.00098C6.486 2.00098 2 6.48698 2 12.001C2 17.515 6.486 22.001 12 22.001C17.514 22.001 22 17.515 22 12.001C22 6.48698 17.514 2.00098 12 2.00098ZM17 13.001H13V17.001H11V13.001H7V11.001H11V7.00098H13V11.001H17V13.001Z" />
					</svg>
				</button>

				<textarea
					ref={inputRef}
					className={styles.input}
					value={value}
					onChange={handleChange}
					onKeyDown={handleKeyDown}
					placeholder={`Message #${channelName}`}
					rows={1}
					disabled={isLoading}
					aria-label={`Message #${channelName}`}
				/>

				<div className={styles.buttons}>
					<button className={styles.iconButton} type="button" aria-label="Send a gift">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
							<path d="M21.2 8H18.6C19 7.5 19.2 6.8 19.2 6.1C19.2 4.4 17.8 3 16.1 3C14.8 3 13.6 3.7 13 4.9L12 6.4L11 4.9C10.4 3.7 9.2 3 7.9 3C6.2 3 4.8 4.4 4.8 6.1C4.8 6.8 5 7.5 5.4 8H2.8C2.4 8 2 8.4 2 8.8V11.2C2 11.6 2.4 12 2.8 12H11V8.6L12 8.1L13 8.6V12H21.2C21.6 12 22 11.6 22 11.2V8.8C22 8.4 21.6 8 21.2 8Z" />
							<path d="M11 20V13H3V20C3 20.6 3.4 21 4 21H11V20ZM21 13H13V21H20C20.6 21 21 20.6 21 20V13Z" />
						</svg>
					</button>
					<button className={styles.iconButton} type="button" aria-label="Select GIF">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
							<path d="M2 5.5C2 4.1 3.1 3 4.5 3H19.5C20.9 3 22 4.1 22 5.5V18.5C22 19.9 20.9 21 19.5 21H4.5C3.1 21 2 19.9 2 18.5V5.5ZM10.7 8C10.2 8 9.8 8.2 9.5 8.5C9.2 8.8 9 9.3 9 9.9V14.1C9 14.7 9.2 15.2 9.5 15.5C9.8 15.8 10.2 16 10.7 16H12.8C13.3 16 13.7 15.8 14 15.5C14.3 15.2 14.5 14.7 14.5 14.1V13.5H12.9V14.1C12.9 14.2 12.9 14.3 12.8 14.4C12.7 14.5 12.6 14.5 12.4 14.5H11.1C11 14.5 10.9 14.5 10.8 14.4C10.7 14.3 10.6 14.2 10.6 14.1V9.9C10.6 9.8 10.6 9.7 10.7 9.6C10.8 9.5 10.9 9.5 11.1 9.5H12.4C12.5 9.5 12.6 9.5 12.7 9.6C12.8 9.7 12.9 9.8 12.9 9.9V10.5H14.5V9.9C14.5 9.3 14.3 8.8 14 8.5C13.7 8.2 13.3 8 12.8 8H10.7ZM6 8.1V15.9H7.6V8.1H6ZM16 8.1V15.9H17.6V12.4H19.4V11H17.6V9.5H19.9V8.1H16Z" />
						</svg>
					</button>
					<button className={styles.iconButton} type="button" aria-label="Select sticker">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
							<path d="M12.0002 0.00195312C5.37264 0.00195312 0.00195312 5.3727 0.00195312 12.0002C0.00195312 18.6277 5.37264 24.0015 12.0002 24.0015C18.6277 24.0015 24.0015 18.6277 24.0015 12.0002C24.0015 5.3727 18.6277 0.00195312 12.0002 0.00195312ZM8.00164 14.9997C7.44797 14.9997 7.00168 14.5534 7.00168 13.9997V10.0003C7.00168 9.44656 7.44797 9.00028 8.00164 9.00028C8.55531 9.00028 9.00159 9.44656 9.00159 10.0003V13.9997C9.00159 14.5534 8.55531 14.9997 8.00164 14.9997ZM11.0015 18.0011C10.4478 18.0011 10.0015 17.5548 10.0015 17.0012V7.00188C10.0015 6.44821 10.4478 6.00193 11.0015 6.00193C11.5551 6.00193 12.0014 6.44821 12.0014 7.00188V17.0012C12.0014 17.5548 11.5551 18.0011 11.0015 18.0011ZM14.0013 14.9997C13.4476 14.9997 13.0014 14.5534 13.0014 13.9997V10.0003C13.0014 9.44656 13.4476 9.00028 14.0013 9.00028C14.555 9.00028 15.0013 9.44656 15.0013 10.0003V13.9997C15.0013 14.5534 14.555 14.9997 14.0013 14.9997ZM17.0012 14.9997C16.4475 14.9997 16.0012 14.5534 16.0012 13.9997V10.0003C16.0012 9.44656 16.4475 9.00028 17.0012 9.00028C17.5548 9.00028 18.0011 9.44656 18.0011 10.0003V13.9997C18.0011 14.5534 17.5548 14.9997 17.0012 14.9997Z" />
						</svg>
					</button>
					<button className={styles.iconButton} type="button" aria-label="Select emoji">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
							<path d="M12 2C6.486 2 2 6.487 2 12C2 17.515 6.486 22 12 22C17.514 22 22 17.515 22 12C22 6.487 17.514 2 12 2ZM12 20C7.589 20 4 16.411 4 12C4 7.589 7.589 4 12 4C16.411 4 20 7.589 20 12C20 16.411 16.411 20 12 20Z" />
							<path d="M14.5 11C15.3284 11 16 10.3284 16 9.5C16 8.67157 15.3284 8 14.5 8C13.6716 8 13 8.67157 13 9.5C13 10.3284 13.6716 11 14.5 11Z" />
							<path d="M9.5 11C10.3284 11 11 10.3284 11 9.5C11 8.67157 10.3284 8 9.5 8C8.67157 8 8 8.67157 8 9.5C8 10.3284 8.67157 11 9.5 11Z" />
							<path d="M12 18C14.28 18 16.22 16.34 17 14H7C7.78 16.34 9.72 18 12 18Z" />
						</svg>
					</button>
				</div>
			</div>
		</div>
	)
}
