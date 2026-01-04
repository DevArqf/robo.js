/**
 * Terminal buffer utilities for @robojs/code SDK
 *
 * Provides bounded output buffering with drop-oldest truncation
 * to prevent OOM from streaming terminal logs.
 *
 * Browser-compatible: Uses TextEncoder for byte length calculation.
 */

/**
 * Calculate byte length of a string (browser-compatible)
 * Uses TextEncoder which is available in all modern browsers and Node.js
 */
function getByteLength(str: string): number {
	return new TextEncoder().encode(str).length
}

/**
 * Event emitted when buffer truncation occurs
 */
export interface TruncationEvent {
	type: 'terminal_truncated'
	sessionId: string
	droppedBytes: number
	totalDropped: number
	timestamp: number
}

/**
 * Callback for truncation events
 */
export type TruncationCallback = (event: TruncationEvent) => void

/**
 * Configuration for TerminalBuffer
 */
export interface TerminalBufferConfig {
	/**
	 * Maximum bytes to buffer (default: 5MB)
	 */
	maxBytes: number

	/**
	 * Session ID for truncation events
	 */
	sessionId: string

	/**
	 * Optional callback for truncation events
	 */
	onTruncate?: TruncationCallback
}

/**
 * Default max buffer size (5MB)
 */
export const DEFAULT_MAX_BUFFER_BYTES = 5_000_000

/**
 * A bounded terminal output buffer that drops oldest content when full.
 *
 * Features:
 * - Enforces maximum byte limit
 * - Drop-oldest truncation strategy
 * - Emits truncation events with dropped byte counts
 * - Tracks total bytes processed and dropped
 */
export class TerminalBuffer {
	private buffer: string[] = []
	private currentBytes: number = 0
	private totalDropped: number = 0
	private totalProcessed: number = 0
	private readonly maxBytes: number
	private readonly sessionId: string
	private readonly onTruncate?: TruncationCallback

	constructor(config: TerminalBufferConfig) {
		this.maxBytes = config.maxBytes || DEFAULT_MAX_BUFFER_BYTES
		this.sessionId = config.sessionId
		this.onTruncate = config.onTruncate
	}

	/**
	 * Append data to the buffer, truncating oldest content if needed
	 *
	 * @param data - The data to append
	 * @returns Number of bytes dropped during this append (0 if no truncation)
	 */
	append(data: string): number {
		if (!data) {
			return 0
		}

		const dataBytes = getByteLength(data)
		this.totalProcessed += dataBytes

		// If single chunk exceeds max, keep only the last maxBytes worth
		if (dataBytes >= this.maxBytes) {
			const dropped = this.currentBytes + (dataBytes - this.maxBytes)
			this.buffer = [data.slice(-this.maxBytes)]
			this.currentBytes = this.maxBytes
			this.totalDropped += dropped

			if (dropped > 0) {
				this.emitTruncation(dropped)
			}

			return dropped
		}

		// Append the new data
		this.buffer.push(data)
		this.currentBytes += dataBytes

		// Check if we need to truncate
		if (this.currentBytes > this.maxBytes) {
			return this.truncate()
		}

		return 0
	}

	/**
	 * Truncate oldest content to fit within maxBytes
	 *
	 * @returns Number of bytes dropped
	 */
	private truncate(): number {
		let droppedBytes = 0

		while (this.currentBytes > this.maxBytes && this.buffer.length > 1) {
			const oldest = this.buffer.shift()
			if (oldest) {
				const bytes = getByteLength(oldest)
				this.currentBytes -= bytes
				droppedBytes += bytes
			}
		}

		// If we only have one chunk and it's still too big, trim it
		if (this.buffer.length === 1 && this.currentBytes > this.maxBytes) {
			const excess = this.currentBytes - this.maxBytes
			this.buffer[0] = this.buffer[0].slice(excess)
			this.currentBytes = this.maxBytes
			droppedBytes += excess
		}

		if (droppedBytes > 0) {
			this.totalDropped += droppedBytes
			this.emitTruncation(droppedBytes)
		}

		return droppedBytes
	}

	/**
	 * Emit a truncation event
	 */
	private emitTruncation(droppedBytes: number): void {
		if (this.onTruncate) {
			this.onTruncate({
				type: 'terminal_truncated',
				sessionId: this.sessionId,
				droppedBytes,
				totalDropped: this.totalDropped,
				timestamp: Date.now()
			})
		}
	}

	/**
	 * Get the current buffered content
	 */
	getContent(): string {
		return this.buffer.join('')
	}

