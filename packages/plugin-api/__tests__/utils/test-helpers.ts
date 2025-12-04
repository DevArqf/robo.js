/**
 * Test Utilities for Tunnel CLI Tests
 *
 * Provides mock implementations and helper functions for testing.
 */
import { describe, expect, it } from '@jest/globals'
import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'

// Jest requires at least one test in a file located under __tests__
describe('Test Helpers', () => {
	it('createMockProcess creates a valid mock', () => {
		const proc = createMockProcess(12345)
		expect(proc.pid).toBe(12345)
	})

	it('createMockLogger captures log calls', () => {
		const logger = createMockLogger()
		logger.info('test message')
		expect(logger.hasMessage('test')).toBe(true)
	})

	it('createMockNanocore provides storage', async () => {
		const nanocore = createMockNanocore()
		await nanocore.set('key', 'value')
		const result = await nanocore.get('key')
		expect(result).toBe('value')
	})
})

/**
 * Create a mock ChildProcess for testing
 */
export function createMockProcess(pid: number = 12345): ChildProcess {
	const proc = new EventEmitter() as ChildProcess & {
		pid: number
		exitCode: number | null
		killed: boolean
	}

	// Use Object.defineProperty to set read-only properties
	Object.defineProperty(proc, 'pid', { value: pid, writable: true })
	Object.defineProperty(proc, 'exitCode', { value: null, writable: true })
	Object.defineProperty(proc, 'killed', { value: false, writable: true })

	proc.kill = (signal?: NodeJS.Signals | number) => {
		proc.killed = true
		proc.exitCode = 0
		proc.emit('exit', 0, signal)
		return true
	}

	proc.unref = () => {}

	return proc
}

/**
 * Logger call record
 */
export interface LoggerCall {
	level: string
	args: unknown[]
}

/**
 * Create a mock logger that captures calls
 */
export function createMockLogger() {
	const calls: LoggerCall[] = []

	const logger = {
		debug: (...args: unknown[]) => calls.push({ level: 'debug', args }),
		info: (...args: unknown[]) => calls.push({ level: 'info', args }),
		warn: (...args: unknown[]) => calls.push({ level: 'warn', args }),
		error: (...args: unknown[]) => calls.push({ level: 'error', args }),
		event: (...args: unknown[]) => calls.push({ level: 'event', args }),
		ready: (...args: unknown[]) => calls.push({ level: 'ready', args }),
		log: (...args: unknown[]) => calls.push({ level: 'log', args }),
		flush: async () => {},
		setup: () => {},
		fork: () => logger,
		calls,

		/**
		 * Check if any log message contains the given substring
		 */
		hasMessage: (substring: string): boolean =>
			calls.some((c) => c.args.some((a) => String(a).includes(substring))),

		/**
		 * Check if a specific level has a message containing the substring
		 */
		hasMessageAtLevel: (level: string, substring: string): boolean =>
			calls.filter((c) => c.level === level).some((c) => c.args.some((a) => String(a).includes(substring))),

		/**
		 * Get all messages at a specific level
		 */
		getMessagesAtLevel: (level: string): string[] =>
			calls.filter((c) => c.level === level).map((c) => c.args.map(String).join(' ')),

		/**
		 * Clear all captured calls
		 */
		clear: () => {
			calls.length = 0
		}
	}

	return logger
}

/**
 * Create mock Nanocore storage
 */
export function createMockNanocore() {
	const storage = new Map<string, unknown>()

	return {
		get: async (key: string) => storage.get(key),
		set: async (key: string, value: unknown) => {
			storage.set(key, value)
		},
		update: async (key: string, value: unknown) => {
			const existing = (storage.get(key) as object) ?? {}
			storage.set(key, { ...existing, ...(value as object) })
		},
		remove: async (key: string) => {
			storage.delete(key)
		},
		clear: () => storage.clear(),
		_storage: storage // For test inspection
	}
}

/**
 * Wait for a condition to be true (with timeout)
 */
export async function waitFor(
	condition: () => boolean | Promise<boolean>,
	timeout = 5000,
	interval = 50
): Promise<void> {
	const startTime = Date.now()

	while (Date.now() - startTime < timeout) {
		if (await condition()) {
			return
		}
		await new Promise((r) => setTimeout(r, interval))
	}

	throw new Error(`Timeout waiting for condition after ${timeout}ms`)
}

/**
 * Create a mock CLI context for testing CLI commands
 */
export function createMockCliContext<T extends object>(options: T, args: string[] = []) {
	const mockLogger = createMockLogger()

	return {
		args,
		argv: ['node', 'robo', 'tunnel', ...args],
		cwd: process.cwd(),
		options,
		logger: mockLogger,
		_mockLogger: mockLogger
	}
}
