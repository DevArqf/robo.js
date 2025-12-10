import { useEffect, useState } from 'react'
import styles from './TypingIndicator.module.css'

interface TypingUser {
	userId: string
	username: string
	expiresAt: number
}

interface TypingIndicatorProps {
	typingUsers: TypingUser[]
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
	const [, setTick] = useState(0)

	// Re-render every second to expire typing users
	useEffect(() => {
		if (typingUsers.length === 0) return

		const interval = setInterval(() => {
			setTick((t) => t + 1)
		}, 1000)

		return () => clearInterval(interval)
	}, [typingUsers.length])

	// Filter out expired typing users
	const now = Date.now()
	const activeUsers = typingUsers.filter((t) => t.expiresAt > now)

	if (activeUsers.length === 0) {
		return null
	}

	// Format the typing message
	const formatTypingText = () => {
		if (activeUsers.length === 1) {
			return (
				<>
					<strong>{activeUsers[0].username}</strong> is typing
				</>
			)
		}
		if (activeUsers.length === 2) {
			return (
				<>
					<strong>{activeUsers[0].username}</strong> and <strong>{activeUsers[1].username}</strong> are typing
				</>
			)
		}
		if (activeUsers.length === 3) {
			return (
				<>
					<strong>{activeUsers[0].username}</strong>, <strong>{activeUsers[1].username}</strong>, and{' '}
					<strong>{activeUsers[2].username}</strong> are typing
				</>
			)
		}
		return <>Several people are typing</>
	}

	return (
		<div className={styles.container}>
			<div className={styles.dots}>
				<span className={styles.dot} />
				<span className={styles.dot} />
				<span className={styles.dot} />
			</div>
			<span className={styles.text}>{formatTypingText()}...</span>
		</div>
	)
}
