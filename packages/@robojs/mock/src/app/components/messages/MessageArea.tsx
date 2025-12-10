import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useSession } from '../../hooks/useSession'
import { usePlaybackMessages, useIsPlaybackMode, usePlayback, usePlaybackTypingUsers } from '../../stores/playbackStore'
import { useContextMenu } from '../../hooks/useContextMenu'
import { Message } from './Message'
import { MessageInput } from './MessageInput'
import { TypingIndicator } from './TypingIndicator'
import { ThinkingIndicator } from './ThinkingIndicator'
import { PendingMessage } from './PendingMessage'
import { ContextMenu } from '../context/ContextMenu'
import type { StageMessage, StageUser, StageApplicationCommand } from '../../types/stage'
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
	const {
		channelMessages,
		channelTypingUsers,
		channelPendingInteractions,
		channelPendingMessages,
		selectedChannel,
		clickButton,
		selectOption,
		addReaction,
		removeReaction,
		retryMessage,
		cancelMessage,
		commands,
		invokeContextCommand
	} = useSession()
	const { menu: contextMenu, showMenu: showContextMenu, hideMenu: hideContextMenu } = useContextMenu()
	const isPlaybackMode = useIsPlaybackMode()
	const playbackMessages = usePlaybackMessages(channelId)
	const playbackTypingUsers = usePlaybackTypingUsers(channelId)
	const playbackState = usePlayback()
	const containerRef = useRef<HTMLDivElement>(null)
	const prevMessageCountRef = useRef(0)
	const [isAtBottom, setIsAtBottom] = useState(true)

	// Use playback messages when in playback mode, otherwise use session messages
	const displayMessages = isPlaybackMode && playbackMessages !== null ? playbackMessages : channelMessages

	// Use playback typing users when in playback mode, otherwise use session typing users
	const displayTypingUsers = isPlaybackMode && playbackTypingUsers !== null ? playbackTypingUsers : channelTypingUsers

	// Track if user is at bottom of scroll container
	const handleScroll = useCallback(() => {
		if (!containerRef.current) return
		const { scrollTop, scrollHeight, clientHeight } = containerRef.current
		// Consider "at bottom" if within 50px of the bottom
		const atBottom = scrollHeight - scrollTop - clientHeight < 50
		setIsAtBottom(atBottom)
	}, [])

	// Group consecutive messages from same author
	const groupedMessages = useMemo(() => groupMessages(displayMessages), [displayMessages])

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

	// Auto-scroll to bottom on new messages (in both live and playback mode if at bottom)
	useEffect(() => {
		if (displayMessages.length > prevMessageCountRef.current && containerRef.current) {
			// In live mode, always scroll. In playback mode, only scroll if already at bottom
			if (!isPlaybackMode || isAtBottom) {
				containerRef.current.scrollTop = containerRef.current.scrollHeight
			}
		}
		prevMessageCountRef.current = displayMessages.length
	}, [displayMessages.length, isPlaybackMode, isAtBottom])

	// Scroll to bottom when channel changes
	useEffect(() => {
		if (containerRef.current) {
			containerRef.current.scrollTop = containerRef.current.scrollHeight
			setIsAtBottom(true)
		}
	}, [channelId])

	// Reset scroll position when entering playback mode
	useEffect(() => {
		if (isPlaybackMode && containerRef.current) {
			// Start playback from the top (beginning of history)
			containerRef.current.scrollTop = 0
			setIsAtBottom(false)
		}
	}, [isPlaybackMode])

	// Context menu handlers
	const handleMessageContextMenu = useCallback(
		(e: React.MouseEvent, message: StageMessage) => {
			e.preventDefault()
			showContextMenu('message', message.id, message, { x: e.clientX, y: e.clientY })
		},
		[showContextMenu]
	)

	const handleUserContextMenu = useCallback(
		(e: React.MouseEvent, user: StageUser) => {
			e.preventDefault()
			e.stopPropagation()
			showContextMenu('user', user.id, user, { x: e.clientX, y: e.clientY })
		},
		[showContextMenu]
	)

	const handleContextCommandClick = useCallback(
		async (command: StageApplicationCommand) => {
			if (!contextMenu) return

			const commandType = command.type as 2 | 3
			await invokeContextCommand(
				command.name,
				commandType,
				contextMenu.targetId,
				contextMenu.targetData
			)
		},
		[contextMenu, invokeContextCommand]
	)

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
			{/* Playback mode banner */}
			{isPlaybackMode && (
				<div className={styles.playbackBanner}>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
						<path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm0 14A6 6 0 1 1 8 2a6 6 0 0 1 0 12zm.5-9H7v5l4.25 2.5.75-1.23-3.5-2.08V5z" />
					</svg>
					<span>
						Playback Mode — Viewing {displayMessages.length} message{displayMessages.length !== 1 ? 's' : ''} at{' '}
						{formatPlaybackTime(playbackState.currentTime)}
					</span>
				</div>
			)}
			<div className={styles.messages} ref={containerRef} onScroll={handleScroll}>
				{displayMessages.length === 0 ? (
					<div className={styles.welcome}>
						<div className={styles.welcomeIcon}>
							<span className={styles.hash}>#</span>
						</div>
						<h2 className={styles.welcomeTitle}>Welcome to #{selectedChannel.name}!</h2>
						<p className={styles.welcomeDescription}>
							{selectedChannel.topic || `This is the start of the #${selectedChannel.name} channel.`}
						</p>
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
										onAddReaction={addReaction}
										onRemoveReaction={removeReaction}
										onContextMenu={handleMessageContextMenu}
										onUserContextMenu={handleUserContextMenu}
									/>
								</div>
							)
						})}
					</div>
				)}
			</div>

			{/* Pending messages (sending/failed) */}
			{channelPendingMessages.map((pending) => (
				<PendingMessage
					key={pending.id}
					message={pending}
					onRetry={retryMessage}
					onCancel={cancelMessage}
				/>
			))}

			{/* Thinking indicators for deferred bot responses */}
			{channelPendingInteractions.map((pending) => (
				<ThinkingIndicator
					key={pending.id}
					botName={pending.botName}
					botAvatar={pending.botAvatar}
					botId={pending.botId}
				/>
			))}

			{/* Typing indicator */}
			<TypingIndicator typingUsers={displayTypingUsers} />

			{/* Message input */}
			<MessageInput channelId={selectedChannel.id} channelName={selectedChannel.name} />

			{/* Context menu */}
			{contextMenu && (
				<ContextMenu
					type={contextMenu.type}
					targetId={contextMenu.targetId}
					targetData={contextMenu.targetData}
					position={contextMenu.position}
					commands={commands}
					onClose={hideContextMenu}
					onCommandClick={handleContextCommandClick}
				/>
			)}
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

/**
 * Format playback time as MM:SS
 */
function formatPlaybackTime(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000)
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
