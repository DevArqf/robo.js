import { useState } from 'react'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { UserSettingsModal } from './UserSettingsModal'
import { UserSwitcher } from './UserSwitcher'
import { getAvatarUrl } from '../../utils/avatar'
import type { StageUser } from '../../types/stage'
import styles from './UserArea.module.css'

interface UserAreaProps {
	/** Optional user override - if not provided, uses currentUser from hook */
	user?: StageUser | null
}

export function UserArea({ user: userOverride }: UserAreaProps) {
	const { currentUser, updateUser, switchUser, availableUsers } = useCurrentUser()
	const [showSettings, setShowSettings] = useState(false)
	const [showSwitcher, setShowSwitcher] = useState(false)

	// Use override if provided, otherwise use currentUser from hook
	const user = userOverride !== undefined ? userOverride : currentUser

	if (!user) {
		return (
			<div className={styles.container}>
				<div className={styles.placeholder}>Not connected</div>
			</div>
		)
	}

	const status = user.status || 'online'

	return (
		<>
			<div className={styles.container}>
				{/* Avatar with status indicator */}
				<div className={styles.avatarWrapper} onClick={() => setShowSwitcher(true)}>
					<img
						className={styles.avatar}
						src={getAvatarUrl(user.id, user.avatar ?? null, 32)}
						alt={user.username}
						onError={(e) => {
							// Fallback to default avatar on error
							const target = e.target as HTMLImageElement
							target.src = getAvatarUrl(user.id, null, 32)
						}}
					/>
					<div className={`${styles.status} ${styles[status]}`} />
				</div>

				{/* User info */}
				<div className={styles.info}>
					<span className={styles.label}>Acting as</span>
					<span className={styles.username}>{user.username}</span>
				</div>

				{/* Buttons */}
				<div className={styles.buttons}>
					<button
						className={styles.iconButton}
						title="Switch User"
						onClick={() => setShowSwitcher(!showSwitcher)}
					>
						<SwitchIcon />
					</button>
					<button
						className={styles.iconButton}
						title="User Settings"
						onClick={() => setShowSettings(true)}
					>
						<SettingsIcon />
					</button>
				</div>
			</div>

			{/* User Settings Modal */}
			{showSettings && (
				<UserSettingsModal
					user={user}
					onSave={async (settings) => {
						await updateUser(settings)
						setShowSettings(false)
					}}
					onClose={() => setShowSettings(false)}
				/>
			)}

			{/* User Switcher Popover */}
			{showSwitcher && (
				<UserSwitcher
					currentUser={user}
					users={availableUsers}
					onSelect={async (userId) => {
						await switchUser(userId)
						setShowSwitcher(false)
					}}
					onClose={() => setShowSwitcher(false)}
				/>
			)}
		</>
	)
}

function SettingsIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
			<path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
		</svg>
	)
}

function SwitchIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
			<path d="M16 9v2H8V9l-4 4 4 4v-2h8v2l4-4-4-4z" />
		</svg>
	)
}
