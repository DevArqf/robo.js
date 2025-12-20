import { useMemo, useCallback, useRef, useState, useEffect } from 'react'
import { useLogManagement, useLogsTimeRange } from '../../stores/logsStore'
import styles from './LogDensityGraph.module.css'

const BUCKET_COUNT = 60 // Number of bars in the graph
const BAR_GAP = 1 // Gap between bars in pixels

interface LogDensityGraphProps {
	className?: string
	/** Callback when user clicks on a time bucket */
	onSeekToTime?: (timestamp: number) => void
}

export function LogDensityGraph({ className, onSeekToTime }: LogDensityGraphProps) {
	const { logs, getLogDensity } = useLogManagement()
	const { getTimeRangeBounds, timeRange } = useLogsTimeRange()
	const containerRef = useRef<HTMLDivElement>(null)
	const [hoveredBucket, setHoveredBucket] = useState<number | null>(null)
	const [containerWidth, setContainerWidth] = useState(0)

	// Update container width on resize
	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setContainerWidth(entry.contentRect.width)
			}
		})

		observer.observe(container)
		setContainerWidth(container.clientWidth)

		return () => observer.disconnect()
	}, [])

	// Calculate time bounds - for relative ranges, use current time
	// This will auto-update as new logs come in
	const bounds = useMemo(() => {
		const rangeBounds = getTimeRangeBounds()

		// If we have logs and no explicit bounds, use log time range
		if (logs.length > 0) {
			const start = rangeBounds.start ?? logs[0].timestamp
			const end = rangeBounds.end ?? Date.now()
			return { start, end }
		}

		// Default to showing last hour if no logs
		const now = Date.now()
		return {
			start: rangeBounds.start ?? now - 60 * 60 * 1000,
			end: rangeBounds.end ?? now
		}
	}, [logs, getTimeRangeBounds, timeRange])

	// Get density data
	const density = useMemo(() => {
		return getLogDensity(BUCKET_COUNT, bounds.start, bounds.end)
	}, [getLogDensity, bounds, BUCKET_COUNT])

	// Find max for scaling
	const maxCount = useMemo(() => {
		return Math.max(...density, 1)
	}, [density])

	// Calculate bar width
	const barWidth = useMemo(() => {
		if (containerWidth <= 0) return 0
		const totalGaps = (BUCKET_COUNT - 1) * BAR_GAP
		return Math.max(2, (containerWidth - totalGaps) / BUCKET_COUNT)
	}, [containerWidth])

	// Format time axis labels
	const timeLabels = useMemo(() => {
		const labels: { position: number; label: string }[] = []
		const duration = bounds.end - bounds.start
		const totalWidth = barWidth * BUCKET_COUNT + BAR_GAP * (BUCKET_COUNT - 1)

		// Determine label interval based on duration
		let interval: number
		if (duration <= 60 * 60 * 1000) {
			// <= 1 hour: show every 10 minutes
			interval = 10 * 60 * 1000
		} else if (duration <= 6 * 60 * 60 * 1000) {
			// <= 6 hours: show every hour
			interval = 60 * 60 * 1000
		} else if (duration <= 24 * 60 * 60 * 1000) {
			// <= 24 hours: show every 3 hours
			interval = 3 * 60 * 60 * 1000
		} else if (duration <= 7 * 24 * 60 * 60 * 1000) {
			// <= 7 days: show every 12 hours
			interval = 12 * 60 * 60 * 1000
		} else {
			// > 7 days: show every day
			interval = 24 * 60 * 60 * 1000
		}

		// Find first label point after start
		const firstLabel = Math.ceil(bounds.start / interval) * interval

		for (let ts = firstLabel; ts < bounds.end; ts += interval) {
			const position = ((ts - bounds.start) / duration) * totalWidth
			const date = new Date(ts)

			let label: string
			if (interval >= 24 * 60 * 60 * 1000) {
				// Show date
				label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
			} else if (interval >= 60 * 60 * 1000) {
				// Show time
				label = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
			} else {
				// Show minutes
				label = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
			}

			labels.push({ position, label })
		}

		return labels
	}, [bounds, barWidth])

	// Handle bar click
	const handleBarClick = useCallback(
		(bucketIndex: number) => {
			if (!onSeekToTime) return

			const bucketDuration = (bounds.end - bounds.start) / BUCKET_COUNT
			const bucketStart = bounds.start + bucketIndex * bucketDuration
			const bucketMiddle = bucketStart + bucketDuration / 2

			onSeekToTime(bucketMiddle)
		},
		[bounds, onSeekToTime]
	)

	// Format tooltip
	const getTooltip = useCallback(
		(bucketIndex: number) => {
			const bucketDuration = (bounds.end - bounds.start) / BUCKET_COUNT
			const bucketStart = bounds.start + bucketIndex * bucketDuration
			const bucketEnd = bucketStart + bucketDuration
			const count = density[bucketIndex]

			const startStr = new Date(bucketStart).toLocaleTimeString(undefined, {
				hour: 'numeric',
				minute: '2-digit'
			})
			const endStr = new Date(bucketEnd).toLocaleTimeString(undefined, {
				hour: 'numeric',
				minute: '2-digit'
			})

			return `${count} logs\n${startStr} - ${endStr}`
		},
		[bounds, density]
	)

	if (logs.length === 0) {
		return (
			<div className={`${styles.container} ${styles.empty} ${className || ''}`}>
				<span className={styles.emptyText}>No logs to display</span>
			</div>
		)
	}

	return (
		<div className={`${styles.container} ${className || ''}`} ref={containerRef}>
			{/* Y-axis scale */}
			<div className={styles.yAxis}>
				<span className={styles.yLabel}>{maxCount}</span>
				<span className={styles.yLabel}>{Math.round(maxCount / 2)}</span>
				<span className={styles.yLabel}>0</span>
			</div>

			{/* Graph area */}
			<div className={styles.graphArea}>
				{/* Bars */}
				<div className={styles.bars}>
					{density.map((count, i) => {
						const height = (count / maxCount) * 100
						const isHovered = hoveredBucket === i

						return (
							<div
								key={i}
								className={`${styles.bar} ${isHovered ? styles.hovered : ''}`}
								style={{
									width: `${barWidth}px`,
									height: `${height}%`
								}}
								onMouseEnter={() => setHoveredBucket(i)}
								onMouseLeave={() => setHoveredBucket(null)}
								onClick={() => handleBarClick(i)}
								title={getTooltip(i)}
							/>
						)
					})}
				</div>

				{/* Grid lines */}
				<div className={styles.gridLines}>
					<div className={styles.gridLine} style={{ bottom: '100%' }} />
					<div className={styles.gridLine} style={{ bottom: '50%' }} />
					<div className={styles.gridLine} style={{ bottom: '0%' }} />
				</div>

				{/* Time axis */}
				<div className={styles.timeAxis}>
					{timeLabels.map(({ position, label }, i) => (
						<span key={i} className={styles.timeLabel} style={{ left: `${position}px` }}>
							{label}
						</span>
					))}
				</div>
			</div>
		</div>
	)
}
