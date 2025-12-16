import type { ReactNode } from 'react'
import { IconButton, SearchInput } from '../ui'
import styles from './FriendsSidebar.module.css'

function FriendsIcon() {
	return (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M16 11a4 4 0 1 0-3.999-4A4 4 0 0 0 16 11Zm-8 0a3 3 0 1 0-3-3a3 3 0 0 0 3 3Zm8 2c-3.314 0-6 1.686-6 4v1h12v-1c0-2.314-2.686-4-6-4Zm-8 .5c-.948 0-1.822.186-2.53.504C4.036 14.576 3 15.52 3 16.7V18h6v-.7c0-1.51.741-2.783 1.96-3.634A8.984 8.984 0 0 0 8 13.5Z" />
		</svg>
	)
}

function NitroIcon() {
	return (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M12 2 8.5 8.5 2 12l6.5 3.5L12 22l3.5-6.5L22 12l-6.5-3.5L12 2Z" />
		</svg>
	)
}

function ShopIcon() {
	return (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M7 4h10l1 4H6l1-4Zm-2 6h14v10H5V10Zm3 2v6h2v-6H8Zm6 0v6h2v-6h-2Z" />
		</svg>
	)
}

function QuestsIcon() {
	return (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M7 2h10v4h3v16H4V6h3V2Zm2 4h6V4H9v2Zm-3 4h12v2H6v-2Zm0 4h12v2H6v-2Z" />
		</svg>
	)
}

function PlusIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M19 11H13V5h-2v6H5v2h6v6h2v-6h6z" />
		</svg>
	)
}

function NavItem({
	icon,
	label,
	selected
}: {
	icon: ReactNode
	label: string
	selected?: boolean
}) {
	return (
		<button className={['interactive-item', styles.navItem, selected ? styles.selected : ''].filter(Boolean).join(' ')}>
			<span className={styles.navIcon}>{icon}</span>
			<span className={styles.navText}>{label}</span>
		</button>
	)
}

export function FriendsSidebar() {
	return (
		<div>
			<div className={styles.topSearch}>
				<SearchInput placeholder="Find or start a conversation" />
			</div>

			<nav className={styles.nav} aria-label="Primary">
				<NavItem icon={<FriendsIcon />} label="Friends" selected />
				<NavItem icon={<NitroIcon />} label="Nitro" />
				<NavItem icon={<ShopIcon />} label="Shop" />
				<NavItem icon={<QuestsIcon />} label="Quests" />
			</nav>

			<div className={styles.sectionHeader}>
				<span>Direct Messages</span>
				<IconButton ariaLabel="Create DM" title="Create DM" size="sm">
					<PlusIcon />
				</IconButton>
			</div>

			<div className={styles.dmList} aria-label="Direct Messages (placeholder)">
				<div className={styles.dmRow} />
				<div className={styles.dmRow} />
				<div className={styles.dmRow} />
				<div className={styles.dmRow} />
				<div className={styles.dmRow} />
			</div>
		</div>
	)
}


