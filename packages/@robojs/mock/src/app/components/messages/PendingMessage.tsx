import { useMemo } from 'react'
import { getAvatarUrl } from '../../utils/avatar'
import { Markdown } from '../common/Markdown'
import { useUserById } from '../../hooks/useCurrentUser'
import { useStageData } from '../../hooks/useStageData'
import styles from './PendingMessage.module.css'

export interface PendingMessageData {
	id: string
	content: string
	channelId: string
	state: 'sending' | 'failed'
	error?: string
	author: {
		id: string
		username: string
		avatar: string | null
	}
	createdAt: number
}

interface PendingMessageProps {
	message: PendingMessageData
	onRetry?: (messageId: string) => void
	onCancel?: (messageId: string) => void
}

export function PendingMessage({ message, onRetry, onCancel }: PendingMessageProps) {
	const { author: messageAuthor, content, state, error } = message
	const { members, roles, channels } = useStageData()

	// Look up the latest user data by ID - this makes user display reactive to changes
	const resolvedUser = useUserById(messageAuthor.id, messageAuthor)
	const author = useMemo(() => resolvedUser ?? messageAuthor, [resolvedUser, messageAuthor])

	return (
		<div className={`${styles.message} ${state === 'failed' ? styles.failed : styles.sending}`}>
			<div className={styles.avatar}>
				<img
					src={getAvatarUrl(author.id, author.avatar ?? null)}
					alt=""
					className={styles.avatarImage}
					onError={(e) => {
						const target = e.target as HTMLImageElement
						target.src = getAvatarUrl(author.id, null)
					}}
				/>
			</div>
			<div className={styles.content}>
				<div className={styles.header}>
					<span className={styles.author}>{author.username}</span>
					{state === 'sending' && <span className={styles.status}>Sending...</span>}
					{state === 'failed' && <span className={styles.errorStatus}>Failed to send</span>}
				</div>
				<div className={styles.textContent}>
					<Markdown text={content} members={members} roles={roles} channels={channels} />
				</div>
				{state === 'failed' && (
					<div className={styles.actions}>
						{error && <span className={styles.errorMessage}>{error}</span>}
						{onRetry && (
							<button className={styles.retryButton} onClick={() => onRetry(message.id)}>
								Retry
							</button>
						)}
						{onCancel && (
							<button className={styles.cancelButton} onClick={() => onCancel(message.id)}>
								Cancel
							</button>
						)}
					</div>
				)}
			</div>
		</div>
	)
}
