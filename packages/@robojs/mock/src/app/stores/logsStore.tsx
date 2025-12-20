import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react'
import type { SessionLogEntry, SessionLogLevel } from '../../types/index.js'
import { stripAnsi } from '../components/logs/AnsiText.js'

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'stage_logs_open'
const WIDTH_STORAGE_KEY = 'stage_logs_width'
const TIME_RANGE_STORAGE_KEY = 'stage_logs_time_range'
const RECENT_RANGES_STORAGE_KEY = 'stage_logs_recent_ranges'
const DEFAULT_WIDTH = 400
const MIN_WIDTH = 240
const MAX_WIDTH_RATIO = 0.5 // 50% of viewport
const MAX_RECENT_RANGES = 5

// ============================================================================
// Time Range Types
// ============================================================================

export type RelativeTimeRange =
	| 'last30m'
	| 'last1h'
	| 'last3h'
	| 'last6h'
	| 'last12h'
	| 'last24h'
	| 'last2d'
	| 'last7d'
	| 'last14d'
	| 'last30d'
	| 'everything'

export interface TimeRange {
	type: 'relative' | 'custom'
	relative?: RelativeTimeRange
	customStart?: number
	customEnd?: number
}

export interface CustomRangeEntry {
	start: number
	end: number
	label: string
}

/** Mapping of relative time range to milliseconds */
export const RELATIVE_RANGE_MS: Record<RelativeTimeRange, number | null> = {
	last30m: 30 * 60 * 1000,
	last1h: 60 * 60 * 1000,
	last3h: 3 * 60 * 60 * 1000,
	last6h: 6 * 60 * 60 * 1000,
	last12h: 12 * 60 * 60 * 1000,
	last24h: 24 * 60 * 60 * 1000,
	last2d: 2 * 24 * 60 * 60 * 1000,
	last7d: 7 * 24 * 60 * 60 * 1000,
	last14d: 14 * 24 * 60 * 60 * 1000,
	last30d: 30 * 24 * 60 * 60 * 1000,
	everything: null // No limit
}

/** Labels for relative time ranges */
export const RELATIVE_RANGE_LABELS: Record<RelativeTimeRange, string> = {
	last30m: 'Last 30 minutes',
	last1h: 'Last 1 hour',
	last3h: 'Last 3 hours',
	last6h: 'Last 6 hours',
	last12h: 'Last 12 hours',
	last24h: 'Last 24 hours',
	last2d: 'Last 2 days',
	last7d: 'Last 7 days',
	last14d: 'Last 14 days',
	last30d: 'Last 30 days',
	everything: 'Everything'
}

const DEFAULT_TIME_RANGE: TimeRange = { type: 'relative', relative: 'everything' }

// ============================================================================
// Types
// ============================================================================

export interface LogFilters {
	/** Set of log levels to show (empty = show all) */
	levels: Set<SessionLogLevel>
	/** Search text filter */
	search: string
	/** Timestamp range start (ms) */
	timestampStart: number | null
	/** Timestamp range end (ms) */
	timestampEnd: number | null
	/** Whether to sync with playback time */
	usePlaybackRange: boolean
	/** Filter by session ID */
	sessionId: string | null
}

interface LogsContextValue {
	/** Whether the logs panel is open */
	isOpen: boolean
	/** Toggle panel open/closed */
	toggle: () => void
	/** Open the panel */
	open: () => void
	/** Close the panel */
	close: () => void
	/** Panel width in pixels */
	width: number
	/** Set panel width (clamped to min/max) */
	setWidth: (width: number) => void
	/** All log entries */
	logs: SessionLogEntry[]
	/** Add a single log entry */
	addLog: (log: SessionLogEntry) => void
	/** Add multiple log entries */
	addLogs: (logs: SessionLogEntry[]) => void
	/** Clear all logs */
	clearLogs: () => void
	/** Current filters */
	filters: LogFilters
	/** Set level filter */
	setLevelFilter: (levels: Set<SessionLogLevel>) => void
	/** Toggle a specific level in the filter */
	toggleLevelFilter: (level: SessionLogLevel) => void
	/** Set search filter */
	setSearchFilter: (search: string) => void
	/** Set timestamp range filter */
	setTimestampRange: (start: number | null, end: number | null) => void
	/** Toggle playback sync */
	setUsePlaybackRange: (use: boolean) => void
	/** Set session ID filter */
	setSessionFilter: (sessionId: string | null) => void
	/** Open the logs panel with a session filter pre-applied */
	openWithSessionFilter: (sessionId: string) => void
	/** Filtered logs based on current filters */
	filteredLogs: SessionLogEntry[]
	/** Get log density for timeline markers (returns array of counts per bucket) */
	getLogDensity: (bucketCount: number, startTime: number, endTime: number) => number[]
	/** Current time range for filtering */
	timeRange: TimeRange
	/** Set time range (relative or custom) */
	setTimeRange: (range: TimeRange) => void
	/** Recent custom time ranges */
	recentCustomRanges: CustomRangeEntry[]
	/** Add a custom range to history */
	addRecentRange: (range: CustomRangeEntry) => void
	/** Get the computed time bounds based on current time range (auto-updates for relative) */
	getTimeRangeBounds: () => { start: number | null; end: number | null }
	/** Get time-filtered logs based on current time range */
	timeFilteredLogs: SessionLogEntry[]
	/** Get the current time range label for display */
	getTimeRangeLabel: () => string
}

