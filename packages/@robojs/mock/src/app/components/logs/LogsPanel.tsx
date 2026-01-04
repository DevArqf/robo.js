import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useLogs, useLogsTimeRange } from '../../stores/logsStore'
import { usePlaybackControls } from '../../stores/playbackStore'
import { LogEntry } from './LogEntry'
import { LogSearchBar } from './LogSearchBar'
import { TimeRangePicker } from './TimeRangePicker'
import { LogDensityGraph } from './LogDensityGraph'
import styles from './LogsPanel.module.css'

export function LogsPanel() {
	const { isOpen, close, width, setWidth, filteredLogs, filters } = useLogs()
	const { timeFilteredLogs } = useLogsTimeRange()
	const { mode, duration, seek, events } = usePlaybackControls()
	const [isClosing, setIsClosing] = useState(false)
	const [shouldRender, setShouldRender] = useState(isOpen)
	const isDragging = useRef(false)
	const startX = useRef(0)
	const startWidth = useRef(0)
	const listRef = useRef<HTMLDivElement>(null)
	const [autoScroll, setAutoScroll] = useState(true)

	// Combine time-filtered logs with search/level filters
	const displayLogs = useMemo(() => {
		// If we have active filters (search or level), use filteredLogs
		// Otherwise use timeFilteredLogs
		if (filters.search || filters.levels.size > 0) {
			// Apply time range to filtered logs
			return filteredLogs
		}
		return timeFilteredLogs
	}, [filteredLogs, timeFilteredLogs, filters.search, filters.levels])

	// Determine which logs need date separators
	const logsWithSeparators = useMemo(() => {
		const result: { log: (typeof displayLogs)[0]; showDateSeparator: boolean }[] = []
		let lastDate = ''

		for (const log of displayLogs) {
			const date = new Date(log.timestamp)
			const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
			const showDateSeparator = dateStr !== lastDate
			lastDate = dateStr
			result.push({ log, showDateSeparator })
		}

		return result
	}, [displayLogs])

	// Handle open/close transitions
	useEffect(() => {
		if (isOpen) {
			setShouldRender(true)
			setIsClosing(false)
		} else if (shouldRender) {
			setIsClosing(true)
			const timer = setTimeout(() => {
				setShouldRender(false)
				setIsClosing(false)
			}, 150)
			return () => clearTimeout(timer)
		}
	}, [isOpen, shouldRender])

	// Auto-scroll when new logs come in and at tail
	useEffect(() => {
		if (autoScroll && listRef.current) {
			listRef.current.scrollTop = listRef.current.scrollHeight
		}
	}, [displayLogs.length, autoScroll])

	// Handle scroll to detect if user is at tail
	const handleScroll = useCallback(() => {
		if (!listRef.current) return
		const { scrollTop, scrollHeight, clientHeight } = listRef.current
		const atTail = scrollHeight - scrollTop - clientHeight < 50
		setAutoScroll(atTail)
	}, [])

	// Handle resize drag (from LEFT edge since panel is on the right)
	const handleResizeStart = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			isDragging.current = true
			startX.current = e.clientX
			startWidth.current = width
			document.body.style.cursor = 'ew-resize'
			document.body.style.userSelect = 'none'
		},
		[width]
	)

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (!isDragging.current) return
			// Dragging left increases width, dragging right decreases
			const deltaX = startX.current - e.clientX
			const newWidth = startWidth.current + deltaX
			setWidth(newWidth)
		}

		const handleMouseUp = () => {
			if (isDragging.current) {
				isDragging.current = false
				document.body.style.cursor = ''
				document.body.style.userSelect = ''
			}
		}

		document.addEventListener('mousemove', handleMouseMove)
		document.addEventListener('mouseup', handleMouseUp)

		return () => {
			document.removeEventListener('mousemove', handleMouseMove)
			document.removeEventListener('mouseup', handleMouseUp)
		}
	}, [setWidth])

	// Keyboard shortcut: Ctrl/Cmd + Shift + L
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
				e.preventDefault()
				close()
			}
		}
		document.addEventListener('keydown', handler)
		return () => document.removeEventListener('keydown', handler)
	}, [close])

	// Handle seek to log timestamp
	const handleSeekToLog = useCallback(
		(timestamp: number) => {
			if (events.length === 0) return
			const startTimestamp = events[0].timestamp
			const playbackTime = timestamp - startTimestamp
			seek(Math.max(0, Math.min(playbackTime, duration)))
		},
		[events, seek, duration]
	)

	// Handle density graph click
	const handleDensitySeek = useCallback(
		(timestamp: number) => {
			// Scroll to logs near this timestamp
			const targetIndex = displayLogs.findIndex((log) => log.timestamp >= timestamp)
			if (targetIndex >= 0 && listRef.current) {
				// Find the log entry element and scroll to it
				const entries = listRef.current.querySelectorAll('[data-log-entry]')
				if (entries[targetIndex]) {
					entries[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'start' })
					setAutoScroll(false)
				}
			}
		},
		[displayLogs]
	)

	if (!shouldRender) {
		return null
	}

	const panelClasses = [styles.panel, isClosing && styles.closing].filter(Boolean).join(' ')

	return (
		<aside className={panelClasses} style={{ width: `${width}px` }}>
			{/* Resize handle on left edge */}
			<div className={styles.resizeHandle} onMouseDown={handleResizeStart} />

			{/* Header with controls */}
			<div className={styles.header}>
				<div className={styles.headerTop}>
					<div className={styles.title}>
						<LogsIcon />
						<span>Logs</span>
						<span className={styles.count}>({displayLogs.length})</span>
					</div>
					<button className={styles.closeButton} onClick={close} title="Close Logs Panel (Ctrl+Shift+L)">
						<CloseIcon />
					</button>
				</div>

				{/* Search bar and time range picker */}
				<div className={styles.controls}>
					<LogSearchBar className={styles.searchBar} />
					<TimeRangePicker className={styles.timePicker} />
				</div>
			</div>

			{/* Log density graph */}
			<LogDensityGraph onSeekToTime={handleDensitySeek} />

			{/* Column headers */}
			<div className={styles.columnHeaders}>
				<span className={styles.colTime}>Time</span>
				<span className={styles.colSource}>Source</span>
				<span className={styles.colLevel}>Level</span>
				<span className={styles.colMessage}>Message</span>
			</div>

			{/* Log list */}
			<div className={styles.logList} ref={listRef} onScroll={handleScroll}>
				{logsWithSeparators.length === 0 ? (
					<div className={styles.empty}>
						<span>No logs to display</span>
					</div>
				) : (
					logsWithSeparators.map(({ log, showDateSeparator }) => (
						<LogEntry
							key={log.id}
							log={log}
							showDateSeparator={showDateSeparator}
							onSeek={mode === 'playback' || events.length > 0 ? () => handleSeekToLog(log.timestamp) : undefined}
						/>
					))
				)}
			</div>

			{/* Auto-scroll indicator */}
			{!autoScroll && displayLogs.length > 0 && (
				<button
					className={styles.scrollToBottom}
					onClick={() => {
						setAutoScroll(true)
						if (listRef.current) {
							listRef.current.scrollTop = listRef.current.scrollHeight
						}
					}}
				>
					<ArrowDownIcon />
					New logs
				</button>
			)}
		</aside>
	)
}

// Icons
function LogsIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
			<path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h11A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11zM3 4v1h10V4H3zm0 3v1h10V7H3zm0 3v1h5v-1H3z" />
		</svg>
	)
}

function CloseIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
			<path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
		</svg>
	)
}

function ArrowDownIcon() {
	return (
		<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
			<path
				fillRule="evenodd"
				d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1z"
			/>
		</svg>
	)
}
