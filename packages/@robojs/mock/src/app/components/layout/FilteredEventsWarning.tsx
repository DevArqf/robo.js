import { useState, useRef, useEffect, useCallback } from 'react'
import { useStageData } from '../../hooks/useStageData'
import { usePlaybackControls } from '../../stores/playbackStore'
import type { FilteredEvent, LoopWarning } from '../../stores/sessionStore'
import styles from './FilteredEventsWarning.module.css'

// How long to keep the loop warning visible (1 minute)
const LOOP_WARNING_DISPLAY_MS = 60_000

/**
 * Small icon button that shows when events are being filtered due to missing intents
 * or when an event loop has been detected.
 * Clicking it opens a popover with details about which events are blocked.
 * Each event is clickable to jump to that moment in playback.
 */
export function FilteredEventsWarning() {
	const { filteredEvents, clearFilteredEvents, loopWarning, clearLoopWarning } = useStageData()
	// Keep usePlaybackControls for seeking/events access (raw playback functionality)
	const { events: recordedEvents, setMode, seek } = usePlaybackControls()
	const [isOpen, setIsOpen] = useState(false)
	const [isCooldownActive, setIsCooldownActive] = useState(true)
	const [hasExpired, setHasExpired] = useState(false)
	const popoverRef = useRef<HTMLDivElement>(null)
	const buttonRef = useRef<HTMLButtonElement>(null)

	// Check if we can seek (need recorded events)
	const canSeek = recordedEvents.length > 0

	// Track cooldown status and display period expiration
	useEffect(() => {
		if (!loopWarning) {
			setIsCooldownActive(true) // Reset for next warning
			setHasExpired(false)
			return
		}

		const cooldownEnd = loopWarning.timestamp + loopWarning.cooldownMs
		const displayEnd = loopWarning.timestamp + LOOP_WARNING_DISPLAY_MS
		const now = Date.now()

		// Check initial cooldown state
		setIsCooldownActive(now < cooldownEnd)

		// Timer to mark cooldown as complete
		const cooldownRemaining = cooldownEnd - now
		let cooldownTimer: ReturnType<typeof setTimeout> | null = null
		if (cooldownRemaining > 0) {
			cooldownTimer = setTimeout(() => {
				setIsCooldownActive(false)
			}, cooldownRemaining)
		}

		// Timer to mark as expired after display period (1 minute)
		// Don't auto-dismiss - just track expiration
		const displayRemaining = displayEnd - now
		let displayTimer: ReturnType<typeof setTimeout> | null = null
		if (displayRemaining > 0) {
			displayTimer = setTimeout(() => {
				setHasExpired(true)
			}, displayRemaining)
		} else {
			// Already past display period
			setHasExpired(true)
		}

		return () => {
			if (cooldownTimer) clearTimeout(cooldownTimer)
			if (displayTimer) clearTimeout(displayTimer)
		}
	}, [loopWarning])

	// Auto-dismiss when popover closes if warning has expired
	useEffect(() => {
		if (!isOpen && hasExpired && loopWarning) {
			clearLoopWarning()
		}
	}, [isOpen, hasExpired, loopWarning, clearLoopWarning])

	// Seek to the moment a filtered event occurred
	const seekToEvent = useCallback(
		(filteredEvent: FilteredEvent | LoopWarning) => {
			if (!canSeek) return

			const firstEventTimestamp = recordedEvents[0].timestamp
			const relativeTime = filteredEvent.timestamp - firstEventTimestamp

			// Ensure we don't seek to negative time
			const seekTime = Math.max(0, relativeTime)

			// Switch to playback mode and seek
			setMode('playback')
			// Small delay to ensure mode switch completes
			setTimeout(() => {
				seek(seekTime)
			}, 50)

			setIsOpen(false)
		},
		[canSeek, recordedEvents, setMode, seek]
	)

	// Close popover when clicking outside
	useEffect(() => {
		if (!isOpen) return

		const handleClickOutside = (e: MouseEvent) => {
			if (
				popoverRef.current &&
				!popoverRef.current.contains(e.target as Node) &&
				buttonRef.current &&
				!buttonRef.current.contains(e.target as Node)
			) {
				setIsOpen(false)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [isOpen])

	// Count total warnings (filtered events + loop warning if present)
	const totalWarnings = filteredEvents.length + (loopWarning ? 1 : 0)

	// Don't render if no warnings
	if (totalWarnings === 0) return null

	// Determine button style based on warning type and cooldown state
	const hasLoopWarning = !!loopWarning
	const buttonClass = hasLoopWarning
		? isCooldownActive
			? `${styles.button} ${styles.danger}` // Red during active cooldown
			: `${styles.button} ${styles.resolved}` // Muted after cooldown complete
		: styles.button

	return (
		<div className={styles.container}>
			<button
				ref={buttonRef}
				className={buttonClass}
				onClick={() => setIsOpen(!isOpen)}
				title={
					hasLoopWarning
						? isCooldownActive
							? 'Event loop detected! Events being dropped.'
							: 'Event loop was detected (cooldown complete)'
						: 'Events not delivered to bot'
				}
				aria-label={`${totalWarnings} warning${totalWarnings !== 1 ? 's' : ''}`}
				aria-expanded={isOpen}
			>
				{hasLoopWarning ? (isCooldownActive ? <LoopIcon /> : <CheckIcon />) : <WarningIcon />}
				<span className={hasLoopWarning && !isCooldownActive ? styles.badgeResolved : styles.badge}>
					{totalWarnings}
				</span>
			</button>

			{isOpen && (
				<div ref={popoverRef} className={styles.popover}>
					{/* Loop Warning Section */}
					{loopWarning && (
						<>
							<div
								className={`${styles.popoverHeader} ${isCooldownActive ? styles.dangerHeader : styles.resolvedHeader}`}
							>
								<span className={styles.popoverTitle}>
									{isCooldownActive ? 'Event Loop Detected' : 'Loop Resolved'}
								</span>
								<button
									className={styles.clearButton}
									onClick={() => clearLoopWarning()}
									title="Dismiss"
								>
									Dismiss
								</button>
							</div>
							<div className={isCooldownActive ? styles.loopWarningContent : styles.loopResolvedContent}>
								<div className={styles.loopInfo}>
									<span className={isCooldownActive ? styles.loopEventType : styles.loopEventTypeResolved}>
										{loopWarning.eventType}
									</span>
									<span className={styles.loopDetails}>
										{loopWarning.count} events in {loopWarning.windowMs}ms
									</span>
									{loopWarning.lastAuthorUsername && (
										<span className={styles.loopAuthor}>
											Last from: {loopWarning.lastAuthorUsername}
										</span>
									)}
									{loopWarning.lastContent && (
										<span className={styles.loopContent}>
											"{loopWarning.lastContent}..."
										</span>
									)}
								</div>
								<button
									className={`${styles.eventItem} ${isCooldownActive ? styles.danger : ''} ${canSeek ? styles.clickable : ''}`}
									onClick={() => seekToEvent(loopWarning)}
									disabled={!canSeek}
									title={canSeek ? 'Jump to this moment in playback' : 'No recorded events to play back'}
								>
									<span className={styles.eventInfo}>
										<span className={styles.eventName}>View in playback</span>
									</span>
									{canSeek && (
										<span className={styles.playIcon}>
											<PlayIcon />
										</span>
									)}
								</button>
							</div>
							<div className={`${styles.popoverHint} ${isCooldownActive ? styles.dangerHint : styles.resolvedHint}`}>
								{isCooldownActive
									? `Bot may be responding to its own messages. Events dropped for ${loopWarning.cooldownMs / 1000}s.`
									: 'Cooldown complete. Normal operation resumed.'}
							</div>
						</>
					)}

					{/* Filtered Events Section */}
					{filteredEvents.length > 0 && (
						<>
							<div className={styles.popoverHeader}>
								<span className={styles.popoverTitle}>Events Not Delivered</span>
								<button
									className={styles.clearButton}
									onClick={() => {
										clearFilteredEvents()
										if (!loopWarning) setIsOpen(false)
									}}
									title="Clear warnings"
								>
									Clear
								</button>
							</div>
							<div className={styles.popoverContent}>
								{filteredEvents.map((f, i) => (
									<button
										key={i}
										className={`${styles.eventItem} ${canSeek ? styles.clickable : ''}`}
										onClick={() => seekToEvent(f)}
										disabled={!canSeek}
										title={canSeek ? 'Jump to this moment in playback' : 'No recorded events to play back'}
									>
										<div className={styles.eventInfo}>
											<span className={styles.eventName}>{f.eventName}</span>
											<span className={styles.intentName}>needs {f.requiredIntent}</span>
										</div>
										{canSeek && (
											<span className={styles.playIcon}>
												<PlayIcon />
											</span>
										)}
									</button>
								))}
							</div>
							<div className={styles.popoverHint}>
								{canSeek
									? 'Click an event to jump to that moment in playback.'
									: 'Add the required intents to your bot\'s client options.'}
							</div>
						</>
					)}
				</div>
			)}
		</div>
	)
}

function WarningIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
			<path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
		</svg>
	)
}

function PlayIcon() {
	return (
		<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
			<path d="M4 2l10 6-10 6V2z" />
		</svg>
	)
}

function LoopIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
			<path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z" />
			<path fillRule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z" />
		</svg>
	)
}

function CheckIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
			<path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
		</svg>
	)
}
