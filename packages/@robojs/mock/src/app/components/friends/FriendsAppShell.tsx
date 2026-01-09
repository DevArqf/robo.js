import { useCallback, useEffect, useState } from 'react'
import type { FriendRowData } from './friends.data'
import { FriendsSidebar } from './FriendsSidebar'
import { FriendsMain } from './FriendsMain'
import { ActiveNowPanel } from './ActiveNowPanel'
import { FriendProfilePanel } from './dm/FriendProfilePanel'
import { DirectMessageTopBar } from './dm/DirectMessageTopBar'
import styles from './FriendsAppShell.module.css'

export function FriendsAppShell({
	onTitleChange,
	resetKey
}: {
	onTitleChange?: (title: string) => void
	resetKey?: number
}) {
	const [openFriend, setOpenFriend] = useState<FriendRowData | null>(null)
	const [profileOpen, setProfileOpen] = useState(false)

	// When the user clicks the Home button again, reset to the Friends list.
	useEffect(() => {
		setOpenFriend(null)
		setProfileOpen(false)
		onTitleChange?.('Friends')
	}, [resetKey]) // intentionally only keyed on resetKey

	const handleOpenFriend = useCallback((friend: FriendRowData | null) => {
		setOpenFriend(friend)
		// When a DM opens, default the profile panel to open (matches Discord UX + your screenshot).
		setProfileOpen(!!friend)
	}, [])

	return (
		<div className={styles.shell}>
			<aside className={styles.sidebar}>
				<FriendsSidebar openFriend={openFriend} onOpenFriend={handleOpenFriend} />
			</aside>
			{openFriend ? (
				<div className={`${styles.main} ${styles.mainDm}`}>
					<DirectMessageTopBar friend={openFriend} profileOpen={profileOpen} onToggleProfile={() => setProfileOpen((v) => !v)} />
					<div className={styles.dmRow}>
						<div className={styles.center}>
							<FriendsMain
								onTitleChange={onTitleChange}
								openFriend={openFriend}
								onOpenFriend={handleOpenFriend}
							/>
						</div>
						{profileOpen ? (
							<aside className={styles.right}>
								<FriendProfilePanel friend={openFriend} />
							</aside>
						) : null}
					</div>
				</div>
			) : (
				<div className={styles.main}>
					<div className={styles.center}>
						<FriendsMain
							onTitleChange={onTitleChange}
							openFriend={openFriend}
							onOpenFriend={handleOpenFriend}
						/>
					</div>
					<aside className={styles.right}>
						<ActiveNowPanel />
					</aside>
				</div>
			)}
		</div>
	)
}


