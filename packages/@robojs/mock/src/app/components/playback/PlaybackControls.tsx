import { useState, useRef, useCallback } from 'react'
import { usePlaybackControls, formatTime } from '../../stores/playbackStore'
import { useLogs } from '../../stores/logsStore'
import { useDevTools } from '../devtools/DevToolsPanel'
import { FilteredEventsWarning } from '../layout/FilteredEventsWarning'
import type { StageEventType } from '../../types/stage'
import styles from './PlaybackControls.module.css'

// SVG Icons
const PlayIcon = () => (
	<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
		<path d="M4 2l10 6-10 6V2z" />
	</svg>
)

const PauseIcon = () => (
	<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
		<path d="M3 2h4v12H3V2zm6 0h4v12H9V2z" />
	</svg>
)

const SkipBackIcon = () => (
	<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
		<path d="M2 2h2v12H2V2zm3 6l9-6v12L5 8z" />
	</svg>
)

const SkipForwardIcon = () => (
	<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
		<path d="M12 2h2v12h-2V2zm-1 6L2 2v12l9-6z" />
	</svg>
)

const RewindIcon = () => (
	<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
		<path d="M8 8L16 2v12L8 8zm-8 0L8 2v12L0 8z" />
	</svg>
)

const FastForwardIcon = () => (
	<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
		<path d="M0 2l8 6-8 6V2zm8 0l8 6-8 6V2z" />
	</svg>
)

const ClockIcon = () => (
	<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
		<path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm0 14A6 6 0 1 1 8 2a6 6 0 0 1 0 12zm.5-9H7v5l4.25 2.5.75-1.23-3.5-2.08V5z" />
	</svg>
)

const TrashIcon = () => (
	<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
		<path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
		<path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
	</svg>
)

const TerminalIcon = () => (
	<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
		<path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm3.5 1a.5.5 0 0 0-.354.854l2.146 2.146-2.146 2.146a.5.5 0 1 0 .708.708l2.5-2.5a.5.5 0 0 0 0-.708l-2.5-2.5A.5.5 0 0 0 3.5 3zM8 8.5a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1H8z" />
	</svg>
)

const LogsIcon = () => (
	<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
		<path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h11A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11zM3 4v1h10V4H3zm0 3v1h10V7H3zm0 3v1h5v-1H3z" />
	</svg>
)

