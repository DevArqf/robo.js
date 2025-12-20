import ThreadIcon from '../icons/thread'
import styles from './ThreadList.module.css'

interface Thread {
	id: string
	name: string
	authorName: string
	authorAvatar?: string
	lastActive: string
	participants: Array<{
		id: string
		avatar?: string
		name: string
	}>
}

interface ThreadListProps {
	threads?: Thread[]
}

function SearchIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M10 2a8 8 0 1 0 4.9 14.3l4.4 4.4 1.4-1.4-4.4-4.4A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12a6 6 0 0 1 0-12Z" />
		</svg>
	)
}

export function ThreadList({ threads = [] }: ThreadListProps) {
	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<div className={styles.headerIcon}>
					<ThreadIcon width={24} height={24} fill="var(--interactive-normal)" />
				</div>
				<h2 className={styles.headerTitle}>Threads</h2>
				<div className={styles.searchContainer}>
					<span className={styles.searchIcon} aria-hidden="true">
						<SearchIcon />
					</span>
					<input type="text" className={styles.searchInput} placeholder="Search for Thread Name" />
				</div>
				<button className={styles.createButton} type="button">
					Create
				</button>
			</div>

			{threads.length === 0 ? (
				<div className={styles.emptyWrap}>
					<div className={styles.emptyIcon}>
						<ThreadIcon width={44} height={44} fill="var(--interactive-normal)" />
					</div>
					<div className={styles.emptyTitle}>There are no threads.</div>
					<div className={styles.emptySub}>
						Stay focused on a conversation with a thread - a temporary
						<br />
						text channel.
					</div>
					<button className={styles.emptyCta} type="button">
						Create Thread
					</button>
				</div>
			) : (
				<>
					<div className={styles.section}>
						<h3 className={styles.sectionTitle}>Older Threads</h3>
					</div>
					<div className={styles.threadList}>
						{threads.map((thread) => (
							<div key={thread.id} className={styles.threadItem}>
								<div className={styles.threadContent}>
									<div className={styles.threadName}>{thread.name}</div>
									<div className={styles.threadMeta}>
										{thread.authorAvatar && (
											<img src={thread.authorAvatar} alt={thread.authorName} className={styles.threadAuthorAvatar} />
										)}
										<span>Started by</span>
										<span className={styles.threadAuthorName}>{thread.authorName}</span>
										<span className={styles.metaDot}>·</span>
										<span>Last active {thread.lastActive}</span>
									</div>
								</div>
								<div className={styles.threadAvatars}>
									{thread.participants.slice(0, 3).map((participant, index) => (
										<img
											key={participant.id}
											src={participant.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}
											alt={participant.name}
											className={styles.participantAvatar}
											style={{ zIndex: 3 - index }}
										/>
									))}
								</div>
							</div>
						))}
					</div>
				</>
			)}
		</div>
	)
}
