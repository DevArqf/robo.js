import { useState, useRef } from 'react'
import { EmojiPicker } from '../common/EmojiPicker'
import styles from './MessageInput.module.css'

interface MessageInputProps {
	channelId: string
	channelName: string
}

export function MessageInput({ channelId, channelName }: MessageInputProps) {
	const [showEmojiPicker, setShowEmojiPicker] = useState(false)
	const inputRef = useRef<HTMLDivElement>(null)

	return (
		<form className={styles.form}>
			<div>
				<div className={styles.container}>
					<div className={styles.channelTextArea}>
						<div className={styles.inputWrapper}>
							<div className={styles.inner}>
								<div className={styles.uploadInput}>
									<input
										className="file-input"
										tabIndex={-1}
										multiple
										accept=""
										aria-hidden="true"
										type="file"
									/>
								</div>
								<div className={styles.attachWrapper}>
									<div
										className={styles.attachButton}
										aria-label="Upload a file"
										role="button"
										tabIndex={0}
									>
										<div className={styles.attachButtonInner}>
											<svg aria-hidden="true" role="img" width="24" height="24" viewBox="0 0 24 24">
												<path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
											</svg>
										</div>
									</div>
								</div>
								<div className={styles.textAreaContainer}>
									<div>
										<div className={styles.placeholder} aria-hidden="true">
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
											contentEditable="true"
											suppressContentEditableWarning={true}
											ref={inputRef}
										/>
									</div>
								</div>
								<div className={styles.buttons}>
									<div className={styles.iconButton} aria-label="Send a gift" role="button" tabIndex={0}>
										<div className={styles.iconButtonInner}>
											<svg aria-hidden="true" role="img" width="24" height="24" viewBox="0 0 24 24">
												<path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M3 7c0-1.657 1.343-3 3-3h.649c1.076 0 2.05.493 2.68 1.342.146.197.353.303.541.278.502-.066 1.353-.257 1.63-.314a.501.501 0 0 1 .59.61c-.13.393-.318.887-.492 1.089H3V7Zm14.351-3H18c1.657 0 3 1.343 3 3v.005h-8.4c-.175-.202-.363-.696-.493-1.089a.501.501 0 0 1 .59-.61c.277.057 1.128.248 1.63.314.188.025.395-.08.541-.278A3.33 3.33 0 0 1 17.351 4ZM10 9H2v5h8V9Zm2 0v5h10V9H12ZM2 16v4c0 1.1.9 2 2 2h6v-6H2Zm12 0v6h6c1.1 0 2-.9 2-2v-4h-8Z" />
											</svg>
										</div>
									</div>

									<div className={styles.iconButton} aria-label="Open GIF picker" role="button" tabIndex={0}>
										<div className={styles.iconButtonInner}>
											<svg aria-hidden="true" role="img" width="24" height="24" viewBox="0 0 24 24">
												<path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M2 5c0-1.657 1.343-3 3-3h14c1.657 0 3 1.343 3 3v14c0 1.657-1.343 3-3 3H5c-1.657 0-3-1.343-3-3V5Zm3-1h14c1.105 0 2 .895 2 2v14c0 1.105-.895 2-2 2H5c-1.105 0-2-.895-2-2V5c0-1.105.895-2 2-2Zm6.5 4H6v8h2.5v-2.5h1V12h-1v-1h.5v1H10V9H7.5v1.5h1.5v4H7V10h1.5V8Zm2 0h1v8h-1V8Zm6 0h-3v8h1v-3.5h1.5v-1h-1.5V9h2V8Z" />
											</svg>
										</div>
									</div>

									<div className={styles.iconButton} aria-label="Open sticker picker" role="button" tabIndex={0}>
										<div className={styles.iconButtonInner}>
											<svg aria-hidden="true" role="img" width="24" height="24" viewBox="0 0 24 24">
												<path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M2 5.5C2 3.567 3.567 2 5.5 2h13C20.433 2 22 3.567 22 5.5v13c0 1.933-1.567 3.5-3.5 3.5h-13C3.567 22 2 20.433 2 18.5v-13ZM18.5 4H5.5C4.672 4 4 4.672 4 5.5v13c0 .828.672 1.5 1.5 1.5h4.25V15.75c0-1.657 1.343-3 3-3H12.75c1.657 0 3 1.343 3 3v4.25H18.5c.828 0 1.5-.672 1.5-1.5v-13c0-.828-.672-1.5-1.5-1.5Zm-4.75 16h5L13.75 20Zm0-1.5h3.5c.276 0 .5-.224.5-.5v-3.5l-4 4Z" />
											</svg>
										</div>
									</div>

									<div className={styles.iconButton} aria-label="Add Emoji" role="button" tabIndex={0}>
										<div className={styles.iconButtonInner}>
											<svg aria-hidden="true" role="img" width="24" height="24" viewBox="0 0 24 24">
												<path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8Zm-3.54-9.54a1.21 1.21 0 0 0-1.21-1.21c-.66 0-1.21.55-1.21 1.21 0 .66.55 1.21 1.21 1.21.66 0 1.21-.55 1.21-1.21Zm7.08 0c0-.66-.55-1.21-1.21-1.21-.66 0-1.21.55-1.21 1.21 0 .66.55 1.21 1.21 1.21.66 0 1.21-.55 1.21-1.21Zm-3.54 7a4.978 4.978 0 0 0 4-2H8c.7 1.19 1.96 2 3.46 2Z" />
											</svg>
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
