import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LogDrain, Logger } from '../../src/core/logger.js'

/**
 * Creates a temporary directory for test log files.
 */
export function createTempLogDir(): string {
	return mkdtempSync(join(tmpdir(), 'robo-log-test-'))
}

/**
 * Removes a temporary directory and all its contents.
 */
export function cleanupTempDir(dir: string): void {
	rmSync(dir, { recursive: true, force: true })
}

/**
 * Reads a log file and returns its lines as an array.
 */
export function readLogFile(filePath: string): string[] {
	return readFileSync(filePath, 'utf-8').split('\n').filter(Boolean)
}

/**
 * Parses a JSON log line.
 */
export function parseJsonLogLine(line: string): { timestamp: string; level: string; message: string } {
	return JSON.parse(line)
}

/**
 * Creates a mock drain that captures all log calls.
 */
export function createMockDrain(): { drain: LogDrain; calls: Array<{ level: string; data: unknown[] }> } {
	const calls: Array<{ level: string; data: unknown[] }> = []
	const drain: LogDrain = async (_logger: Logger, level: string, ...data: unknown[]) => {
		calls.push({ level, data })
	}
	return { drain, calls }
}

/**
 * Creates a mock drain that delays by a specified amount.
 */
export function createDelayedMockDrain(
	delayMs: number
): { drain: LogDrain; calls: Array<{ level: string; data: unknown[] }> } {
	const calls: Array<{ level: string; data: unknown[] }> = []
	const drain: LogDrain = async (_logger: Logger, level: string, ...data: unknown[]) => {
		await new Promise((resolve) => setTimeout(resolve, delayMs))
		calls.push({ level, data })
	}
	return { drain, calls }
}

/**
 * Waits for a file to exist on disk.
 */
export async function waitForFile(filePath: string, timeout = 1000): Promise<void> {
	const { existsSync } = await import('node:fs')
	const start = Date.now()
	while (!existsSync(filePath)) {
		if (Date.now() - start > timeout) {
			throw new Error(`File ${filePath} not created within ${timeout}ms`)
		}
		await new Promise((r) => setTimeout(r, 10))
	}
}

/**
 * Creates a string of specified length.
 */
export function createLargeString(sizeInBytes: number): string {
	return 'x'.repeat(sizeInBytes)
}
