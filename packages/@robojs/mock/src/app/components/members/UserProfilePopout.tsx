import { useEffect, useRef } from 'react'
import type { StageMember, StageRole } from '../../types/stage'
import { DropdownContainer } from '../base'
import styles from './UserProfilePopout.module.css'

interface UserProfilePopoutProps {
	member: StageMember
	roles: StageRole[]
	onClose: () => void
}

export function UserProfilePopout({ member, roles, onClose }: UserProfilePopoutProps) {
	const popoutRef = useRef<HTMLDivElement>(null)
	const { user, nick, joined_at } = member
	const displayName = nick || user.username
	const status = user.status || 'online'

	// Get member's roles (excluding @everyone)
	const memberRoles = roles
		.filter((r) => member.roles.includes(r.id) && r.name !== '@everyone')
		.sort((a, b) => b.position - a.position)

	// Close on click outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (popoutRef.current && !popoutRef.current.contains(event.target as Node)) {
				onClose()
			}
		}

		// Delay adding listener to prevent immediate close
		const timer = setTimeout(() => {
			document.addEventListener('mousedown', handleClickOutside)
		}, 0)

		return () => {
			clearTimeout(timer)
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [onClose])

	// Close on Escape
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose()
			}
		}

		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [onClose])

	// Format join date
	const formatDate = (dateStr?: string) => {
		if (!dateStr) return 'Unknown'
		const date = new Date(dateStr)
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		})
	}

	return (
		<div className={styles.overlay}>
			<DropdownContainer ref={popoutRef} className={styles.popout} role="dialog" aria-label="User profile">
				{/* Banner/Header */}
				<div className={styles.banner} />

				{/* Avatar */}
				<div className={styles.avatarContainer}>
					<div className={styles.avatar}>
						{user.avatar ? (
							<img src={getAvatarUrl(user.id, user.avatar, 80)} alt="" className={styles.avatarImage} />
						) : (
							<div className={styles.defaultAvatar}>{displayName[0].toUpperCase()}</div>
						)}
						<span className={`${styles.statusDot} ${styles[status]}`} />
					</div>
				</div>

				{/* User info */}
				<div className={styles.content}>
					<div className={styles.header}>
						<h2 className={styles.displayName}>
							{displayName}
							{user.bot && <span className={styles.botTag}>BOT</span>}
						</h2>
						<p className={styles.username}>
							{user.username}
							{user.discriminator && user.discriminator !== '0' && `#${user.discriminator}`}
						</p>
					</div>

					<div className={styles.divider} />

					{/* Member since */}
					<div className={styles.section}>
						<h3 className={styles.sectionTitle}>Member Since</h3>
						<p className={styles.sectionValue}>{formatDate(joined_at)}</p>
					</div>

					{/* Roles */}
					{memberRoles.length > 0 && (
						<div className={styles.section}>
							<h3 className={styles.sectionTitle}>Roles — {memberRoles.length}</h3>
							<div className={styles.roles}>
								{memberRoles.map((role) => (
									<RolePill key={role.id} role={role} />
								))}
							</div>
						</div>
					)}
				</div>
			</DropdownContainer>
		</div>
	)
}

function RolePill({ role }: { role: StageRole }) {
	const dotColor = role.color !== 0 ? `#${role.color.toString(16).padStart(6, '0')}` : 'var(--text-muted)'

	return (
		<div className={styles.rolePill}>
			<span className={styles.roleDot} style={{ backgroundColor: dotColor }} />
			<span className={styles.roleName}>{role.name}</span>
		</div>
	)
}

function getAvatarUrl(userId: string, avatar: string, size = 80): string {
	if (avatar.startsWith('http') || avatar.startsWith('data:')) {
		return avatar
	}
	return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=${size}`
}
