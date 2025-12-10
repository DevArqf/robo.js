import { useRef, useEffect, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useSession } from '../../hooks/useSession'
import { Message } from './Message'
import { MessageInput } from './MessageInput'
import { TypingIndicator } from './TypingIndicator'
import type { StageMessage } from '../../types/stage'
import styles from './MessageArea.module.css'

interface MessageAreaProps {
	channelId: string | null
}

interface MessageGroup {
	message: StageMessage
	isFirstInGroup: boolean
	isHighlighted: boolean
}

export function MessageArea({ channelId }: MessageAreaProps) {
	const { channelMessages, channelTypingUsers, selectedChannel, clickButton, selectOption } = useSession()
	const containerRef = useRef<HTMLDivElement>(null)
	const prevMessageCountRef = useRef(0)

	// Group consecutive messages from same author
	const groupedMessages = useMemo(() => groupMessages(channelMessages), [channelMessages])

	// Virtual scrolling for performance
	const virtualizer = useVirtualizer({
		count: groupedMessages.length,
		getScrollElement: () => containerRef.current,
		estimateSize: (index) => {
			const group = groupedMessages[index]
			const message = group.message
			// Estimate: header (if first in group) + content lines + embeds + attachments
			const hasHeader = group.isFirstInGroup
			const lineCount = Math.ceil((message.content?.length || 0) / 80) || 1

			// Better embed height estimation
			let embedHeight = 0
			if (message.embeds?.length) {
				for (const embed of message.embeds as Array<{ image?: unknown; fields?: unknown[] }>) {
					// Base embed: padding + author + title + description
					embedHeight += 120
					// Fields add height
					if (embed.fields?.length) {
						embedHeight += Math.ceil(embed.fields.length / 3) * 50
					}
					// Image adds significant height
					if (embed.image) {
						embedHeight += 320
					}
				}
			}

			// Better attachment height estimation
			let attachmentHeight = 0
			if (message.attachments?.length) {
				for (const att of message.attachments as Array<{ content_type?: string; height?: number }>) {
					if (att.content_type?.startsWith('image/')) {
						// Image: constrained to max 300px height + margin
						attachmentHeight += Math.min(att.height || 200, 300) + 16
					} else if (att.content_type?.startsWith('video/')) {
						attachmentHeight += 320
					} else {
						// File attachment card
						attachmentHeight += 72
					}
				}
			}

			// Component height estimation (buttons, selects)
			let componentHeight = 0
			if (message.components?.length) {
				// Each action row is about 40px (button/select height + gap)
				componentHeight = message.components.length * 44
			}

			return (hasHeader ? 44 : 0) + lineCount * 22 + embedHeight + attachmentHeight + componentHeight + 16
		},
		overscan: 10
	})

	// Auto-scroll to bottom on new messages
	useEffect(() => {
		if (channelMessages.length > prevMessageCountRef.current && containerRef.current) {
			containerRef.current.scrollTop = containerRef.current.scrollHeight
		}
		prevMessageCountRef.current = channelMessages.length
	}, [channelMessages.length])

	// Scroll to bottom when channel changes
	useEffect(() => {
		if (containerRef.current) {
			containerRef.current.scrollTop = containerRef.current.scrollHeight
		}
	}, [channelId])

	if (!channelId || !selectedChannel) {
		return (
			<div className={styles.container}>
				<div className={styles.empty}>
					<div className={styles.emptyIcon}>
						<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
							<path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657ZM9.41045 9L8.35045 15H14.3504L15.4104 9H9.41045Z" />
						</svg>
					</div>
					<h3 className={styles.emptyTitle}>Select a channel</h3>
					<p className={styles.emptyDescription}>Choose a channel from the sidebar to start viewing messages</p>
				</div>
			</div>
		)
	}

	return (
		<div className={styles.container}>
			<div className={styles.messages} ref={containerRef}>
				{channelMessages.length === 0 ? (
					<div className={styles.welcome}>
						<div className={styles.welcomeIcon}>
							<span className={styles.hash}>#</span>
						</div>
						<h2 className={styles.welcomeTitle}>Welcome to #{selectedChannel.name}!</h2>
						<p className={styles.welcomeDescription}>This is the start of the #{selectedChannel.name} channel.</p>
					</div>
				) : (
					<div
						className={styles.virtualContainer}
						style={{
							height: virtualizer.getTotalSize(),
							position: 'relative'
						}}
					>
						{virtualizer.getVirtualItems().map((virtualItem) => {
							const group = groupedMessages[virtualItem.index]
							return (
								<div
									key={group.message.id}
									style={{
										position: 'absolute',
										top: virtualItem.start,
										left: 0,
										right: 0
									}}
								>
									<Message
										message={group.message}
										isFirstInGroup={group.isFirstInGroup}
										isHighlighted={group.isHighlighted}
										onButtonClick={clickButton}
										onSelectOption={selectOption}
									/>
								</div>
							)
						})}
					</div>
				)}
			</div>

			{/* Typing indicator */}
			<TypingIndicator typingUsers={channelTypingUsers} />

			{/* Message input */}
			<MessageInput channelId={selectedChannel.id} channelName={selectedChannel.name} />
		</div>
	)
}

/**
 * Group consecutive messages from the same author within 5 minutes
 */
function groupMessages(messages: StageMessage[]): MessageGroup[] {
	return messages.map((message, index) => {
		const prevMessage = messages[index - 1]
		const isFirstInGroup =
			!prevMessage ||
			prevMessage.author.id !== message.author.id ||
			new Date(message.timestamp).getTime() - new Date(prevMessage.timestamp).getTime() > 5 * 60 * 1000

		return {
			message,
			isFirstInGroup,
			isHighlighted: false // Set when interaction response (can be extended later)
		}
	})
}
