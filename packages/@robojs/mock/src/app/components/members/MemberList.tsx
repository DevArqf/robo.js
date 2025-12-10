import { useMemo, useState } from 'react'
import type { StageMember, StageRole } from '../../types/stage'
import { UserProfilePopout } from './UserProfilePopout'
import styles from './MemberList.module.css'

interface MemberListProps {
	members: StageMember[]
	roles: StageRole[]
}

interface MemberGroup {
	name: string
	members: StageMember[]
	color?: number
}

export function MemberList({ members, roles }: MemberListProps) {
	const [selectedMember, setSelectedMember] = useState<StageMember | null>(null)

	// Create role lookup map
	const roleMap = useMemo(() => {
		const map = new Map<string, StageRole>()
		for (const role of roles) {
			map.set(role.id, role)
		}
		return map
	}, [roles])

	// Get member's highest hoisted role
	const getHighestHoistedRole = (member: StageMember): StageRole | null => {
		let highestRole: StageRole | null = null
		for (const roleId of member.roles) {
			const role = roleMap.get(roleId)
			if (role && role.hoist) {
				if (!highestRole || role.position > highestRole.position) {
					highestRole = role
				}
			}
		}
		return highestRole
	}

	// Get member's role color (highest positioned role with color)
	const getMemberColor = (member: StageMember): number => {
		let highestColorRole: StageRole | null = null
		for (const roleId of member.roles) {
			const role = roleMap.get(roleId)
			if (role && role.color !== 0) {
				if (!highestColorRole || role.position > highestColorRole.position) {
					highestColorRole = role
				}
			}
		}
		return highestColorRole?.color ?? 0
	}

	// Group members by hoisted role or online/offline status
	const groupedMembers = useMemo(() => {
		const groups: MemberGroup[] = []
		const hoistedGroups = new Map<string, { role: StageRole; members: StageMember[] }>()
		const onlineNoRole: StageMember[] = []
		const offlineMembers: StageMember[] = []

		for (const member of members) {
			const isOffline = member.user.status === 'offline'

			if (isOffline) {
				offlineMembers.push(member)
				continue
			}

			const hoistedRole = getHighestHoistedRole(member)
			if (hoistedRole) {
				const group = hoistedGroups.get(hoistedRole.id)
				if (group) {
					group.members.push(member)
				} else {
					hoistedGroups.set(hoistedRole.id, { role: hoistedRole, members: [member] })
				}
			} else {
				onlineNoRole.push(member)
			}
		}

		// Sort hoisted roles by position (highest first)
		const sortedHoisted = Array.from(hoistedGroups.values()).sort((a, b) => b.role.position - a.role.position)

		// Add hoisted role groups
		for (const { role, members: roleMembers } of sortedHoisted) {
			groups.push({
				name: role.name,
				members: roleMembers,
				color: role.color
			})
		}

		// Add online members without hoisted role
		if (onlineNoRole.length > 0) {
			groups.push({
				name: 'Online',
				members: onlineNoRole
			})
		}

		// Add offline members
		if (offlineMembers.length > 0) {
			groups.push({
				name: 'Offline',
				members: offlineMembers
			})
		}

		return groups
	}, [members, roleMap])

	return (
		<aside className={styles.container}>
			{groupedMembers.map((group) => (
				<div key={group.name} className={styles.group}>
					<h3 className={styles.groupHeader}>
						{group.name} — {group.members.length}
					</h3>
					{group.members.map((member) => (
						<MemberItem
							key={`${member.guild_id}-${member.user.id}`}
							member={member}
							color={getMemberColor(member)}
							onClick={() => setSelectedMember(member)}
						/>
					))}
				</div>
			))}

			{/* Empty state */}
			{members.length === 0 && (
				<div className={styles.empty}>
					<p>No members</p>
				</div>
			)}

			{/* User profile popout */}
			{selectedMember && (
				<UserProfilePopout
					member={selectedMember}
					roles={roles}
					onClose={() => setSelectedMember(null)}
				/>
			)}
		</aside>
	)
}

interface MemberItemProps {
	member: StageMember
	color: number
	onClick: () => void
}

function MemberItem({ member, color, onClick }: MemberItemProps) {
	const { user, nick } = member
	const displayName = nick || user.username
	const status = user.status || 'online'

	// Convert color int to CSS hex
	const colorStyle = color !== 0 ? { color: `#${color.toString(16).padStart(6, '0')}` } : undefined

	return (
		<div className={styles.member} onClick={onClick}>
			<div className={styles.avatar}>
				{user.avatar ? (
					<img src={getAvatarUrl(user.id, user.avatar)} alt="" className={styles.avatarImage} />
				) : (
					<div className={styles.defaultAvatar}>{displayName[0].toUpperCase()}</div>
				)}
				<span className={`${styles.statusDot} ${styles[status]}`} />
			</div>
			<div className={styles.info}>
				<span className={`${styles.name} ${user.bot ? styles.bot : ''}`} style={colorStyle}>
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
