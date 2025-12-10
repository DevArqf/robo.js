import { useState, useMemo, useRef, useEffect } from 'react'
import { usePlayback, type RecordedEvent } from '../../stores/playbackStore'
import type { StageEventType } from '../../types/stage'
import { JsonViewer } from './JsonViewer'
import styles from './EventLog.module.css'

// Event types that can be filtered
const EVENT_TYPES: { value: StageEventType | 'all'; label: string }[] = [
	{ value: 'all', label: 'All Events' },
	{ value: 'state_sync', label: 'State Sync' },
	{ value: 'message_create', label: 'Message Create' },
	{ value: 'message_update', label: 'Message Update' },
	{ value: 'message_delete', label: 'Message Delete' },
	{ value: 'interaction_create', label: 'Interaction' },
	{ value: 'interaction_response', label: 'Response' },
	{ value: 'typing_start', label: 'Typing' },
	{ value: 'message_reaction_add', label: 'Reaction Add' },
	{ value: 'message_reaction_remove', label: 'Reaction Remove' },
	{ value: 'connected', label: 'Connected' },
	{ value: 'heartbeat', label: 'Heartbeat' }
]

// Get badge color class for event type
function getEventTypeClass(type: StageEventType): string {
	switch (type) {
		case 'message_create':
		case 'message_update':
			return styles.message
		case 'interaction_create':
			return styles.interaction
		case 'interaction_response':
			return styles.response
		case 'typing_start':
			return styles.typing
		case 'state_sync':
			return styles.sync
		case 'message_reaction_add':
		case 'message_reaction_remove':
			return styles.reaction
		case 'connected':
			return styles.connected
		case 'heartbeat':
			return styles.heartbeat
		default:
			return ''
	}
}

// Get preview text for an event
function getEventPreview(event: RecordedEvent): string {
	const data = event.data as Record<string, unknown>

	switch (event.type) {
		case 'message_create': {
			const msg = data?.message as { author?: { username?: string }; content?: string } | undefined
			const author = msg?.author?.username || 'User'
			const content = msg?.content?.slice(0, 30) || ''
			return `${author}: ${content}${content.length >= 30 ? '...' : ''}`
		}
		case 'interaction_create': {
			const interaction = data?.interaction as { name?: string } | undefined
			return `/${interaction?.name || 'command'}`
		}
		case 'interaction_response': {
			const type = data?.type as number | undefined
			return `Type ${type || '?'}`
		}
		case 'typing_start': {
			const user = data?.user as { username?: string } | undefined
			return `${user?.username || 'User'} typing...`
		}
		case 'state_sync': {
			const guilds = (data?.guilds as unknown[])?.length || 0
			const channels = (data?.channels as unknown[])?.length || 0
			return `${guilds} guilds, ${channels} channels`
		}
		case 'message_reaction_add':
		case 'message_reaction_remove': {
			const emoji = data?.emoji as { name?: string } | undefined
			return emoji?.name || ''
		}
		default:
			return ''
	}
}

export function EventLog() {
	const { events } = usePlayback()
	const [selectedEvent, setSelectedEvent] = useState<RecordedEvent | null>(null)
	const [filter, setFilter] = useState<StageEventType | 'all'>('all')
	const [searchQuery, setSearchQuery] = useState('')
	const listRef = useRef<HTMLDivElement>(null)
	const [autoScroll, setAutoScroll] = useState(true)

	// Filter events
	const filteredEvents = useMemo(() => {
		let result = events

		// Filter by type
		if (filter !== 'all') {
			result = result.filter((e) => e.type === filter)
		}

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase()
			result = result.filter((e) => {
				const preview = getEventPreview(e).toLowerCase()
				const type = e.type.toLowerCase()
				const json = JSON.stringify(e.data).toLowerCase()
				return preview.includes(query) || type.includes(query) || json.includes(query)
			})
		}

		return result
	}, [events, filter, searchQuery])

	// Auto-scroll to bottom when new events arrive
	useEffect(() => {
		if (autoScroll && listRef.current) {
			listRef.current.scrollTop = listRef.current.scrollHeight
		}
	}, [filteredEvents.length, autoScroll])

	// Handle scroll to detect if user scrolled up
	const handleScroll = () => {
		if (!listRef.current) return
		const { scrollTop, scrollHeight, clientHeight } = listRef.current
		const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
		setAutoScroll(isAtBottom)
	}

	// Format timestamp
	const formatTime = (timestamp: number): string => {
		const date = new Date(timestamp)
		return date.toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			fractionalSecondDigits: 3
		})
	}

	return (
		<div className={styles.container}>
			{/* Left side - Event list */}
			<div className={styles.listPane}>
				{/* Filters */}
				<div className={styles.filters}>
					<select
						className={styles.typeFilter}
						value={filter}
						onChange={(e) => setFilter(e.target.value as StageEventType | 'all')}
					>
						{EVENT_TYPES.map((type) => (
							<option key={type.value} value={type.value}>
								{type.label}
							</option>
						))}
					</select>

					<input
						type="text"
						className={styles.searchInput}
						placeholder="Search events..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>

					<span className={styles.count}>{filteredEvents.length} events</span>
				</div>

				{/* Event list */}
				<div className={styles.eventList} ref={listRef} onScroll={handleScroll}>
					{filteredEvents.length === 0 ? (
						<div className={styles.empty}>No events recorded</div>
					) : (
						filteredEvents.map((event) => (
							<div
								key={event.id}
								className={`${styles.eventItem} ${selectedEvent?.id === event.id ? styles.selected : ''}`}
								onClick={() => setSelectedEvent(event)}
							>
								<span className={styles.seq}>#{event.seq}</span>
								<span className={`${styles.badge} ${getEventTypeClass(event.type)}`}>{event.type}</span>
								<span className={styles.preview}>{getEventPreview(event)}</span>
								<span className={styles.time}>{formatTime(event.timestamp)}</span>
							</div>
						))
					)}
				</div>
			</div>

			{/* Right side - Event detail */}
			<div className={styles.detailPane}>
				{selectedEvent ? (
					<>
						<div className={styles.detailHeader}>
							<span className={`${styles.badge} ${getEventTypeClass(selectedEvent.type)}`}>
								{selectedEvent.type}
							</span>
							<span className={styles.detailSeq}>#{selectedEvent.seq}</span>
							<span className={styles.detailTime}>{formatTime(selectedEvent.timestamp)}</span>
						</div>
						<div className={styles.detailContent}>
							<JsonViewer data={selectedEvent.data} collapsed={2} />
						</div>
					</>
				) : (
					<div className={styles.emptyDetail}>Select an event to view details</div>
				)}
			</div>
		</div>
	)
}
