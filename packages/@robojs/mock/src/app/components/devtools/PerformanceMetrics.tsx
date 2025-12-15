import { useMemo } from 'react'
import { usePlayback } from '../../stores/playbackStore'
import styles from './PerformanceMetrics.module.css'

export function PerformanceMetrics() {
	const { events } = usePlayback()

	// Calculate metrics
	const metrics = useMemo(() => {
		// Filter events by type
		const interactionEvents = events.filter((e) => e.type === 'interaction_create')
		const responseEvents = events.filter((e) => e.type === 'interaction_response')
		const messageEvents = events.filter((e) => e.type === 'message_create')

		// Calculate response times
		const responseTimes: number[] = []
		for (const interaction of interactionEvents) {
			const interactionData = interaction.data as { interaction?: { id?: string } }
			const interactionId = interactionData?.interaction?.id

			if (interactionId) {
				// Find the first response after this interaction
				const response = responseEvents.find((r) => {
					const responseData = r.data as { interactionId?: string }
					return (
						responseData?.interactionId === interactionId || r.timestamp > interaction.timestamp
					)
				})

				if (response && response.timestamp > interaction.timestamp) {
					responseTimes.push(response.timestamp - interaction.timestamp)
				}
			}
		}

		// Calculate average response time
		const avgResponseTime =
			responseTimes.length > 0
				? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
				: 0

		// Calculate events per minute
		let eventsPerMinute = 0
		if (events.length >= 2) {
			const duration = events[events.length - 1].timestamp - events[0].timestamp
			const minutes = duration / 60000
			if (minutes > 0) {
				eventsPerMinute = events.length / minutes
			}
		}

		// Event type breakdown
		const eventTypeBreakdown: Record<string, number> = {}
		for (const event of events) {
			eventTypeBreakdown[event.type] = (eventTypeBreakdown[event.type] || 0) + 1
		}

		// Sort by count
		const sortedBreakdown = Object.entries(eventTypeBreakdown)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 8) // Top 8 types

		return {
			totalEvents: events.length,
			interactions: interactionEvents.length,
			responses: responseEvents.length,
			messages: messageEvents.length,
			avgResponseTime,
			eventsPerMinute,
			breakdown: sortedBreakdown
		}
	}, [events])

	return (
		<div className={styles.container}>
			{/* Primary metrics */}
			<div className={styles.metricsGrid}>
				<MetricCard
					icon={<EventsIcon />}
					label="Total Events"
					value={metrics.totalEvents}
					color="normal"
				/>
				<MetricCard
					icon={<CommandIcon />}
					label="Interactions"
					value={metrics.interactions}
					color="brand"
				/>
				<MetricCard
					icon={<ResponseIcon />}
					label="Responses"
					value={metrics.responses}
					color="yellow"
				/>
				<MetricCard
					icon={<MessageIcon />}
					label="Messages"
					value={metrics.messages}
					color="green"
				/>
				<MetricCard
					icon={<TimerIcon />}
					label="Avg Response"
					value={`${metrics.avgResponseTime.toFixed(0)}ms`}
					color={metrics.avgResponseTime < 200 ? 'green' : metrics.avgResponseTime < 500 ? 'yellow' : 'red'}
				/>
				<MetricCard
					icon={<SpeedIcon />}
					label="Events/min"
					value={metrics.eventsPerMinute.toFixed(1)}
					color="normal"
				/>
			</div>

			{/* Event type breakdown */}
			<div className={styles.breakdown}>
				<h3 className={styles.breakdownTitle}>Event Type Breakdown</h3>
				<div className={styles.breakdownList}>
					{metrics.breakdown.length === 0 ? (
						<div className={styles.empty}>No events recorded</div>
					) : (
						metrics.breakdown.map(([type, count]) => (
							<div key={type} className={styles.breakdownItem}>
								<span className={styles.breakdownType}>{type}</span>
								<div className={styles.breakdownBar}>
									<div
										className={styles.breakdownFill}
										style={{
											width: `${(count / metrics.totalEvents) * 100}%`
										}}
									/>
								</div>
								<span className={styles.breakdownCount}>{count}</span>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	)
}

// Metric card component
interface MetricCardProps {
	icon: React.ReactNode
	label: string
	value: string | number
	color: 'normal' | 'brand' | 'green' | 'yellow' | 'red'
}

function MetricCard({ icon, label, value, color }: MetricCardProps) {
	return (
		<div className={`${styles.metricCard} ${styles[color]}`}>
			<div className={styles.metricIcon}>{icon}</div>
			<div className={styles.metricContent}>
				<span className={styles.metricValue}>{value}</span>
				<span className={styles.metricLabel}>{label}</span>
			</div>
		</div>
	)
}

// Icons
function EventsIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
			<path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h11A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11zM3 4v1h10V4H3zm0 3v1h10V7H3zm0 3v1h5v-1H3z" />
		</svg>
	)
}

function CommandIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
			<path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm3.5 1a.5.5 0 0 0-.354.854l2.146 2.146-2.146 2.146a.5.5 0 1 0 .708.708l2.5-2.5a.5.5 0 0 0 0-.708l-2.5-2.5A.5.5 0 0 0 3.5 3zM8 8.5a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1H8z" />
		</svg>
	)
}

function ResponseIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
			<path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z" />
		</svg>
	)
}

function MessageIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
			<path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4.414a1 1 0 0 0-.707.293L.854 15.146A.5.5 0 0 1 0 14.793V2zm5 4a1 1 0 1 0-2 0 1 1 0 0 0 2 0zm4 0a1 1 0 1 0-2 0 1 1 0 0 0 2 0zm3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
		</svg>
	)
}

function TimerIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
			<path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z" />
			<path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z" />
		</svg>
	)
}

function SpeedIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
			<path d="M8 2a.5.5 0 0 1 .5.5V4a.5.5 0 0 1-1 0V2.5A.5.5 0 0 1 8 2zM3.732 3.732a.5.5 0 0 1 .707 0l.915.914a.5.5 0 1 1-.708.708l-.914-.915a.5.5 0 0 1 0-.707zM2 8a.5.5 0 0 1 .5-.5h1.586a.5.5 0 0 1 0 1H2.5A.5.5 0 0 1 2 8zm9.5 0a.5.5 0 0 1 .5-.5h1.5a.5.5 0 0 1 0 1H12a.5.5 0 0 1-.5-.5zm.754-4.246a.389.389 0 0 0-.527-.02L7.547 7.31A.91.91 0 1 0 8.85 8.569l3.434-4.297a.389.389 0 0 0-.029-.518z" />
			<path d="M6.664 15.889A8 8 0 1 1 9.336.11a8 8 0 0 1-2.672 15.78zm-4.665-4.283A11.945 11.945 0 0 1 8 10c2.186 0 4.236.585 6.001 1.606a7 7 0 1 0-12.002 0z" />
		</svg>
	)
}
