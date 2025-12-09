import type { StageChannel } from '../../types/stage'
import styles from './Header.module.css'

interface HeaderProps {
	channel: StageChannel | null
	onToggleMembers: () => void
	showMembers: boolean
}

export function Header({ channel, onToggleMembers, showMembers }: HeaderProps) {
	return (
		<header className={styles.header}>
			<div className={styles.channelInfo}>
				{channel ? (
					<>
						<span className={styles.hash}>#</span>
						<h2 className={styles.channelName}>{channel.name}</h2>
						{channel.topic && (
							<>
								<div className={styles.divider} />
								<span className={styles.topic}>{channel.topic}</span>
							</>
						)}
					</>
				) : (
					<span className={styles.placeholder}>Select a channel</span>
				)}
			</div>

			<div className={styles.actions}>
				<button
					className={`${styles.iconButton} ${showMembers ? styles.active : ''}`}
					onClick={onToggleMembers}
					title="Toggle member list"
				>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
						<path d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.794 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.711 13.006 18 15.473 18 19.006V20.006H2V19.006ZM20 20.006H22V19.006C22 16.4919 20.2085 14.4617 17.4491 13.4466C19.0315 14.5771 20 16.5103 20 19.006V20.006ZM14 3.99902C15.5 4.5 17 6 16.9999 8.00598C17 10 15.5 11.5 14 11.999C14.6254 11.0792 15 9.93913 15 8.00598C15 6.07283 14.6254 4.91882 14 3.99902Z" />
					</svg>
				</button>
			</div>
		</header>
	)
}
