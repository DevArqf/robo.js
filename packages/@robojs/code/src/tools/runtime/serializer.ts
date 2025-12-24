/**
 * Tool execution serializer for @robojs/code SDK
 *
 * Ensures tool calls are executed strictly in order, even if the model
 * requests multiple parallel tool calls. This is critical for deterministic
 * behavior in coding workflows.
 */

import type { ExecutionQueueStats, QueuedExecution } from '../types.js'
import { codeLogger } from '../../core/logger.js'

/**
 * Serialized execution queue that processes items one at a time.
 *
 * Key guarantees:
 * - Items are processed in FIFO order
 * - Only one item executes at a time
 * - Failures do not block the queue
 * - Queue can be drained or aborted
 */
export class SerialExecutionQueue {
	private queue: QueuedExecution[] = []
	private isExecuting = false
	private totalProcessed = 0
	private totalExecutionTime = 0
	private aborted = false
	private idCounter = 0

	/**
	 * Enqueue an async operation for serial execution.
	 * Returns a promise that resolves when the operation completes.
	 */
	async enqueue<T>(execute: () => Promise<T>): Promise<T> {
		if (this.aborted) {
			throw new Error('Execution queue has been aborted')
		}

		const id = `exec-${++this.idCounter}`
		let resolve!: (value: T) => void
		let reject!: (error: Error) => void

		const promise = new Promise<T>((res, rej) => {
			resolve = res
			reject = rej
		})

		const item: QueuedExecution<T> = {
			id,
			execute,
			promise,
			resolve,
			reject,
			queuedAt: Date.now()
		}

		this.queue.push(item as QueuedExecution)
		codeLogger.debug(`Enqueued execution ${id}, queue length: ${this.queue.length}`)

		// Start processing if not already running
		this.processQueue()

		return promise
	}

	/**
	 * Process the queue serially
	 */
	private async processQueue(): Promise<void> {
		if (this.isExecuting || this.queue.length === 0) {
			return
		}

		this.isExecuting = true

		while (this.queue.length > 0 && !this.aborted) {
			const item = this.queue.shift()!
			const startTime = Date.now()

			codeLogger.debug(`Executing ${item.id}`)

			try {
				const result = await item.execute()
				const duration = Date.now() - startTime
				this.totalExecutionTime += duration
				this.totalProcessed++

				codeLogger.debug(`Completed ${item.id} in ${duration}ms`)
				item.resolve(result)
			} catch (error) {
				const duration = Date.now() - startTime
				this.totalExecutionTime += duration
				this.totalProcessed++

				codeLogger.debug(`Failed ${item.id} after ${duration}ms: ${error}`)
				item.reject(error instanceof Error ? error : new Error(String(error)))
			}
		}

		this.isExecuting = false
	}

	/**
	 * Get queue statistics
	 */
	getStats(): ExecutionQueueStats {
		return {
			queueLength: this.queue.length,
			isExecuting: this.isExecuting,
			totalProcessed: this.totalProcessed,
			totalExecutionTime: this.totalExecutionTime
		}
	}

	/**
	 * Wait for the queue to drain (all items processed)
	 */
	async drain(): Promise<void> {
		if (this.queue.length === 0 && !this.isExecuting) {
			return
		}

		// Wait for all pending items to complete
		const pending = this.queue.map((item) => item.promise.catch(() => {}))
		await Promise.all(pending)
	}

	/**
	 * Abort all pending operations.
	 * Currently executing operation will complete, but queued ones will be rejected.
	 */
	abort(reason = 'Queue aborted'): void {
		this.aborted = true

		// Reject all queued items
		while (this.queue.length > 0) {
			const item = this.queue.shift()!
			item.reject(new Error(reason))
		}

		codeLogger.debug(`Execution queue aborted: ${reason}`)
	}

	/**
	 * Reset the queue state (for reuse after abort)
	 */
	reset(): void {
		this.aborted = false
		this.queue = []
		this.isExecuting = false
	}

	/**
	 * Check if the queue is empty and not executing
	 */
	isIdle(): boolean {
		return this.queue.length === 0 && !this.isExecuting
	}

	/**
	 * Check if the queue has been aborted
	 */
	isAborted(): boolean {
		return this.aborted
	}
}

/**
 * Create a new serial execution queue
 */
export function createSerialQueue(): SerialExecutionQueue {
	return new SerialExecutionQueue()
}
