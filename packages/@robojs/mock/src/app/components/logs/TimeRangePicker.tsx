import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useLogsTimeRange, type RelativeTimeRange, RELATIVE_RANGE_LABELS } from '../../stores/logsStore'
import styles from './TimeRangePicker.module.css'

// Ordered list of relative presets for display
const RELATIVE_PRESETS: RelativeTimeRange[] = [
	'last30m',
	'last1h',
	'last3h',
	'last6h',
	'last12h',
	'last24h',
	'last2d',
	'last7d',
	'last14d',
	'last30d',
	'everything'
]

interface TimeRangePickerProps {
	className?: string
}

export function TimeRangePicker({ className }: TimeRangePickerProps) {
	const { timeRange, setTimeRange, recentCustomRanges, addRecentRange, getTimeRangeLabel } = useLogsTimeRange()
	const [isOpen, setIsOpen] = useState(false)
	const [showCustomPanel, setShowCustomPanel] = useState(false)
	const [customStart, setCustomStart] = useState('')
	const [customEnd, setCustomEnd] = useState('')
	const dropdownRef = useRef<HTMLDivElement>(null)

	// Get current timezone display string
	const timezone = useMemo(() => {
		const offset = new Date().getTimezoneOffset()
		const hours = Math.abs(Math.floor(offset / 60))
		const sign = offset <= 0 ? '+' : '-'
		return `GMT${sign}${hours.toString().padStart(2, '0')}`
	}, [])

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setIsOpen(false)
				setShowCustomPanel(false)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	// Initialize custom inputs when opening custom panel
	useEffect(() => {
		if (showCustomPanel) {
			if (timeRange.type === 'custom' && timeRange.customStart && timeRange.customEnd) {
				setCustomStart(formatDateTimeLocal(timeRange.customStart))
				setCustomEnd(formatDateTimeLocal(timeRange.customEnd))
			} else {
				// Default to last 24 hours
				const now = Date.now()
				setCustomStart(formatDateTimeLocal(now - 24 * 60 * 60 * 1000))
				setCustomEnd(formatDateTimeLocal(now))
			}
		}
	}, [showCustomPanel, timeRange])

	const handleToggle = useCallback(() => {
		setIsOpen((prev) => !prev)
		if (isOpen) {
			setShowCustomPanel(false)
		}
	}, [isOpen])

	const handleSelectRelative = useCallback(
		(preset: RelativeTimeRange) => {
			setTimeRange({ type: 'relative', relative: preset })
			setIsOpen(false)
			setShowCustomPanel(false)
		},
		[setTimeRange]
	)

	const handleOpenCustom = useCallback(() => {
		setShowCustomPanel(true)
	}, [])

	const handleApplyCustom = useCallback(() => {
		const startTs = new Date(customStart).getTime()
		const endTs = new Date(customEnd).getTime()

		if (isNaN(startTs) || isNaN(endTs) || startTs >= endTs) {
			// Invalid range
			return
		}

		const range = {
			type: 'custom' as const,
			customStart: startTs,
			customEnd: endTs
		}
		setTimeRange(range)

		// Add to recent ranges
		const label = `${formatShortDate(startTs)} - ${formatShortDate(endTs)}`
		addRecentRange({ start: startTs, end: endTs, label })

		setIsOpen(false)
		setShowCustomPanel(false)
	}, [customStart, customEnd, setTimeRange, addRecentRange])

	const handleSelectRecent = useCallback(
		(start: number, end: number) => {
			setTimeRange({
				type: 'custom',
				customStart: start,
				customEnd: end
			})
			setIsOpen(false)
			setShowCustomPanel(false)
		},
		[setTimeRange]
	)

	const label = getTimeRangeLabel()

	return (
		<div className={`${styles.container} ${className || ''}`} ref={dropdownRef}>
			<button className={styles.trigger} onClick={handleToggle}>
				<ClockIcon />
				<span className={styles.label}>{label}</span>
				<ChevronIcon isOpen={isOpen} />
			</button>

			{isOpen && (
				<div className={styles.dropdown}>
					{!showCustomPanel ? (
						<>
							{/* Relative presets */}
							<div className={styles.section}>
								<span className={styles.sectionLabel}>Relative</span>
								{RELATIVE_PRESETS.map((preset) => {
									const isActive = timeRange.type === 'relative' && timeRange.relative === preset
									return (
										<button
											key={preset}
											className={`${styles.item} ${isActive ? styles.active : ''}`}
											onClick={() => handleSelectRelative(preset)}
										>
											{RELATIVE_RANGE_LABELS[preset]}
											{isActive && <CheckIcon />}
										</button>
									)
								})}
							</div>

							{/* Custom option */}
							<div className={styles.divider} />
							<button className={styles.item} onClick={handleOpenCustom}>
								<CalendarIcon />
								Custom range...
							</button>

							{/* Recent custom ranges */}
							{recentCustomRanges.length > 0 && (
								<>
									<div className={styles.divider} />
									<div className={styles.section}>
										<span className={styles.sectionLabel}>Recent</span>
										{recentCustomRanges.map((range, i) => (
											<button
												key={i}
												className={styles.item}
												onClick={() => handleSelectRecent(range.start, range.end)}
											>
												{range.label}
											</button>
										))}
									</div>
								</>
							)}

							{/* Timezone */}
							<div className={styles.timezone}>
								<GlobeIcon />
								{timezone}
							</div>
						</>
					) : (
						// Custom range panel
						<div className={styles.customPanel}>
							<div className={styles.customHeader}>
								<button className={styles.backButton} onClick={() => setShowCustomPanel(false)}>
									<BackIcon />
								</button>
								<span className={styles.customTitle}>Custom range</span>
							</div>

							<div className={styles.customInputs}>
								<label className={styles.inputLabel}>
									From
									<input
										type="datetime-local"
										className={styles.dateInput}
										value={customStart}
										onChange={(e) => setCustomStart(e.target.value)}
									/>
								</label>

								<label className={styles.inputLabel}>
									To
									<input
										type="datetime-local"
										className={styles.dateInput}
										value={customEnd}
										onChange={(e) => setCustomEnd(e.target.value)}
									/>
								</label>
							</div>

							<div className={styles.customFooter}>
								<span className={styles.timezoneSmall}>
									<GlobeIcon />
									{timezone}
								</span>
								<button className={styles.applyButton} onClick={handleApplyCustom}>
									Apply
								</button>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

// Helper functions
function formatDateTimeLocal(timestamp: number): string {
	const date = new Date(timestamp)
	// Format as YYYY-MM-DDTHH:mm for datetime-local input
	const year = date.getFullYear()
	const month = (date.getMonth() + 1).toString().padStart(2, '0')
	const day = date.getDate().toString().padStart(2, '0')
	const hours = date.getHours().toString().padStart(2, '0')
	const minutes = date.getMinutes().toString().padStart(2, '0')
	return `${year}-${month}-${day}T${hours}:${minutes}`
}

function formatShortDate(timestamp: number): string {
	const date = new Date(timestamp)
	return date.toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	})
}

// Icons
function ClockIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className={styles.icon}>
			<path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z" />
			<path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z" />
		</svg>
	)
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 16 16"
			fill="currentColor"
			className={`${styles.chevron} ${isOpen ? styles.open : ''}`}
		>
			<path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z" />
		</svg>
	)
}

function CheckIcon() {
	return (
		<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className={styles.checkIcon}>
			<path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
		</svg>
	)
}

function CalendarIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className={styles.icon}>
			<path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z" />
		</svg>
	)
}