const LogsContext = createContext<LogsContextValue | null>(null)

// ============================================================================
// Provider
// ============================================================================

interface LogsProviderProps {
	children: ReactNode
}

export function LogsProvider({ children }: LogsProviderProps) {
	// Panel state
	const [isOpen, setIsOpen] = useState(() => {
		if (typeof window === 'undefined') return false
		const stored = localStorage.getItem(STORAGE_KEY)
		return stored === 'true'
	})

	const [width, setWidthState] = useState(() => {
		if (typeof window === 'undefined') return DEFAULT_WIDTH
		const stored = localStorage.getItem(WIDTH_STORAGE_KEY)
		const parsed = stored ? parseInt(stored, 10) : NaN
		return isNaN(parsed) ? DEFAULT_WIDTH : Math.max(MIN_WIDTH, parsed)
	})

	// Logs state
	const [logs, setLogs] = useState<SessionLogEntry[]>([])

	// Filters state
	const [filters, setFilters] = useState<LogFilters>({
		levels: new Set<SessionLogLevel>(),
		search: '',
		timestampStart: null,
		timestampEnd: null,
		usePlaybackRange: false,
		sessionId: null
	})

	// Time range state (Better Stack style)
	const [timeRange, setTimeRangeState] = useState<TimeRange>(() => {
		if (typeof window === 'undefined') return DEFAULT_TIME_RANGE
		try {
			const stored = localStorage.getItem(TIME_RANGE_STORAGE_KEY)
			if (stored) {
				return JSON.parse(stored) as TimeRange
			}
		} catch {
			// Invalid JSON, use default
		}
		return DEFAULT_TIME_RANGE
	})

	const [recentCustomRanges, setRecentCustomRanges] = useState<CustomRangeEntry[]>(() => {
		if (typeof window === 'undefined') return []
		try {
			const stored = localStorage.getItem(RECENT_RANGES_STORAGE_KEY)
			if (stored) {
				return JSON.parse(stored) as CustomRangeEntry[]
			}
		} catch {
			// Invalid JSON, use empty
		}
		return []
	})

	// Persist open state
	const toggle = useCallback(() => {
		setIsOpen((o) => {
			const newState = !o
			localStorage.setItem(STORAGE_KEY, String(newState))
			return newState
		})
	}, [])

	const open = useCallback(() => {
		setIsOpen(true)
		localStorage.setItem(STORAGE_KEY, 'true')
	}, [])

	const close = useCallback(() => {
		setIsOpen(false)
		localStorage.setItem(STORAGE_KEY, 'false')
	}, [])

	// Persist width
	const setWidth = useCallback((newWidth: number) => {
		const maxWidth = typeof window !== 'undefined' ? window.innerWidth * MAX_WIDTH_RATIO : 800
		const clamped = Math.min(Math.max(newWidth, MIN_WIDTH), maxWidth)
		setWidthState(clamped)
		localStorage.setItem(WIDTH_STORAGE_KEY, String(clamped))
	}, [])

	// Log management
	const addLog = useCallback((log: SessionLogEntry) => {
		setLogs((prev) => {
			const newLogs = [...prev, log]
			// LRU eviction at 10,000 entries (remove oldest 10%)
			if (newLogs.length > 10000) {
				return newLogs.slice(1000)
			}
			return newLogs
		})
	}, [])

	const addLogs = useCallback((newLogs: SessionLogEntry[]) => {
		setLogs((prev) => {
			const combined = [...prev, ...newLogs]
			// LRU eviction at 10,000 entries
			if (combined.length > 10000) {
				return combined.slice(combined.length - 9000)
			}
			return combined
		})
	}, [])

	const clearLogs = useCallback(() => {
		setLogs([])
	}, [])

	// Filter management
	const setLevelFilter = useCallback((levels: Set<SessionLogLevel>) => {
		setFilters((prev) => ({ ...prev, levels }))
	}, [])

	const toggleLevelFilter = useCallback((level: SessionLogLevel) => {
		setFilters((prev) => {
			const newLevels = new Set(prev.levels)
			if (newLevels.has(level)) {
				newLevels.delete(level)
			} else {
				newLevels.add(level)
			}
			return { ...prev, levels: newLevels }
		})
	}, [])

	const setSearchFilter = useCallback((search: string) => {
		setFilters((prev) => ({ ...prev, search }))
	}, [])

	const setTimestampRange = useCallback((start: number | null, end: number | null) => {
		setFilters((prev) => ({ ...prev, timestampStart: start, timestampEnd: end }))
	}, [])

	const setUsePlaybackRange = useCallback((use: boolean) => {
		setFilters((prev) => ({ ...prev, usePlaybackRange: use }))
	}, [])

	const setSessionFilter = useCallback((sessionId: string | null) => {
		setFilters((prev) => ({ ...prev, sessionId }))
	}, [])

	const openWithSessionFilter = useCallback((sessionId: string) => {
		setFilters((prev) => ({ ...prev, sessionId }))
		setIsOpen(true)
		localStorage.setItem(STORAGE_KEY, 'true')
	}, [])

	// Time range management
	const setTimeRange = useCallback((range: TimeRange) => {
		setTimeRangeState(range)
		localStorage.setItem(TIME_RANGE_STORAGE_KEY, JSON.stringify(range))
	}, [])

	const addRecentRange = useCallback((range: CustomRangeEntry) => {
		setRecentCustomRanges((prev) => {
			// Check for duplicates (same start/end)
			const filtered = prev.filter((r) => r.start !== range.start || r.end !== range.end)
			// Add new range at the beginning
			const updated = [range, ...filtered].slice(0, MAX_RECENT_RANGES)
			localStorage.setItem(RECENT_RANGES_STORAGE_KEY, JSON.stringify(updated))
			return updated
		})
	}, [])

	// Get computed time bounds based on current time range
	// For relative ranges, this auto-updates based on current time
	const getTimeRangeBounds = useCallback((): { start: number | null; end: number | null } => {
		if (timeRange.type === 'custom') {
			return {
				start: timeRange.customStart ?? null,
				end: timeRange.customEnd ?? null
			}
		}

		// Relative time range
		const relative = timeRange.relative ?? 'everything'
		const ms = RELATIVE_RANGE_MS[relative]

		if (ms === null) {
			// "Everything" - no bounds
			return { start: null, end: null }
		}

		const now = Date.now()
		return {
			start: now - ms,
			end: now
		}
	}, [timeRange])

	// Get human-readable label for current time range
	const getTimeRangeLabel = useCallback((): string => {
		if (timeRange.type === 'relative') {
			return RELATIVE_RANGE_LABELS[timeRange.relative ?? 'everything']
		}

		// Custom range - format dates
		const start = timeRange.customStart
		const end = timeRange.customEnd

		if (!start || !end) {
			return 'Custom range'
		}

		const formatDate = (ts: number): string => {
			const date = new Date(ts)
			return date.toLocaleDateString(undefined, {
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit'
			})
		}

		return `${formatDate(start)} - ${formatDate(end)}`
	}, [timeRange])

	// Time-filtered logs based on current time range
	const timeFilteredLogs = useMemo(() => {
		const bounds = getTimeRangeBounds()

		if (bounds.start === null && bounds.end === null) {
			return logs // "Everything" - no filtering
		}

		return logs.filter((log) => {
			if (bounds.start !== null && log.timestamp < bounds.start) {
				return false
			}
			if (bounds.end !== null && log.timestamp > bounds.end) {
				return false
			}
			return true
		})
	}, [logs, getTimeRangeBounds])

	// Filtered logs
	const filteredLogs = useMemo(() => {
		let result = logs

		// Filter by session ID
		if (filters.sessionId) {
			result = result.filter((log) => log.source?.sessionId === filters.sessionId)
		}

		// Filter by levels
		if (filters.levels.size > 0) {
			result = result.filter((log) => filters.levels.has(log.level))
		}

		// Filter by search (strip ANSI codes for searching)
		if (filters.search) {
			const searchLower = filters.search.toLowerCase()
			result = result.filter(
				(log) =>
					stripAnsi(log.message).toLowerCase().includes(searchLower) ||
					(log.prefix && log.prefix.toLowerCase().includes(searchLower))
			)
		}

		// Filter by timestamp range (when not using playback sync)
		if (!filters.usePlaybackRange) {
			if (filters.timestampStart !== null) {
				result = result.filter((log) => log.timestamp >= filters.timestampStart!)
			}
			if (filters.timestampEnd !== null) {
				result = result.filter((log) => log.timestamp <= filters.timestampEnd!)
			}
		}

		return result
	}, [logs, filters])

	// Log density for timeline visualization
	const getLogDensity = useCallback(
		(bucketCount: number, startTime: number, endTime: number): number[] => {
			if (logs.length === 0 || startTime >= endTime || bucketCount <= 0) {
				return new Array(bucketCount).fill(0)
			}

			const bucketSize = (endTime - startTime) / bucketCount
			const density = new Array(bucketCount).fill(0)

			for (const log of logs) {
				if (log.timestamp >= startTime && log.timestamp <= endTime) {
					const bucketIndex = Math.min(Math.floor((log.timestamp - startTime) / bucketSize), bucketCount - 1)
					density[bucketIndex]++
				}
			}

			return density
		},
		[logs]
	)

	// Listen for log_entry events from WebSocket
	useEffect(() => {
		const handleLogEntry = (event: CustomEvent<SessionLogEntry>) => {
			addLog(event.detail)
		}

		window.addEventListener('stage:log_entry', handleLogEntry as EventListener)
		return () => {
			window.removeEventListener('stage:log_entry', handleLogEntry as EventListener)
		}
	}, [addLog])

	// Listen for logs_history events (sent on state_sync with historical logs)
	useEffect(() => {
		const handleLogsHistory = (event: CustomEvent<SessionLogEntry[]>) => {
			addLogs(event.detail)
		}

		window.addEventListener('stage:logs_history', handleLogsHistory as EventListener)
		return () => {
			window.removeEventListener('stage:logs_history', handleLogsHistory as EventListener)
		}
	}, [addLogs])

	const value: LogsContextValue = {
		isOpen,
		toggle,
		open,
		close,
		width,
		setWidth,
		logs,
		addLog,
		addLogs,
		clearLogs,
		filters,
		setLevelFilter,
		toggleLevelFilter,
		setSearchFilter,
		setTimestampRange,
		setUsePlaybackRange,
		setSessionFilter,
		openWithSessionFilter,
		filteredLogs,
		getLogDensity,
		timeRange,
		setTimeRange,
		recentCustomRanges,
		addRecentRange,
		getTimeRangeBounds,
		timeFilteredLogs,
		getTimeRangeLabel
	}

	return <LogsContext.Provider value={value}>{children}</LogsContext.Provider>
}

