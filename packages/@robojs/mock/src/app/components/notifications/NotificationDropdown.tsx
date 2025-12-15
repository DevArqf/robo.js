import { useState } from 'react'
import styles from './NotificationDropdown.module.css'

type NotificationSetting = 'category-default' | 'all-messages' | 'only-mentions' | 'nothing'

interface NotificationDropdownProps {
	onClose?: () => void
}

const muteDurations = [
	'For 15 Minutes',
	'For 1 Hour',
	'For 3 Hours',
	'For 8 Hours',
	'For 24 Hours',
	'Until I turn it back on'
]

export function NotificationDropdown({ onClose }: NotificationDropdownProps) {
	const [selectedSetting, setSelectedSetting] = useState<NotificationSetting>('category-default')
	const [showMuteSubmenu, setShowMuteSubmenu] = useState(false)

	return (
		<div className={styles.container}>
			<div className={styles.mainPanel} onMouseLeave={() => setShowMuteSubmenu(false)}>
				<div className={styles.muteRow} onMouseEnter={() => setShowMuteSubmenu(true)}>
					<span className={styles.muteLabel}>Mute Channel</span>
					<span className={styles.chevron}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
							<path d="M9.29 6.71a.996.996 0 0 0 0 1.41L13.17 12l-3.88 3.88a.996.996 0 1 0 1.41 1.41l4.59-4.59a.996.996 0 0 0 0-1.41L10.7 6.7c-.38-.38-1.02-.38-1.41.01z" />
						</svg>
					</span>
				</div>

				<div className={styles.divider} />

				<div
					className={styles.optionRow}
					onClick={() => setSelectedSetting('category-default')}
					onMouseEnter={() => setShowMuteSubmenu(false)}
				>
					<div className={styles.optionContent}>
						<span className={styles.optionLabel}>Use Category Default</span>
						<span className={styles.optionSublabel}>Nothing</span>
					</div>
					<div className={`${styles.radio} ${selectedSetting === 'category-default' ? styles.selected : ''}`}>
						{selectedSetting === 'category-default' && <div className={styles.radioInner} />}
					</div>
				</div>

				<div
					className={styles.optionRow}
					onClick={() => setSelectedSetting('all-messages')}
					onMouseEnter={() => setShowMuteSubmenu(false)}
				>
					<div className={styles.optionContent}>
						<span className={styles.optionLabel}>All Messages</span>
					</div>
					<div className={`${styles.radio} ${selectedSetting === 'all-messages' ? styles.selected : ''}`}>
						{selectedSetting === 'all-messages' && <div className={styles.radioInner} />}
					</div>
				</div>

				<div
					className={styles.optionRow}
					onClick={() => setSelectedSetting('only-mentions')}
					onMouseEnter={() => setShowMuteSubmenu(false)}
				>
					<div className={styles.optionContent}>
						<span className={styles.optionLabel}>Only @mentions</span>
					</div>
					<div className={`${styles.radio} ${selectedSetting === 'only-mentions' ? styles.selected : ''}`}>
						{selectedSetting === 'only-mentions' && <div className={styles.radioInner} />}
					</div>
				</div>

				<div
					className={styles.optionRow}
					onClick={() => setSelectedSetting('nothing')}
					onMouseEnter={() => setShowMuteSubmenu(false)}
				>
					<div className={styles.optionContent}>
						<span className={styles.optionLabel}>Nothing</span>
					</div>
					<div className={`${styles.radio} ${selectedSetting === 'nothing' ? styles.selected : ''}`}>
						{selectedSetting === 'nothing' && <div className={styles.radioInner} />}
					</div>
				</div>
			</div>

			{showMuteSubmenu && (
				<div
					className={styles.submenuPanel}
					onMouseEnter={() => setShowMuteSubmenu(true)}
					onMouseLeave={() => setShowMuteSubmenu(false)}
				>
					{muteDurations.map((duration) => (
						<div key={duration} className={styles.submenuItem}>
							{duration}
						</div>
					))}
				</div>
			)}
		</div>
	)
}
