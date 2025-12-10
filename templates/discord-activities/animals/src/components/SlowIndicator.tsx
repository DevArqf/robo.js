import { useEffect, useState } from 'react'
import styles from './SlowIndicator.module.css'

interface SlowIndicatorProps {
	isSlowed: boolean
	duration?: number
}

export function SlowIndicator({ isSlowed, duration = 3000 }: SlowIndicatorProps) {
	const [timeLeft, setTimeLeft] = useState(0)

	useEffect(() => {
		if (!isSlowed) {
			setTimeLeft(0)
			return
		}

		setTimeLeft(duration)

		const interval = setInterval(() => {
			setTimeLeft((prev) => Math.max(0, prev - 100))
		}, 100)

		return () => clearInterval(interval)
	}, [isSlowed, duration])

	if (!isSlowed) return null

	return (
		<div className={styles.indicator}>
			<div className={styles.icon}>SLOWED</div>
			<div className={styles.bar}>
				<div
					className={styles.fill}
					style={{ width: `${(timeLeft / duration) * 100}%` }}
				/>
			</div>
		</div>
	)
}
