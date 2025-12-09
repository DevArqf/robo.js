import { useSession } from '../../hooks/useSession'
import styles from './StatusBar.module.css'

export function StatusBar() {
	const { sessionId, isConnected, eventCount, botUser, lastHeartbeat } = useSession()

	// Calculate latency from heartbeat (rough estimate)
	const latency = lastHeartbeat ? Date.now() - lastHeartbeat : null

	return (
		<footer className={styles.statusBar}>
			<div className={styles.item}>
				<span className={styles.label}>Events</span>
				<span className={styles.value}>{eventCount}</span>
			</div>

			<div className={styles.divider} />

			<div className={styles.item}>
				<span className={styles.label}>Latency</span>
				<span className={styles.value}>{latency !== null ? `${Math.min(latency, 999)}ms` : '--'}</span>
			</div>

			<div className={styles.divider} />

			<div className={styles.item}>
				<span className={`${styles.statusDot} ${botUser ? styles.online : styles.offline}`} />
				<span className={styles.label}>Bot</span>
				<span className={styles.value}>{botUser ? botUser.username : 'Disconnected'}</span>
			</div>

			<div className={styles.spacer} />

			<div className={styles.item}>
				<span className={`${styles.statusDot} ${isConnected ? styles.online : styles.offline}`} />
				<span className={styles.label}>Session</span>
				<span className={styles.value}>{sessionId ? sessionId.replace('sess_', '') : '--'}</span>
			</div>
		</footer>
	)
}
