import { useState } from 'react'
import { useSession } from '../../hooks/useSession'
import styles from './ConnectionScreen.module.css'

export function ConnectionScreen() {
	const { sessionId, isConnecting, error, setSessionId, connect } = useSession()
	const [inputValue, setInputValue] = useState(sessionId || '')

	const handleConnect = () => {
		if (inputValue.trim()) {
			setSessionId(inputValue.trim())
			// Small delay to ensure state is updated
			setTimeout(() => connect(), 0)
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			handleConnect()
		}
	}

	return (
		<div className={styles.container}>
			<div className={styles.card}>
				<div className={styles.logo}>
					<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
						<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
					</svg>
				</div>

				<h1 className={styles.title}>Stage</h1>
				<p className={styles.subtitle}>Discord Gateway Mock Server</p>

				<div className={styles.form}>
					<label className={styles.label}>Session ID</label>
					<input
						type="text"
						className={styles.input}
						placeholder="Enter session ID (e.g., sess_abc123)"
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						onKeyDown={handleKeyDown}
						disabled={isConnecting}
					/>

					<button className={styles.button} onClick={handleConnect} disabled={isConnecting || !inputValue.trim()}>
						{isConnecting ? (
							<>
								<span className={styles.spinner} />
								Connecting...
							</>
						) : (
							'Connect'
						)}
					</button>

					{error && <div className={styles.error}>{error}</div>}
				</div>

				<div className={styles.help}>
					<p>Create a session using the control API:</p>
					<code className={styles.code}>POST /control/sessions</code>
				</div>
			</div>
		</div>
	)
}
