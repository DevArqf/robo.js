import { FriendsSidebar } from './FriendsSidebar'
import { FriendsMain } from './FriendsMain'
import { ActiveNowPanel } from './ActiveNowPanel'
import styles from './FriendsAppShell.module.css'

export function FriendsAppShell() {
	return (
		<div className={styles.shell}>
			<aside className={styles.sidebar}>
				<FriendsSidebar />
			</aside>
			<div className={styles.main}>
				<div className={styles.center}>
					<FriendsMain />
				</div>
				<aside className={styles.right}>
					<ActiveNowPanel />
				</aside>
			</div>
		</div>
	)
}


