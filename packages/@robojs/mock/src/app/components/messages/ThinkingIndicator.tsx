import { getAvatarUrl } from '../../utils/avatar'
import styles from './ThinkingIndicator.module.css'

interface ThinkingIndicatorProps {
	botName: string
	botAvatar?: string | null
	botId?: string
}

export function ThinkingIndicator({ botName, botAvatar, botId }: ThinkingIndicatorProps) {
	return (
		<div className={styles.container}>
			<div className={styles.avatar}>
				<img
					src={getAvatarUrl(botId || '0', botAvatar ?? null)}
					alt=""
					className={styles.avatarImage}
					onError={(e) => {
						const target = e.target as HTMLImageElement
						target.src = getAvatarUrl(botId || '0', null)
					}}
				/>
			</div>
			<div className={styles.content}>
				<span className={styles.botName}>{botName}</span>
				<span className={styles.botBadge}>BOT</span>
				<span className={styles.thinkingText}>is thinking</span>
				<div className={styles.dots}>
					<span className={styles.dot} />
					<span className={styles.dot} />
					<span className={styles.dot} />
				</div>
			</div>
		</div>
	)
}
