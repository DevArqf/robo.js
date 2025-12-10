import type { StageUser } from '../../types/stage'
import styles from './UserArea.module.css'

interface UserAreaProps {
	user: StageUser | null
}

export function UserArea({ user }: UserAreaProps) {
	if (!user) {
		return (
			<div className={styles.container}>
				<div className={styles.placeholder}>Not connected</div>
			</div>
		)
	}

	const status = user.status || 'online'

	return (
		<div className={styles.container}>
			{/* Avatar with status indicator */}
			<div className={styles.avatarWrapper}>
				{user.avatar ? (
					<img
						className={styles.avatar}
						src={getAvatarUrl(user)}
						alt={user.username}
					/>
				) : (
					<div className={styles.avatar}>
						<DefaultAvatar />
					</div>
				)}
				<div className={`${styles.status} ${styles[status]}`} />
			</div>

			{/* User info */}
			<div className={styles.info}>
				<span className={styles.username}>{user.username}</span>
				{user.discriminator && user.discriminator !== '0' && (
					<span className={styles.discriminator}>#{user.discriminator}</span>
				)}
			</div>

			{/* Settings button */}
			<div className={styles.buttons}>
				<button className={styles.iconButton} title="Settings">
					<SettingsIcon />
				</button>
			</div>
		</div>
	)
}

function getAvatarUrl(user: StageUser): string {
	if (user.avatar?.startsWith('http') || user.avatar?.startsWith('data:')) {
		return user.avatar
	}
	return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=32`
}

function DefaultAvatar() {
	return (
		<svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor">
			<rect width="32" height="32" rx="16" fill="var(--brand-500)" />
			<path
				d="M16 8a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm-8 18c0-4.42 3.58-8 8-8s8 3.58 8 8"
				fill="white"
				opacity="0.8"
			/>
		</svg>
	)
}

function SettingsIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
			<path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
		</svg>
	)
}
