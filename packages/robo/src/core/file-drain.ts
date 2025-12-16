import { existsSync, mkdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { appendFile, mkdir, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { ANSI_REGEX } from './logger.js'
import type { Logger, LogDrain } from './logger.js'
import type { FileDrainOptions, TimestampFormat } from '../types/config.js'

// Default values
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024 // 10MB
const DEFAULT_MAX_FILES = 5

// Log level priority values (must match logger.ts)
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
 * Formats a timestamp according to the specified format.
 *
 * @param date - The date to format
 * @param format - The timestamp format to use
 * @returns Formatted timestamp string, or null if format is false
 */
export function formatTimestamp(date: Date, format: TimestampFormat): string | null {
	if (!format) {
		return null
	}

	switch (format) {
		case 'iso':
			return date.toISOString()
		case 'unix':
			return String(date.getTime())
		case 'short':
			// Time only: HH:mm:ss.SSS
			return date.toISOString().split('T')[1].slice(0, -1)
		case 'long':
			// Date and time: YYYY-MM-DD HH:mm:ss.SSS
			return date.toISOString().replace('T', ' ').slice(0, -1)
		default:
			return date.toISOString()
	}
}

/**
 * Formats a log entry for file output.
 */
function formatLogEntry(
	level: string,
	data: unknown[],
	timestamp: TimestampFormat,
	format: 'text' | 'json',
	stripAnsi: boolean
): string {
	const now = new Date()
	const ts = formatTimestamp(now, timestamp)

	// Build message from data
	let message = data
		.map((item) => {
			if (item instanceof Error) {
				return `${item.message}\n${item.stack}`
			}
			if (typeof item === 'object' && item !== null) {
				try {
					return JSON.stringify(item, null, 2)
				} catch {
					return '[unserializable object]'
				}
			}
			return String(item)
		})
		.join(' ')

	// Strip ANSI codes if requested
	if (stripAnsi) {
		message = message.replace(ANSI_REGEX, '')
	}

	if (format === 'json') {
		return (
			JSON.stringify({
				timestamp: ts || now.toISOString(),
				level,
				message
			}) + '\n'
		)
	}

	// Plain text format
	const parts: string[] = []
	if (ts) {
		parts.push(`[${ts}]`)
	}
	parts.push(`[${level.toUpperCase()}]`)
	parts.push('-')
	parts.push(message)

	return parts.join(' ') + '\n'
}

/**
 * Rotates log files when the current file exceeds maxSize.
 * Uses synchronous operations to ensure rotation completes before new writes.
 */
function rotateFile(filePath: string, maxFiles: number): void {
	// Delete oldest if at limit
	const oldestPath = `${filePath}.${maxFiles - 1}`
	if (existsSync(oldestPath)) {
		unlinkSync(oldestPath)
	}

	// Shift existing rotated files (.1 -> .2, .2 -> .3, etc)
	for (let i = maxFiles - 2; i >= 1; i--) {
		const fromPath = `${filePath}.${i}`
		const toPath = `${filePath}.${i + 1}`
		if (existsSync(fromPath)) {
			renameSync(fromPath, toPath)
		}
	}

	// Rotate current file to .1
	if (existsSync(filePath)) {
		renameSync(filePath, `${filePath}.1`)
	}
}

/**
 * Creates a file-based log drain.
 *
 * This drain writes log entries to a file with support for:
 * - Timestamp formatting
 * - ANSI color code stripping
 * - Level filtering
 * - File rotation based on size
 * - Blocking and non-blocking write modes
 *
 * @param options - Configuration options for the file drain
 * @returns A LogDrain function that writes to the specified file
 *
 * @example
 * ```typescript
 * import { createFileDrain } from 'robo.js/logger.js'
 * import { logger } from 'robo.js'
 *
 * const drain = createFileDrain({
 *   path: 'logs/app.log',
 *   timestamp: 'iso',
 *   blocking: true
 * })
 *
 * logger().addDrain(drain, 'file-logger')
 * ```
 */
export function createFileDrain(options: FileDrainOptions): LogDrain {
	const {
		path: filePath,
		level: minLevel,
		timestamp = false,
		blocking = false,
		format = 'text',
		stripAnsi = true,
		maxSize = DEFAULT_MAX_SIZE,
		maxFiles = DEFAULT_MAX_FILES
	} = options

	// Resolve to absolute path
	const absolutePath = resolve(filePath)

	// Ensure directory exists (sync for initial setup)
	const dir = dirname(absolutePath)
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true })
	}

	// Track current file size for rotation decisions
	let currentSize = 0
	try {
		if (existsSync(absolutePath)) {
			currentSize = statSync(absolutePath).size
		}
	} catch {
		// File might not exist yet, that's fine
		currentSize = 0
	}

	// Track pending writes for non-blocking mode
	const pendingWrites: Promise<void>[] = []

	// Create the drain function
	const drain: LogDrain = async (logger: Logger, level: string, ...data: unknown[]): Promise<void> => {
		// Level filtering
		if (minLevel) {
			const levelValues = logger.getLevelValues()
			const minLevelValue = levelValues[minLevel] ?? LogLevelValues[minLevel] ?? 0
			const currentLevelValue = levelValues[level] ?? LogLevelValues[level] ?? 0

			if (minLevelValue > currentLevelValue) {
				return
			}
		}

		// Format the log entry
		const entry = formatLogEntry(level, data, timestamp, format, stripAnsi)
		const entryBytes = Buffer.byteLength(entry, 'utf8')

		// Check if rotation is needed
		if (maxSize > 0 && currentSize + entryBytes > maxSize) {
			// Wait for pending writes before rotation
			if (pendingWrites.length > 0) {
				await Promise.allSettled(pendingWrites)
				pendingWrites.length = 0
			}

			rotateFile(absolutePath, maxFiles)
			currentSize = 0
		}

		// Write to file
		if (blocking) {
			// Blocking mode: use sync write for immediate disk persistence
			try {
				// Ensure directory exists (in case it was deleted)
				const dir = dirname(absolutePath)
				if (!existsSync(dir)) {
					mkdirSync(dir, { recursive: true })
				}

				// Append to file synchronously
				writeFileSync(absolutePath, entry, { flag: 'a', encoding: 'utf8' })
				currentSize += entryBytes
			} catch (error) {
				// Log write errors to console as fallback
				console.error('[file-drain] Write error:', error)
			}
		} else {
			// Non-blocking mode: fire-and-forget with tracking
			const writePromise = (async () => {
				try {
					// Ensure directory exists
					const dir = dirname(absolutePath)
					try {
						await stat(dir)
					} catch {
						await mkdir(dir, { recursive: true })
					}

					await appendFile(absolutePath, entry, 'utf8')
					currentSize += entryBytes
				} catch (error) {
					// Log write errors to console as fallback
					console.error('[file-drain] Write error:', error)
				}
			})()

			pendingWrites.push(writePromise)

			// Clean up completed promises
			writePromise.finally(() => {
				const idx = pendingWrites.indexOf(writePromise)
				if (idx > -1) {
					pendingWrites.splice(idx, 1)
				}
			})
		}
	}

	// Attach flush method to drain for cleanup
	;(drain as LogDrain & { flush: () => Promise<void> }).flush = async () => {
		if (pendingWrites.length > 0) {
			await Promise.allSettled(pendingWrites)
			pendingWrites.length = 0
		}
	}

	return drain
}
