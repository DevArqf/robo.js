import type { StageChannel } from '../../types/stage'
import styles from './Header.module.css'

interface HeaderProps {
	channel: StageChannel | null
	onToggleMembers: () => void
	showMembers: boolean
	onMobileMenuToggle?: () => void
	isMobileSidebarOpen?: boolean
}

export function Header({ channel, onToggleMembers, showMembers, onMobileMenuToggle, isMobileSidebarOpen }: HeaderProps) {
	return (
		<header className={styles.header}>
			{/* Mobile hamburger menu */}
			{onMobileMenuToggle && (
				<button
					className={`${styles.mobileMenuButton} ${isMobileSidebarOpen ? styles.active : ''}`}
					onClick={onMobileMenuToggle}
					aria-label={isMobileSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
					aria-expanded={isMobileSidebarOpen}
				>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
						{isMobileSidebarOpen ? (
							<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
						) : (
							<path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
						)}
					</svg>
				</button>
			)}

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
					aria-label={showMembers ? 'Hide member list' : 'Show member list'}
					aria-pressed={showMembers}
				>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
						<path d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.794 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.711 13.006 18 15.473 18 19.006V20.006H2V19.006ZM20 20.006H22V19.006C22 16.4919 20.2085 14.4617 17.4491 13.4466C19.0315 14.5771 20 16.5103 20 19.006V20.006ZM14 3.99902C15.5 4.5 17 6 16.9999 8.00598C17 10 15.5 11.5 14 11.999C14.6254 11.0792 15 9.93913 15 8.00598C15 6.07283 14.6254 4.91882 14 3.99902Z" />
					</svg>
				</button>
			</div>
		</header>
	)
}
