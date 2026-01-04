import type { ILogRecorder, SessionLogEntry, SessionLogLevel } from '../types/index.js'

// Default maximum number of recorded logs before LRU eviction
const DEFAULT_MAX_LOGS = 10000

/**
 * LogRecorder manages captured logs for a session with memory management.
 * Uses LRU-style eviction to prevent unbounded memory growth.
 * Follows the same pattern as ActionRecorder.
 */
export class LogRecorder implements ILogRecorder {
	private logs: SessionLogEntry[] = []
	private maxLogs: number
	private idCounter = 0
	private sessionId: string

	constructor(sessionId: string, maxLogs: number = DEFAULT_MAX_LOGS) {
		this.sessionId = sessionId
		this.maxLogs = maxLogs
	}

	/**
	 * Record a new log entry
	 */
	record(entry: Omit<SessionLogEntry, 'id'>): SessionLogEntry {
		const logEntry: SessionLogEntry = {
			...entry,
			id: `log_${this.sessionId}_${++this.idCounter}`
		}

		this.logs.push(logEntry)

		// LRU eviction: remove oldest 10% when at capacity
		if (this.logs.length > this.maxLogs) {
			const removeCount = Math.floor(this.maxLogs * 0.1)
			this.logs = this.logs.slice(removeCount)
		}

		return logEntry
	}

	/**
	 * Get all recorded logs
	 */
	getAll(): SessionLogEntry[] {
		return [...this.logs]
	}

	/**
	 * Get logs since a specific timestamp
	 */
	getSince(timestamp: number): SessionLogEntry[] {
		return this.logs.filter((log) => log.timestamp >= timestamp)
	}

	/**
	 * Get logs by level
	 */
	getByLevel(level: SessionLogLevel): SessionLogEntry[] {
		return this.logs.filter((log) => log.level === level)
	}

	/**
	 * Get logs by multiple levels
	 */
	getByLevels(levels: SessionLogLevel[]): SessionLogEntry[] {
		const levelSet = new Set(levels)
		return this.logs.filter((log) => levelSet.has(log.level))
	}

	/**
	 * Get logs by connection ID (for multi-bot filtering)
	 */
	getByConnection(connectionId: string): SessionLogEntry[] {
		return this.logs.filter((log) => log.source.connectionId === connectionId)
	}

	/**
	 * Get logs containing search text in message or prefix
	 */
	search(query: string): SessionLogEntry[] {
		const queryLower = query.toLowerCase()
		return this.logs.filter(
			(log) =>
				log.message.toLowerCase().includes(queryLower) ||
				(log.prefix && log.prefix.toLowerCase().includes(queryLower))
		)
	}

	/**
	 * Get logs within a time range
	 */
	getInRange(startTime: number, endTime: number): SessionLogEntry[] {
		return this.logs.filter((log) => log.timestamp >= startTime && log.timestamp <= endTime)
	}

	/**
	 * Get error and warning logs
	 */
	getErrors(): SessionLogEntry[] {
		return this.getByLevels(['warn', 'error'])
	}

	/**
	 * Clear all recorded logs
	 */
	clear(): void {
		this.logs = []
		this.idCounter = 0
	}

	/**
	 * Get the number of recorded logs
	 */
	get length(): number {
		return this.logs.length
	}

	/**
	 * Get the maximum number of logs before eviction
	 */
	get maxLength(): number {
		return this.maxLogs
	}
}
