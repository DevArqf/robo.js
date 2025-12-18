import type { Logger, LogDrain } from 'robo.js'
import type { SessionLogEntry, SessionLogLevel, LogSource } from '../types/index.js'

// ANSI escape code regex for stripping color codes from log messages
const ANSI_REGEX = /\x1b\[.*?m/g

/**
 * Options for creating a session log drain
 */
export interface SessionLogDrainOptions {
	/** Session ID to capture logs for */
	sessionId: string
	/** Gateway connection ID (for multi-bot identification) */
	connectionId: string
	/** Bot user info (optional, resolved after IDENTIFY) */
	botInfo?: {
		userId?: string
		username?: string
	}
	/** Callback when log is captured */
	onLog: (entry: Omit<SessionLogEntry, 'id'>) => void
	/** Minimum log level to capture (default: 'trace' - all logs) */
	minLevel?: SessionLogLevel
}

/**
 * Log level priority values for filtering
 */
const LogLevelValues: Record<string, number> = {
	trace: 0,
	debug: 1,
	info: 2,
	wait: 3,
	other: 4,
	event: 5,
	ready: 6,
	warn: 7,
	error: 8
}

/**
 * Creates a drain that captures logs for a session and forwards them to the callback.
 * Uses the DrainHandle pattern from robo.js for clean lifecycle management.
 *
 * @param options - Configuration for the session log drain
 * @returns A LogDrain function to be added via logger().addDrain()
 *
 * @example
 * ```typescript
 * import { logger } from 'robo.js'
 * import { createSessionLogDrain } from '@robojs/mock'
 *
 * const drain = createSessionLogDrain({
 *   sessionId: 'session_123',
 *   connectionId: 'conn_abc',
 *   botInfo: { userId: '12345', username: 'TestBot' },
 *   onLog: (entry) => session.recordLog(entry)
 * })
 *
 * // Add the drain (returns DrainHandle for cleanup)
 * const handle = logger().addDrain(drain, `session-${sessionId}`)
 *
 * // Later, when session ends
 * handle.remove()
 * ```
 */
export function createSessionLogDrain(options: SessionLogDrainOptions): LogDrain {
	const { sessionId, connectionId, botInfo, onLog, minLevel = 'trace' } = options
	const minLevelValue = LogLevelValues[minLevel] ?? 0

	return async (logger: Logger, level: string, ...data: unknown[]): Promise<void> => {
		// Level filtering
		const levelValue = LogLevelValues[level] ?? 4
		if (levelValue < minLevelValue) {
			return
		}

		// Build message from data, stripping ANSI codes
		const message = data
			.map((item) => {
				if (item instanceof Error) {
					return `${item.message}${item.stack ? '\n' + item.stack : ''}`
				}
				if (typeof item === 'string') {
					return item.replace(ANSI_REGEX, '')
				}
				try {
					return JSON.stringify(item)
				} catch {
					return '[unserializable]'
				}
			})
			.join(' ')

		// Extract prefix from logger (accessing protected property)
		const prefix = (logger as any)._prefix as string | undefined

		// Extract structured data (objects and errors for expandable details)
		const structuredData = data.filter((d) => typeof d === 'object' && d !== null)

		// Build log source
		const source: LogSource = {
			connectionId,
			sessionId,
			botUserId: botInfo?.userId,
			botUsername: botInfo?.username
		}

		// Create the log entry (without id - will be assigned by LogRecorder)
		const entry: Omit<SessionLogEntry, 'id'> = {
			timestamp: Date.now(),
			level: level as SessionLogLevel,
			message,
			prefix,
			source,
			data: structuredData.length > 0 ? structuredData : undefined
		}

		// Forward to callback (non-blocking)
		onLog(entry)
	}
}
