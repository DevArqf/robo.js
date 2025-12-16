import { Avatar, IconButton } from '../ui'
import { getAvatarUrl } from '../../utils/avatar'
import styles from './FriendsList.module.css'

type FriendRowData = {
	id: string
	username: string
	subtitle: string
	avatar: string | null
}

const FRIENDS: FriendRowData[] = [
	{ id: '1', username: 'Dreamnugget', subtitle: 'Online', avatar: null },
	{ id: '2', username: 'Jake', subtitle: 'Do Not Disturb', avatar: null },
	{ id: '3', username: 'MrBatata', subtitle: 'Code • 🥲 The month is so slow without her D:', avatar: null },
	{ id: '4', username: 'Pkmmte', subtitle: 'https://robojs.dev', avatar: null },
	{ id: '5', username: 'secretised', subtitle: '🦀', avatar: null },
	{ id: '6', username: 'Zoryko', subtitle: 'Do Not Disturb', avatar: null }
]

function MessageIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M4 4h16v12H7l-3 3V4Zm2 2v9.17L6.17 15H18V6H6Z" />
		</svg>
	)
}

function MoreIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M12 7a2 2 0 1 0 0-4a2 2 0 0 0 0 4Zm0 7a2 2 0 1 0 0-4a2 2 0 0 0 0 4Zm0 7a2 2 0 1 0 0-4a2 2 0 0 0 0 4Z" />
		</svg>
	)
}

function FriendRow({ friend }: { friend: FriendRowData }) {
	const url = friend.avatar ? getAvatarUrl(friend.id, friend.avatar, 32) : null

	return (
		<div className={styles.row}>
			<Avatar imageUrl={url} size={32} showStatus statusBorderColor="var(--background-primary)" statusColor="var(--status-online)" />
			<div className={styles.info}>
				<div className={styles.name}>{friend.username}</div>
				<div className={styles.sub}>{friend.subtitle}</div>
			</div>
			<div className={styles.actions}>
				<IconButton ariaLabel="Message" size="sm">
					<MessageIcon />
				</IconButton>
				<IconButton ariaLabel="More" size="sm">
					<MoreIcon />
				</IconButton>
			</div>
		</div>
	)
}

export function FriendsList() {
	return (
		<div>
			{FRIENDS.map((friend) => (
				<FriendRow key={friend.id} friend={friend} />
			))}
		</div>
	)
}