// ============================================================================
// Hooks
// ============================================================================

export function useLogs(): LogsContextValue {
	const context = useContext(LogsContext)
	if (!context) {
		throw new Error('useLogs must be used within a LogsProvider')
	}
	return context
}

/**
 * Hook for just the panel state (open/close/width)
 */
export function useLogsPanel() {
	const { isOpen, toggle, open, close, width, setWidth, openWithSessionFilter } = useLogs()
	return { isOpen, toggle, open, close, width, setWidth, openWithSessionFilter }
}

/**
 * Hook for filtered logs and filter controls
 */
export function useLogsFilters() {
	const {
		filters,
		filteredLogs,
		setLevelFilter,
		toggleLevelFilter,
		setSearchFilter,
		setTimestampRange,
		setUsePlaybackRange,
		setSessionFilter
	} = useLogs()
	return {
		filters,
		filteredLogs,
		setLevelFilter,
		toggleLevelFilter,
		setSearchFilter,
		setTimestampRange,
		setUsePlaybackRange,
		setSessionFilter
	}
}

/**
 * Hook for log management
 */
export function useLogManagement() {
	const { logs, addLog, addLogs, clearLogs, getLogDensity } = useLogs()
	return { logs, addLog, addLogs, clearLogs, getLogDensity }
}

/**
 * Hook for time range controls (Better Stack style)
 */
export function useLogsTimeRange() {
	const {
		timeRange,
		setTimeRange,
		recentCustomRanges,
		addRecentRange,
		getTimeRangeBounds,
		timeFilteredLogs,
		getTimeRangeLabel
	} = useLogs()
	return {
		timeRange,
		setTimeRange,
		recentCustomRanges,
		addRecentRange,
		getTimeRangeBounds,
		timeFilteredLogs,
		getTimeRangeLabel
	}
}