function GlobeIcon() {
	return (
		<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className={styles.globeIcon}>
			<path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855A7.97 7.97 0 0 0 5.145 4H7.5V1.077zM4.09 4a9.267 9.267 0 0 1 .64-1.539 6.7 6.7 0 0 1 .597-.933A7.025 7.025 0 0 0 2.255 4H4.09zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a6.958 6.958 0 0 0-.656 2.5h2.49zM4.847 5a12.5 12.5 0 0 0-.338 2.5H7.5V5H4.847zM8.5 5v2.5h2.99a12.495 12.495 0 0 0-.337-2.5H8.5zM4.51 8.5a12.5 12.5 0 0 0 .337 2.5H7.5V8.5H4.51zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5H8.5zM5.145 12c.138.386.295.744.468 1.068.552 1.035 1.218 1.65 1.887 1.855V12H5.145zm.182 2.472a6.696 6.696 0 0 1-.597-.933A9.268 9.268 0 0 1 4.09 12H2.255a7.024 7.024 0 0 0 3.072 2.472zM3.82 11a13.652 13.652 0 0 1-.312-2.5h-2.49c.062.89.291 1.733.656 2.5H3.82zm6.853 3.472A7.024 7.024 0 0 0 13.745 12H11.91a9.27 9.27 0 0 1-.64 1.539 6.688 6.688 0 0 1-.597.933zM8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855.173-.324.33-.682.468-1.068H8.5zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.65 13.65 0 0 1-.312 2.5zm2.802-3.5a6.959 6.959 0 0 0-.656-2.5H12.18c.174.782.282 1.623.312 2.5h2.49zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7.024 7.024 0 0 0-3.072-2.472c.218.284.418.598.597.933zM10.855 4a7.966 7.966 0 0 0-.468-1.068C9.835 1.897 9.17 1.282 8.5 1.077V4h2.355z" />
		</svg>
	)
}

function BackIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
			<path d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z" />
		</svg>
	)
}
