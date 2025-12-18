import { useState, useEffect, useCallback } from 'react'
import type { StageUser } from '../../types/stage'
import type { CurrentUserSettings } from '../../hooks/useCurrentUser'
import styles from './UserSettingsModal.module.css'

interface UserSettingsModalProps {
	user: StageUser
	onSave: (settings: CurrentUserSettings) => Promise<void>
	onClose: () => void
}

export function UserSettingsModal({ user, onSave, onClose }: UserSettingsModalProps) {
	const [username, setUsername] = useState(user.username)
	const [avatar, setAvatar] = useState(user.avatar || '')
	const [status, setStatus] = useState<'online' | 'offline' | 'idle' | 'dnd'>(user.status || 'online')
	const [isSaving, setIsSaving] = useState(false)

	// Close on escape key
	useEffect(() => {
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
		}
		window.addEventListener('keydown', handleEsc)
		return () => window.removeEventListener('keydown', handleEsc)
	}, [onClose])

	const handleSave = useCallback(async () => {
		setIsSaving(true)
		try {
			await onSave({
				username: username.trim() || user.username,
				avatar: avatar.trim() || null,
				status
			})
		} catch (error) {
			console.error('Failed to save user settings:', error)
		} finally {
			setIsSaving(false)
		}
	}, [username, avatar, status, user.username, onSave])

	return (
		<div className={styles.overlay} onClick={onClose}>
			<div className={styles.modal} onClick={(e) => e.stopPropagation()}>
				<div className={styles.header}>
					<h2>User Settings</h2>
					<button className={styles.closeButton} onClick={onClose}>
						<CloseIcon />
					</button>
				</div>

				<div className={styles.content}>
					<div className={styles.field}>
						<label htmlFor="username">Username</label>
						<input
							id="username"
							type="text"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							placeholder="Enter username"
							maxLength={32}
						/>
					</div>

					<div className={styles.field}>
						<label htmlFor="avatar">Avatar URL</label>
						<input
							id="avatar"
							type="text"
							value={avatar}
							onChange={(e) => setAvatar(e.target.value)}
							placeholder="https://example.com/avatar.png"
						/>
						<span className={styles.hint}>Leave empty for default avatar</span>
					</div>

					<div className={styles.field}>
						<label>Status</label>
						<div className={styles.statusOptions}>
							{(['online', 'idle', 'dnd', 'offline'] as const).map((s) => (
								<button
									key={s}
									className={`${styles.statusOption} ${status === s ? styles.selected : ''}`}
									onClick={() => setStatus(s)}
								>
									<span className={`${styles.statusDot} ${styles[s]}`} />
									<span>{getStatusLabel(s)}</span>
								</button>
							))}
						</div>
					</div>
				</div>

				<div className={styles.footer}>
					<button className={styles.cancelButton} onClick={onClose} disabled={isSaving}>
						Cancel
					</button>
					<button className={styles.saveButton} onClick={handleSave} disabled={isSaving}>
						{isSaving ? 'Saving...' : 'Save Changes'}
					</button>
				</div>
			</div>
		</div>
	)
}

function getStatusLabel(status: string): string {
	switch (status) {
		case 'online':
			return 'Online'
		case 'idle':
			return 'Idle'
		case 'dnd':
			return 'Do Not Disturb'
		case 'offline':
			return 'Invisible'
		default:
			return status
	}
}

function CloseIcon() {
	return (
		<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
			<path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z" />
		</svg>
	)
}
