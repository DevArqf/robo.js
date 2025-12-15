import { useState, useRef } from 'react'
import { useSession } from '../../hooks/useSession'
import styles from './MessageInput.module.css'
import GiftIcon from '../icons/gift'
import GifIcon from '../icons/gif'
import EmojiIcon from '../icons/emoji'
import FileIcon from '../icons/file'

interface MessageInputProps {
	channelId: string
	channelName: string
}

export function MessageInput({ channelId, channelName }: MessageInputProps) {
	const { sendMessage, replyingTo, clearReplyingTo } = useSession()
	const [inputValue, setInputValue] = useState('')
	const [isSending, setIsSending] = useState(false)
	const inputRef = useRef<HTMLDivElement>(null)

	// Handle input changes from contentEditable
	const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
		setInputValue(e.currentTarget.textContent || '')
	}

	// Handle message submission
	const handleSubmit = async () => {
		const content = inputValue.trim()
		if (!content || isSending) return

		setIsSending(true)
		try {
			const messageReference = replyingTo ? { message_id: replyingTo.id, channel_id: channelId } : undefined

			await sendMessage(content, channelId, messageReference)

			// Clear input and reply state
			setInputValue('')
			if (inputRef.current) inputRef.current.textContent = ''
			clearReplyingTo()
		} catch (err) {
			console.error('Failed to send message:', err)
		} finally {
			setIsSending(false)
		}
	}

	// Handle keyboard events - Enter to send, Shift+Enter for newline
	const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			handleSubmit()
		}
	}

	// Handle form submission
	const handleFormSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		handleSubmit()
	}

	return (
		<form className={styles.form} onSubmit={handleFormSubmit}>
			{/* Reply preview */}
			{replyingTo && (
				<div className={styles.replyPreview}>
					<div className={styles.replyContent}>
						<ReplyIcon />
						<span className={styles.replyText}>
							Replying to <strong>{replyingTo.author.username}</strong>
						</span>
					</div>
					<button type="button" className={styles.replyClose} onClick={clearReplyingTo}>
						<CloseIcon />
					</button>
				</div>
			)}
			<div>
				<div className={styles.container}>
					<div className={styles.channelTextArea}>
						<div className={styles.inputWrapper}>
							<div className={styles.inner}>
								<div className={styles.uploadInput}>
									<input className="file-input" tabIndex={-1} multiple accept="" aria-hidden="true" type="file" />
								</div>
								<div className={styles.attachWrapper}>
									<div className={styles.attachButton} aria-label="Upload a file" role="button" tabIndex={0}>
										<div className={styles.attachButtonInner}>
											<svg aria-hidden="true" role="img" width="24" height="24" viewBox="0 0 24 24">
												<path
													fill="currentColor"
													d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"
												/>
											</svg>
										</div>
									</div>
								</div>
								<div className={styles.textAreaContainer}>
									<div>
										<div
											className={styles.placeholder}
											aria-hidden="true"
											style={{ display: inputValue ? 'none' : undefined }}
										>
											Message #{channelName}
										</div>
										<div
											role="textbox"
											aria-multiline="true"
											spellCheck="true"
											aria-haspopup="listbox"
											aria-invalid="false"
											aria-autocomplete="list"
											className={styles.input}
											autoCorrect="off"
											data-can-focus="true"
											aria-label={`Message #${channelName}`}
											contentEditable={!isSending}
											suppressContentEditableWarning={true}
											ref={inputRef}
											onInput={handleInput}
											onKeyDown={handleKeyDown}
										/>
									</div>
								</div>
								<div className={styles.buttons}>
									<div className={styles.iconButton} aria-label="Send a gift" role="button" tabIndex={0}>
										<div className={styles.iconButtonInner}>
											<GiftIcon width={25} height={25} />
										</div>
									</div>

									<div className={styles.iconButton} aria-label="Open GIF picker" role="button" tabIndex={0}>
										<div className={styles.iconButtonInner}>
											<GifIcon />
										</div>
									</div>

									<div className={styles.iconButton} aria-label="Open sticker picker" role="button" tabIndex={0}>
										<div className={styles.iconButtonInner}>
											<FileIcon />
										</div>
									</div>

									<div className={styles.iconButton} aria-label="Add Emoji" role="button" tabIndex={0}>
										<div className={styles.iconButtonInner}>
											<EmojiIcon width={25} height={25} />
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</form>
	)
}

function ReplyIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
			<path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
		</svg>
	)
}

function CloseIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
			<path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z" />
		</svg>
	)
}