	/**
	 * Get the current buffer size in bytes
	 */
	getCurrentBytes(): number {
		return this.currentBytes
	}

	/**
	 * Get total bytes processed (including dropped)
	 */
	getTotalProcessed(): number {
		return this.totalProcessed
	}

	/**
	 * Get total bytes dropped due to truncation
	 */
	getTotalDropped(): number {
		return this.totalDropped
	}

	/**
	 * Check if any truncation has occurred
	 */
	wasTruncated(): boolean {
		return this.totalDropped > 0
	}

	/**
	 * Clear the buffer
	 */
	clear(): void {
		this.buffer = []
		this.currentBytes = 0
		// Note: we don't reset totalDropped/totalProcessed - these are lifetime stats
	}

	/**
	 * Get buffer statistics
	 */
	getStats(): TerminalBufferStats {
		return {
			currentBytes: this.currentBytes,
			maxBytes: this.maxBytes,
			totalProcessed: this.totalProcessed,
			totalDropped: this.totalDropped,
			chunkCount: this.buffer.length,
			wasTruncated: this.totalDropped > 0,
			utilizationPercent: (this.currentBytes / this.maxBytes) * 100
		}
	}
}

/**
 * Statistics about buffer state
 */
export interface TerminalBufferStats {
	currentBytes: number
	maxBytes: number
	totalProcessed: number
	totalDropped: number
	chunkCount: number
	wasTruncated: boolean
	utilizationPercent: number
}

/**
 * Create a new terminal buffer with default configuration
 *
 * @param sessionId - Session identifier
 * @param maxBytes - Maximum buffer size (default: 5MB)
 * @param onTruncate - Optional truncation callback
 */
export function createTerminalBuffer(
	sessionId: string,
	maxBytes: number = DEFAULT_MAX_BUFFER_BYTES,
	onTruncate?: TruncationCallback
): TerminalBuffer {
	return new TerminalBuffer({
		sessionId,
		maxBytes,
		onTruncate
	})
}

/**
 * Manager for multiple terminal buffers (one per session)
 */
export class TerminalBufferManager {
	private buffers: Map<string, TerminalBuffer> = new Map()
	private readonly defaultMaxBytes: number
	private readonly onTruncate?: TruncationCallback

	constructor(defaultMaxBytes: number = DEFAULT_MAX_BUFFER_BYTES, onTruncate?: TruncationCallback) {
		this.defaultMaxBytes = defaultMaxBytes
		this.onTruncate = onTruncate
	}

	/**
	 * Get or create a buffer for a session
	 */
	getOrCreate(sessionId: string, maxBytes?: number): TerminalBuffer {
		let buffer = this.buffers.get(sessionId)

		if (!buffer) {
			buffer = new TerminalBuffer({
				sessionId,
				maxBytes: maxBytes || this.defaultMaxBytes,
				onTruncate: this.onTruncate
			})
			this.buffers.set(sessionId, buffer)
		}

		return buffer
	}

	/**
	 * Get a buffer by session ID
	 */
	get(sessionId: string): TerminalBuffer | undefined {
		return this.buffers.get(sessionId)
	}

	/**
	 * Remove a buffer for a session
	 */
	remove(sessionId: string): boolean {
		return this.buffers.delete(sessionId)
	}

	/**
	 * Clear all buffers
	 */
	clear(): void {
		this.buffers.clear()
	}

	/**
	 * Get all session IDs
	 */
	getSessionIds(): string[] {
		return Array.from(this.buffers.keys())
	}

	/**
	 * Get aggregate statistics across all buffers
	 */
	getAggregateStats(): AggregateBufferStats {
		let totalCurrentBytes = 0
		let totalMaxBytes = 0
		let totalProcessed = 0
		let totalDropped = 0
		let truncatedCount = 0

		for (const buffer of this.buffers.values()) {
			const stats = buffer.getStats()
			totalCurrentBytes += stats.currentBytes
			totalMaxBytes += stats.maxBytes
			totalProcessed += stats.totalProcessed
			totalDropped += stats.totalDropped
			if (stats.wasTruncated) {
				truncatedCount++
			}
		}

		return {
			sessionCount: this.buffers.size,
			totalCurrentBytes,
			totalMaxBytes,
			totalProcessed,
			totalDropped,
			truncatedCount
		}
	}
}

/**
 * Aggregate statistics across multiple buffers
 */
export interface AggregateBufferStats {
	sessionCount: number
	totalCurrentBytes: number
	totalMaxBytes: number
	totalProcessed: number
	totalDropped: number
	truncatedCount: number
}
