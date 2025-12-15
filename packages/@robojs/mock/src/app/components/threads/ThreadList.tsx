import ThreadIcon from '../icons/thread'
import MagnifyingGlass from '../icons/magnifying_glass'
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

const mockThreads: Thread[] = [
	{
		id: '1',
		name: 'W3Schools Revival: Rebuilding the',
		authorName: '< { ProCoder } />',
		authorAvatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
		lastActive: '>30d ago',
		participants: [{ id: '1', name: 'User1', avatar: 'https://cdn.discordapp.com/embed/avatars/1.png' }]
	},
	{
		id: '2',
		name: 'inno setup alternatives',
		authorName: '/home/mostypc123/',
		authorAvatar: 'https://cdn.discordapp.com/embed/avatars/2.png',
		lastActive: '>30d ago',
		participants: [
			{ id: '1', name: 'User1', avatar: 'https://cdn.discordapp.com/embed/avatars/3.png' },
			{ id: '2', name: 'User2', avatar: 'https://cdn.discordapp.com/embed/avatars/4.png' }
		]
	},
	{
		id: '3',
		name: 'How to',
		authorName: '00face',
		lastActive: 'December 3, 2024',
		participants: [{ id: '1', name: 'User1', avatar: 'https://cdn.discordapp.com/embed/avatars/0.png' }]
	}
]

export function ThreadList({ threads = mockThreads }: ThreadListProps) {
	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<div className={styles.headerIcon}>
					<ThreadIcon width={24} height={24} fill="var(--interactive-normal)" />
				</div>
				<h2 className={styles.headerTitle}>Threads</h2>
				<div className={styles.searchContainer}>
					<input type="text" className={styles.searchInput} placeholder="Search for Thread Name" />
				</div>
				<button className={styles.createButton}>Create</button>
			</div>

			<div className={styles.section}>
				<h3 className={styles.sectionTitle}>Older Threads</h3>
			</div>

			<div className={styles.threadList}>
				{threads.length === 0 ? (
					<div className={styles.empty}>No threads yet</div>
				) : (
					threads.map((thread) => (
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
					))
				)}
			</div>
		</div>
	)
}