export function PlaybackControls() {
	const { toggle: toggleDevTools } = useDevTools()
	const { toggle: toggleLogs, isOpen: logsOpen, getLogDensity, logs } = useLogs()
	const {
		mode,
		isPlaying,
		currentTime,
		duration,
		speed,
		eventCount,
		events,
		setMode,
		togglePlay,
		seek,
		setSpeed,
		clearEvents,
		getEventMarkers
	} = usePlaybackControls()

	const [isDragging, setIsDragging] = useState(false)
	const scrubberRef = useRef<HTMLDivElement>(null)

	// Calculate log density for timeline visualization
	const logDensity = (() => {
		if (!logsOpen || logs.length === 0 || events.length === 0 || duration === 0) {
			return []
		}
		const startTime = events[0].timestamp
		const endTime = startTime + duration
		return getLogDensity(50, startTime, endTime)
	})()

	// Handle scrubber interaction
	const handleScrubberChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			seek(Number(e.target.value))
		},
		[seek]
	)

	const handleScrubberClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (!scrubberRef.current || duration === 0) return
			const rect = scrubberRef.current.getBoundingClientRect()
			const x = e.clientX - rect.left
			const percent = x / rect.width
			seek(percent * duration)
		},
		[duration, seek]
	)

	// Get progress percentage
	const progress = duration > 0 ? (currentTime / duration) * 100 : 0

	// Get event markers for timeline
	const markers = getEventMarkers()

	// Get marker class based on event type
	const getMarkerClass = (type: StageEventType): string => {
		if (type === 'message_create') return styles.message
		if (type === 'interaction_create') return styles.interaction
		if (type === 'interaction_response') return styles.response
		if (type === 'typing_start') return styles.typing
		return ''
	}

	return (
		<div className={styles.container} role="region" aria-label="Playback controls">
			{/* Mode Toggle */}
			<div className={styles.modeToggle} role="group" aria-label="Mode selection">
				<button
					className={`${styles.modeButton} ${mode === 'live' ? styles.active : ''}`}
					onClick={() => setMode('live')}
					title="Live mode - record events"
					aria-label="Live mode - record events"
					aria-pressed={mode === 'live'}
				>
					<span className={styles.liveDot} aria-hidden="true" />
					Live
				</button>
				<button
					className={`${styles.modeButton} ${mode === 'playback' ? styles.active : ''}`}
					onClick={() => setMode('playback')}
					disabled={eventCount === 0}
					title="Playback mode - replay recorded events"
					aria-label="Playback mode - replay recorded events"
					aria-pressed={mode === 'playback'}
				>
					<ClockIcon />
					Playback
				</button>
			</div>

			{mode === 'playback' ? (
				<>
					{/* Transport Controls */}
					<div className={styles.transport} role="group" aria-label="Transport controls">
						<button
							className={styles.transportButton}
							onClick={() => seek(0)}
							disabled={eventCount === 0}
							title="Skip to start"
							aria-label="Skip to start"
						>
							<SkipBackIcon />
						</button>
						<button
							className={styles.transportButton}
							onClick={() => seek(Math.max(0, currentTime - 5000))}
							disabled={eventCount === 0}
							title="Rewind 5 seconds"
							aria-label="Rewind 5 seconds"
						>
							<RewindIcon />
						</button>
						<button
							className={styles.playButton}
							onClick={togglePlay}
							disabled={eventCount === 0}
							title={isPlaying ? 'Pause' : 'Play'}
							aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
						>
							{isPlaying ? <PauseIcon /> : <PlayIcon />}
						</button>
						<button
							className={styles.transportButton}
							onClick={() => seek(Math.min(duration, currentTime + 5000))}
							disabled={eventCount === 0}
							title="Forward 5 seconds"
							aria-label="Forward 5 seconds"
						>
							<FastForwardIcon />
						</button>
						<button
							className={styles.transportButton}
							onClick={() => seek(duration)}
							disabled={eventCount === 0}
							title="Skip to end"
							aria-label="Skip to end"
						>
							<SkipForwardIcon />
						</button>
					</div>

					{/* Timeline */}
					<div className={styles.timeline}>
						<span className={styles.time}>{formatTime(currentTime)}</span>

						<div
							className={`${styles.scrubber} ${isDragging ? styles.scrubberDragging : ''}`}
							ref={scrubberRef}
							onClick={handleScrubberClick}
						>
							<div className={styles.scrubberTrack}>
								<div className={styles.scrubberProgress} style={{ width: `${progress}%` }} />

								{/* Event Markers */}
								<div className={styles.markers}>
									{markers.map((marker, i) => (
										<div
											key={i}
											className={`${styles.marker} ${getMarkerClass(marker.type)}`}
											style={{ left: `${Math.min((marker.time / duration) * 100, 100)}%` }}
											onClick={(e) => {
												e.stopPropagation()
												seek(marker.time)
											}}
											title={marker.label}
										>
											<span className={styles.tooltip}>{marker.label}</span>
										</div>
									))}
								</div>

								{/* Log Density Visualization */}
								{logDensity.length > 0 && (
									<div className={styles.logDensity}>
										{logDensity.map((count, i) => {
											const maxDensity = Math.max(...logDensity, 1)
											const height = (count / maxDensity) * 100
											return (
												<div
													key={i}
													className={styles.logDensityBar}
													style={{
														left: `${(i / logDensity.length) * 100}%`,
														height: `${height}%`
													}}
												/>
											)
										})}
									</div>
								)}

								{/* Thumb */}
								<div className={styles.scrubberThumb} style={{ left: `${progress}%` }} />
							</div>

							{/* Hidden range input for accessibility */}
							<input
								type="range"
								min={0}
								max={duration || 100}
								value={currentTime}
								onChange={handleScrubberChange}
								onMouseDown={() => setIsDragging(true)}
								onMouseUp={() => setIsDragging(false)}
								className={styles.scrubberInput}
							/>
						</div>

						<span className={styles.time}>{formatTime(duration)}</span>
					</div>

					{/* Speed Control */}
					<div className={styles.speedControl}>
						<select
							value={speed}
							onChange={(e) => setSpeed(Number(e.target.value))}
							className={styles.speedSelect}
							title="Playback speed"
						>
							<option value={0.5}>0.5x</option>
							<option value={1}>1x</option>
							<option value={2}>2x</option>
							<option value={4}>4x</option>
						</select>
					</div>

					{/* Event count indicator */}
					<span className={styles.eventCount}>{eventCount} events</span>
				</>
			) : (
				<>
					{/* Event count */}
					<span className={styles.eventCount}>{eventCount} events</span>

					{/* Spacer */}
					<div style={{ flex: 1 }} />
				</>
			)}

			{/* Actions */}
			<div className={styles.actions}>
				{/* Filtered Events Warning */}
				<FilteredEventsWarning />

				{/* Logs Button */}
				<button
					className={`${styles.devButton} ${logsOpen ? styles.active : ''}`}
					onClick={toggleLogs}
					title="Toggle Logs Panel (Ctrl+Shift+L)"
				>
					<LogsIcon />
					Logs
				</button>

				{/* Dev Tools Button */}
				<button
					className={styles.devButton}
					onClick={toggleDevTools}
					title="Open Dev Tools (Ctrl+Shift+D)"
				>
					<TerminalIcon />
					Dev Tools
				</button>

				{/* Clear Button */}
				{eventCount > 0 && (
					<button className={styles.clearButton} onClick={clearEvents} title="Clear recorded events">
						<TrashIcon />
					</button>
				)}
			</div>
		</div>
	)
}
