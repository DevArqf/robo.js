import type { StageMember } from '../../types/stage'
import styles from './MemberList.module.css'

interface MemberListProps {
	members: StageMember[]
}

export function MemberList({ members }: MemberListProps) {
	// Group members by online/offline (all online for now since we don't have presence)
	const onlineMembers = members.filter((m) => m.user.status !== 'offline')
	const offlineMembers = members.filter((m) => m.user.status === 'offline')

	return (
		<aside className={styles.container}>
			{/* Online members */}
			{onlineMembers.length > 0 && (
				<div className={styles.group}>
					<h3 className={styles.groupHeader}>Online — {onlineMembers.length}</h3>
					{onlineMembers.map((member) => (
						<MemberItem key={`${member.guild_id}-${member.user.id}`} member={member} />
					))}
				</div>
			)}

			{/* Offline members */}
			{offlineMembers.length > 0 && (
				<div className={styles.group}>
					<h3 className={styles.groupHeader}>Offline — {offlineMembers.length}</h3>
					{offlineMembers.map((member) => (
						<MemberItem key={`${member.guild_id}-${member.user.id}`} member={member} />
					))}
				</div>
			)}

			{/* Empty state */}
			{members.length === 0 && (
				<div className={styles.empty}>
					<p>No members</p>
				</div>
			)}
		</aside>
	)
}

interface MemberItemProps {
	member: StageMember
}

function MemberItem({ member }: MemberItemProps) {
	const { user, nick } = member
	const displayName = nick || user.username
	const status = user.status || 'online'

	return (
		<div className={styles.member}>
			<div className={styles.avatar}>
				{user.avatar ? (
					<img src={getAvatarUrl(user.id, user.avatar)} alt="" className={styles.avatarImage} />
				) : (
					<div className={styles.defaultAvatar}>{displayName[0].toUpperCase()}</div>
				)}
				<span className={`${styles.statusDot} ${styles[status]}`} />
			</div>
			<div className={styles.info}>
				<span className={`${styles.name} ${user.bot ? styles.bot : ''}`}>
					{displayName}
					{user.bot && <span className={styles.botTag}>BOT</span>}
				</span>
			</div>
		</div>
	)
}

function getAvatarUrl(userId: string, avatar: string): string {
	if (avatar.startsWith('http') || avatar.startsWith('data:')) {
		return avatar
	}
	return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=32`
}
