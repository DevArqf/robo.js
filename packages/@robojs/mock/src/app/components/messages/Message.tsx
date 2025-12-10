import type { StageMessage, StageReaction, StageUser } from '../../types/stage'
import { formatTimestamp } from '../../utils/time'
import { getAvatarUrl } from '../../utils/avatar'
import { Markdown } from '../common/Markdown'
import { Embed } from './Embed'
import { Attachments } from './Attachments'
import { ComponentsContainer } from './ComponentRow'
import { Reactions } from './Reactions'
import { EphemeralBadge } from './EphemeralBadge'
import styles from './Message.module.css'

// Discord message flags
const MESSAGE_FLAGS = {
	EPHEMERAL: 64  // 1 << 6
}

interface MessageProps {
	message: StageMessage
	isFirstInGroup: boolean
	isHighlighted?: boolean
	onButtonClick?: (messageId: string, customId: string) => Promise<void>
	onSelectOption?: (messageId: string, customId: string, values: string[]) => Promise<void>
	onAddReaction?: (messageId: string, emoji: string) => Promise<void>
	onRemoveReaction?: (messageId: string, emoji: string) => Promise<void>
	onContextMenu?: (e: React.MouseEvent, message: StageMessage) => void
	onUserContextMenu?: (e: React.MouseEvent, user: StageUser) => void
}

export function Message({
	message,
	isFirstInGroup,
	isHighlighted,
	onButtonClick,
	onSelectOption,
	onAddReaction,
	onRemoveReaction,
	onContextMenu,
	onUserContextMenu
}: MessageProps) {
	const { author, content, timestamp, edited_timestamp, embeds, attachments, components, reactions, flags } = message
	const isEphemeral = ((flags ?? 0) & MESSAGE_FLAGS.EPHEMERAL) !== 0

	return (
		<div
			className={`${styles.message} ${isHighlighted ? styles.highlighted : ''} ${isEphemeral ? styles.ephemeral : ''}`}
			onContextMenu={onContextMenu ? (e) => onContextMenu(e, message) : undefined}
		>
			{isFirstInGroup ? (
				<>
					<div className={styles.avatar}>
						<img
							src={getAvatarUrl(author.id, author.avatar)}
							alt=""
							className={styles.avatarImage}
							onError={(e) => {
								// Fallback to default avatar on error
								const target = e.target as HTMLImageElement
								target.src = getAvatarUrl(author.id, null)
							}}
							onContextMenu={
								onUserContextMenu
									? (e) => {
											e.stopPropagation()
											onUserContextMenu(e, author)
										}
									: undefined
							}
						/>
					</div>
					<div className={styles.content}>
						<div className={styles.header}>
							<span
								className={styles.author}
								onContextMenu={
									onUserContextMenu
										? (e) => {
												e.stopPropagation()
												onUserContextMenu(e, author)
											}
										: undefined
								}
							>
								{author.username}
							</span>
							{author.bot && <span className={styles.botBadge}>BOT</span>}
							<span className={styles.timestamp}>{formatTimestamp(timestamp)}</span>
						</div>
						<MessageContent
							content={content}
							editedTimestamp={edited_timestamp}
							embeds={embeds}
							attachments={attachments}
							components={components}
							reactions={reactions}
							messageId={message.id}
							channelId={message.channel_id}
							isEphemeral={isEphemeral}
							onButtonClick={onButtonClick}
							onSelectOption={onSelectOption}
							onAddReaction={onAddReaction}
							onRemoveReaction={onRemoveReaction}
						/>
					</div>
				</>
			) : (
				<>
					<div className={styles.timestampGutter}>
						<span className={styles.hoverTimestamp}>{formatTimestamp(timestamp, 'short')}</span>
					</div>
					<div className={styles.content}>
						<MessageContent
							content={content}
							editedTimestamp={edited_timestamp}
							embeds={embeds}
							attachments={attachments}
							components={components}
							reactions={reactions}
							messageId={message.id}
							channelId={message.channel_id}
							isEphemeral={isEphemeral}
							onButtonClick={onButtonClick}
							onSelectOption={onSelectOption}
							onAddReaction={onAddReaction}
							onRemoveReaction={onRemoveReaction}
						/>
					</div>
				</>
			)}
		</div>
	)
}

interface MessageContentProps {
	content: string
	editedTimestamp?: string | null
	embeds?: unknown[]
	attachments?: unknown[]
	components?: unknown[]
	reactions?: StageReaction[]
	messageId: string
	channelId: string
	isEphemeral?: boolean
	onButtonClick?: (messageId: string, customId: string) => Promise<void>
	onSelectOption?: (messageId: string, customId: string, values: string[]) => Promise<void>
	onAddReaction?: (messageId: string, emoji: string) => Promise<void>
	onRemoveReaction?: (messageId: string, emoji: string) => Promise<void>
}

function MessageContent({
	content,
	editedTimestamp,
	embeds,
	attachments,
	components,
	reactions,
	messageId,
	channelId,
	isEphemeral,
	onButtonClick,
	onSelectOption,
	onAddReaction,
	onRemoveReaction
}: MessageContentProps) {
	// Type assertion for embeds and attachments - they come as unknown[] from StageMessage
	const typedEmbeds = embeds as Array<{
		color?: number
		author?: { name?: string; url?: string; icon_url?: string }
		title?: string
		url?: string
		description?: string
		fields?: Array<{ name: string; value: string; inline?: boolean }>
		image?: { url: string; width?: number; height?: number }
		thumbnail?: { url: string }
		video?: { url: string; width?: number; height?: number }
		footer?: { text: string; icon_url?: string }
		timestamp?: string
	}>

	const typedAttachments = attachments as Array<{
		id: string
		filename: string
		description?: string
		content_type?: string
		size: number
		url: string
		proxy_url?: string
		width?: number
		height?: number
		duration_secs?: number
		waveform?: string
		spoiler?: boolean
	}>

	return (
		<div className={styles.messageContent}>
			{content && (
				<div className={styles.textContent}>
					<Markdown text={content} />
					{editedTimestamp && (
						<span
							className={styles.edited}
							title={`Edited ${formatTimestamp(editedTimestamp)}`}
						>
							(edited)
						</span>
					)}
				</div>
			)}

			{/* Render embeds */}
			{typedEmbeds && typedEmbeds.length > 0 && (
				<div className={styles.embeds}>
					{typedEmbeds.map((embed, i) => (
						<Embed key={i} embed={embed} />
					))}
				</div>
			)}

			{/* Render attachments */}
			{typedAttachments && typedAttachments.length > 0 && (
				<Attachments attachments={typedAttachments} />
			)}

			{/* Render components (buttons, selects) */}
			{components && components.length > 0 && onButtonClick && onSelectOption && (
				<ComponentsContainer
					components={components}
					messageId={messageId}
					channelId={channelId}
					onButtonClick={(customId) => onButtonClick(messageId, customId)}
					onSelectOption={(customId, values) => onSelectOption(messageId, customId, values)}
				/>
			)}

			{/* Render reactions - always show to allow adding first reaction */}
			{onAddReaction && onRemoveReaction && (
				<Reactions
					messageId={messageId}
					reactions={reactions || []}
					onAddReaction={onAddReaction}
					onRemoveReaction={onRemoveReaction}
				/>
			)}

			{/* Ephemeral badge */}
			{isEphemeral && <EphemeralBadge />}
		</div>
	)
}
