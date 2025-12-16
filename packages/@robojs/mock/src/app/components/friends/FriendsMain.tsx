import { useState } from 'react'
import { IconButton, SearchInput } from '../ui'
import { FriendsAllPanel } from './FriendsAllPanel'
import { FriendsOnlinePanel } from './FriendsOnlinePanel'
import styles from './FriendsMain.module.css'

function FriendsGlyph() {
	return (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M16 11a4 4 0 1 0-3.999-4A4 4 0 0 0 16 11Zm-8 0a3 3 0 1 0-3-3a3 3 0 0 0 3 3Zm8 2c-3.314 0-6 1.686-6 4v1h12v-1c0-2.314-2.686-4-6-4Zm-8 .5c-.948 0-1.822.186-2.53.504C4.036 14.576 3 15.52 3 16.7V18h6v-.7c0-1.51.741-2.783 1.96-3.634A8.984 8.984 0 0 0 8 13.5Z" />
		</svg>
	)
}

function InboxIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M3 3h18v12h-5l-2 3h-4l-2-3H3V3Zm2 2v8h4l2 3h2l2-3h4V5H5Z" />
		</svg>
	)
}

function HelpIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20Zm0 17a1.25 1.25 0 1 1 0-2.5A1.25 1.25 0 0 1 12 19Zm2.2-7.8c-.6.55-1 1-1 2.3h-2c0-2 .7-2.9 1.6-3.7c.8-.7 1.2-1.1 1.2-1.8c0-.9-.7-1.5-1.8-1.5c-1 0-1.8.5-2.1 1.5l-1.9-.8C8.7 5.7 10.1 5 12.1 5c2.3 0 3.9 1.3 3.9 3.2c0 1.5-.9 2.4-1.8 3Z" />
		</svg>
	)
}

function Tab({
	label,
	selected,
	onClick
}: {
	label: string
	selected?: boolean
	onClick?: () => void
}) {
	return (
		<button
			className={[styles.tab, selected ? styles.tabSelected : ''].filter(Boolean).join(' ')}
			type="button"
			aria-current={selected ? 'page' : undefined}
			onClick={onClick}
		>
			{label}
		</button>
	)
}

export function FriendsMain() {
	const [activeTab, setActiveTab] = useState<'online' | 'all'>('online')

	const sectionLabel = activeTab === 'all' ? 'All — 6' : 'Online — 6'

	return (
		<div className={styles.content}>
			<header className={styles.header}>
				<div className={styles.friendsTitle}>
					<FriendsGlyph />
					<span>Friends</span>
				</div>
				<div className={styles.divider} />

				<div className={styles.tabs}>
					<div className={styles.tabRow} aria-label="Friends tabs">
						<Tab label="Online" selected={activeTab === 'online'} onClick={() => setActiveTab('online')} />
						<Tab label="All" selected={activeTab === 'all'} onClick={() => setActiveTab('all')} />
						<Tab label="Pending" />
						<Tab label="Blocked" />
						<button className={styles.addFriend} type="button">
							Add Friend
						</button>
					</div>
				</div>

				<div className={styles.topRight}>
					<IconButton ariaLabel="Inbox" size="sm">
						<InboxIcon />
					</IconButton>
					<IconButton ariaLabel="Help" size="sm">
						<HelpIcon />
					</IconButton>
				</div>
			</header>

			<div className={styles.searchWrap}>
				<SearchInput placeholder="Search" />
			</div>

			<div className={styles.sectionLabel}>{sectionLabel}</div>
			<div className={styles.list}>
				{activeTab === 'all' ? <FriendsAllPanel /> : <FriendsOnlinePanel />}
			</div>
		</div>
	)
}


