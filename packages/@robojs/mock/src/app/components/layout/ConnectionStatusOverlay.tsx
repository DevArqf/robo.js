import { useState, useEffect } from 'react'
import { useStageData } from '../../hooks/useStageData'
import styles from './ConnectionStatusOverlay.module.css'

interface ConnectionStatusOverlayProps {
	/** Called when user wants to enter a new session ID */
	onChangeSession?: () => void
}

export function ConnectionStatusOverlay({ onChangeSession }: ConnectionStatusOverlayProps) {
	const { isConnected, isConnecting, hasGivenUp, isSessionInvalid, retryCount, retry, error, isPlaybackMode } = useStageData()
	const [isCollapsed, setIsCollapsed] = useState(false)

	// Keyboard shortcut: Cmd/Ctrl+K to change session
	useEffect(() => {
		if (isConnected || isPlaybackMode) return

		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault()
				onChangeSession?.()
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [isConnected, isPlaybackMode, onChangeSession])

	// Don't show anything if connected OR in playback mode
	// Playback mode intentionally disconnects since we're viewing recorded data
	if (isConnected || isPlaybackMode) {
		return null
	}

	// Determine state for styling
	const stateClass = isSessionInvalid ? styles.warning : (hasGivenUp || error) ? styles.error : styles.info

	// Collapsed view - small pill at bottom
	if (isCollapsed) {
		return (
			<button
				className={`${styles.collapsedPill} ${stateClass}`}
				onClick={() => setIsCollapsed(false)}
				title="Show connection status"
			>
				{isConnecting ? (
					<span className={styles.smallSpinner} />
				) : isSessionInvalid ? (
					<span>⚠️</span>
				) : hasGivenUp || error ? (
					<span>❌</span>
				) : (
					<span>🔌</span>
				)}
				<span className={styles.collapsedText}>
					{isConnecting ? 'Connecting...' : 'Disconnected'}
				</span>
			</button>
		)
	}

	// Session invalid - stale token
	if (isSessionInvalid) {
		return (
			<div className={`${styles.overlay} ${styles.warning}`}>
				<button className={styles.collapseButton} onClick={() => setIsCollapsed(true)} title="Collapse">
					▼
				</button>
				<div className={styles.icon}>⚠️</div>
				<div className={styles.content}>
					<span className={styles.title}>Session no longer exists</span>
					<span className={styles.hint}>The server may have restarted. Check your terminal for the new Stage URL.</span>
				</div>
				<div className={styles.actions}>
					{onChangeSession && (
						<button className={styles.secondaryButton} onClick={onChangeSession}>
							Change Session
						</button>
					)}
					<button className={styles.button} onClick={retry}>
						Retry
					</button>
				</div>
			</div>
		)
	}

	// Given up after max retries
	if (hasGivenUp) {
		return (
			<div className={`${styles.overlay} ${styles.error}`}>
				<button className={styles.collapseButton} onClick={() => setIsCollapsed(true)} title="Collapse">
					▼
				</button>
				<div className={styles.icon}>❌</div>
				<div className={styles.content}>
					<span className={styles.title}>Connection lost</span>
					<span className={styles.hint}>Failed after {retryCount} attempts</span>
				</div>
				<div className={styles.actions}>
					{onChangeSession && (
						<button className={styles.secondaryButton} onClick={onChangeSession}>
							Change Session
						</button>
					)}
					<button className={styles.button} onClick={retry}>
						Retry Connection
					</button>
				</div>
			</div>
		)
	}

	// Currently connecting/reconnecting
	if (isConnecting) {
		return (
			<div className={`${styles.overlay} ${styles.info}`}>
				<button className={styles.collapseButton} onClick={() => setIsCollapsed(true)} title="Collapse">
					▼
				</button>
				<div className={styles.spinner} />
				<div className={styles.content}>
					<span className={styles.title}>
						{retryCount > 0 ? `Reconnecting... (attempt ${retryCount})` : 'Connecting...'}
					</span>
				</div>
			</div>
		)
	}

	// Disconnected with error
	if (error) {
		return (
			<div className={`${styles.overlay} ${styles.error}`}>
				<button className={styles.collapseButton} onClick={() => setIsCollapsed(true)} title="Collapse">
					▼
				</button>
				<div className={styles.icon}>⚠️</div>
				<div className={styles.content}>
					<span className={styles.title}>Disconnected</span>
					<span className={styles.hint}>{error}</span>
				</div>
				<div className={styles.actions}>
					<button className={styles.button} onClick={retry}>
						Reconnect
					</button>
				</div>
			</div>
		)
	}

	// Generic disconnected state
	return (
		<div className={`${styles.overlay} ${styles.info}`}>
			<button className={styles.collapseButton} onClick={() => setIsCollapsed(true)} title="Collapse">
				▼
			</button>
			<div className={styles.icon}>🔌</div>
			<div className={styles.content}>
				<span className={styles.title}>Disconnected</span>
			</div>
			<div className={styles.actions}>
				<button className={styles.button} onClick={retry}>
					Reconnect
				</button>
			</div>
		</div>
	)
}
