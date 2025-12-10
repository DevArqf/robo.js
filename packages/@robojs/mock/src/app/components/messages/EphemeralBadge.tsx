import styles from './EphemeralBadge.module.css'

interface EphemeralBadgeProps {
	onDismiss?: () => void
}

export function EphemeralBadge({ onDismiss }: EphemeralBadgeProps) {
	return (
		<div className={styles.badge}>
			<svg
				className={styles.icon}
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="currentColor"
			>
				<path d="M12 5C5.648 5 1 12 1 12s4.648 7 11 7 11-7 11-7-4.648-7-11-7zm0 12c-2.761 0-5-2.239-5-5s2.239-5 5-5 5 2.239 5 5-2.239 5-5 5z" />
				<path d="M12 9c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3z" />
				<path d="M2.707 1.293L1.293 2.707l20 20 1.414-1.414-20-20z" />
			</svg>
			<span className={styles.text}>Only you can see this</span>
			{onDismiss && (
				<button className={styles.dismiss} onClick={onDismiss}>
					Dismiss message
				</button>
			)}
		</div>
	)
}
