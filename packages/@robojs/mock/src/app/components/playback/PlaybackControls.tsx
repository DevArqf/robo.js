import styles from './PlaybackControls.module.css'

export function PlaybackControls() {
	// Playback will be implemented in Phase 5J
	return (
		<div className={styles.container}>
			<div className={styles.controls}>
				<button className={styles.controlButton} disabled title="Previous (Phase 5J)">
					<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
						<path d="M3 2h2v12H3V2zm3 6l8-6v12L6 8z" />
					</svg>
				</button>

				<button className={styles.controlButton} disabled title="Play/Pause (Phase 5J)">
					<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
						<path d="M4 2l10 6-10 6V2z" />
					</svg>
				</button>

				<button className={styles.controlButton} disabled title="Next (Phase 5J)">
					<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
						<path d="M11 2h2v12h-2V2zm-3 6L0 2v12l8-6z" />
					</svg>
				</button>
			</div>

			<div className={styles.timeline}>
				<span className={styles.time}>0:00</span>
				<div className={styles.progressBar}>
					<div className={styles.progress} style={{ width: '0%' }} />
				</div>
				<span className={styles.time}>0:00</span>
			</div>

			<div className={styles.actions}>
				<span className={styles.speed}>1x</span>
				<button className={styles.recordButton} disabled title="Record (Phase 5J)">
					<span className={styles.recordDot} />
					<span>REC</span>
				</button>
			</div>
		</div>
	)
}
