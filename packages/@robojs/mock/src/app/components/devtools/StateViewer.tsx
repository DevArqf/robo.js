import { useMemo } from 'react'
import { useSession } from '../../hooks/useSession'
import { JsonViewer } from './JsonViewer'
import styles from './StateViewer.module.css'

export function StateViewer() {
	const session = useSession()

	// Organize state into sections
	const stateTree = useMemo(() => {
		return {
			connection: {
				sessionId: session.sessionId,
				isConnected: session.isConnected,
				isConnecting: session.isConnecting,
				error: session.error
			},
			ui: {
				selectedGuildId: session.selectedGuildId,
				selectedChannelId: session.selectedChannelId,
				showMembers: session.showMembers
			},
			botUser: session.botUser,
			stats: {
				eventCount: session.eventCount,
				lastHeartbeat: session.lastHeartbeat
					? new Date(session.lastHeartbeat).toLocaleTimeString()
					: null,
				guildsCount: session.guilds.length,
				channelsCount: session.channels.length,
				membersCount: session.members.length,
				rolesCount: session.roles.length,
				usersCount: session.users.length,
				commandsCount: session.commands.length
			},
			guilds: session.guilds,
			channels: session.channels,
			members: session.members,
			roles: session.roles,
			users: session.users,
			commands: session.commands,
			messages: session.messages,
			typingUsers: session.typingUsers
		}
	}, [session])

	// Summary counts
	const counts = useMemo(
		() => ({
			guilds: session.guilds.length,
			channels: session.channels.length,
			members: session.members.length,
			roles: session.roles.length,
			messages: Object.values(session.messages).flat().length,
			commands: session.commands.length
		}),
		[session.guilds, session.channels, session.members, session.roles, session.messages, session.commands]
	)

	return (
		<div className={styles.container}>
			{/* Summary bar */}
			<div className={styles.summary}>
				<div className={styles.summaryItem}>
					<span className={styles.summaryValue}>{counts.guilds}</span>
					<span className={styles.summaryLabel}>Guilds</span>
				</div>
				<div className={styles.summaryItem}>
					<span className={styles.summaryValue}>{counts.channels}</span>
					<span className={styles.summaryLabel}>Channels</span>
				</div>
				<div className={styles.summaryItem}>
					<span className={styles.summaryValue}>{counts.members}</span>
					<span className={styles.summaryLabel}>Members</span>
				</div>
				<div className={styles.summaryItem}>
					<span className={styles.summaryValue}>{counts.roles}</span>
					<span className={styles.summaryLabel}>Roles</span>
				</div>
				<div className={styles.summaryItem}>
					<span className={styles.summaryValue}>{counts.messages}</span>
					<span className={styles.summaryLabel}>Messages</span>
				</div>
				<div className={styles.summaryItem}>
					<span className={styles.summaryValue}>{counts.commands}</span>
					<span className={styles.summaryLabel}>Commands</span>
				</div>
			</div>

			{/* State tree */}
			<div className={styles.tree}>
				<JsonViewer data={stateTree} collapsed={1} rootName="session" />
			</div>
		</div>
	)
}
