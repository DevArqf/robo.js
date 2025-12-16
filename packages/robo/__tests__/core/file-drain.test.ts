import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createFileDrain, formatTimestamp } from '../../src/core/file-drain.js'
import { Logger } from '../../src/core/logger.js'
import { cleanupTempDir, createTempLogDir, readLogFile, parseJsonLogLine, createLargeString } from '../utils/logging-test-helpers.js'

describe('createFileDrain', () => {
	let tempDir: string
	let testLogger: Logger

	beforeEach(() => {
		tempDir = createTempLogDir()
		testLogger = new Logger({ level: 'trace' })
	})

	afterEach(() => {
		cleanupTempDir(tempDir)
	})

	describe('basic functionality', () => {
		test('creates log file and parent directories if not exist', async () => {
			const logPath = join(tempDir, 'nested', 'deep', 'test.log')
			const drain = createFileDrain({ path: logPath, blocking: true })

			await drain(testLogger, 'info', 'test message')

			expect(existsSync(logPath)).toBe(true)
		})

		test('writes log entry to file', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({ path: logPath, blocking: true })

			await drain(testLogger, 'info', 'hello world')

			const content = readFileSync(logPath, 'utf-8')
			expect(content).toContain('hello world')
		})

		test('appends multiple entries to same file', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({ path: logPath, blocking: true })

			await drain(testLogger, 'info', 'message 1')
			await drain(testLogger, 'info', 'message 2')
			await drain(testLogger, 'info', 'message 3')

			const lines = readLogFile(logPath)
			expect(lines.length).toBe(3)
			expect(lines[0]).toContain('message 1')
			expect(lines[1]).toContain('message 2')
			expect(lines[2]).toContain('message 3')
		})

		test('includes level in output', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({ path: logPath, blocking: true })

			await drain(testLogger, 'error', 'test error')

			const content = readFileSync(logPath, 'utf-8')
			expect(content).toContain('[ERROR]')
		})

		test('includes message content in output', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({ path: logPath, blocking: true })

			await drain(testLogger, 'info', 'specific test content 12345')

			const content = readFileSync(logPath, 'utf-8')
			expect(content).toContain('specific test content 12345')
		})
	})

	describe('timestamp formatting', () => {
		test('includes ISO timestamp when timestamp: "iso"', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({ path: logPath, blocking: true, timestamp: 'iso' })

			await drain(testLogger, 'info', 'test')

			const content = readFileSync(logPath, 'utf-8')
			// ISO format: 2025-01-15T10:30:00.123Z
			expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\]/)
		})

		test('includes unix timestamp when timestamp: "unix"', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({ path: logPath, blocking: true, timestamp: 'unix' })

			await drain(testLogger, 'info', 'test')

			const content = readFileSync(logPath, 'utf-8')
			// Unix format: [1736937000123]
			expect(content).toMatch(/\[\d{13}\]/)
		})

		test('includes short timestamp when timestamp: "short"', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({ path: logPath, blocking: true, timestamp: 'short' })

			await drain(testLogger, 'info', 'test')

			const content = readFileSync(logPath, 'utf-8')
			// Short format: [10:30:00.123]
			expect(content).toMatch(/\[\d{2}:\d{2}:\d{2}.\d{3}\]/)
		})

		test('includes long timestamp when timestamp: "long"', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({ path: logPath, blocking: true, timestamp: 'long' })

			await drain(testLogger, 'info', 'test')

			const content = readFileSync(logPath, 'utf-8')
			// Long format: [2025-01-15 10:30:00.123]
			expect(content).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}.\d{3}\]/)
		})

		test('omits timestamp when timestamp: false', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({ path: logPath, blocking: true, timestamp: false })

			await drain(testLogger, 'info', 'test message')

			const content = readFileSync(logPath, 'utf-8')
			// Should start with [INFO] not a timestamp
			expect(content).toMatch(/^\[INFO\]/)
		})
	})

	describe('ANSI stripping', () => {
		test('strips ANSI codes from output by default', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({ path: logPath, blocking: true })

			// Simulate ANSI-colored message (red color)
			await drain(testLogger, 'info', '\x1b[31mred text\x1b[0m')

			const content = readFileSync(logPath, 'utf-8')
			expect(content).toContain('red text')
			expect(content).not.toContain('\x1b[31m')
			expect(content).not.toContain('\x1b[0m')
		})

		test('preserves ANSI codes when stripAnsi: false', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({ path: logPath, blocking: true, stripAnsi: false })

			await drain(testLogger, 'info', '\x1b[31mred text\x1b[0m')

			const content = readFileSync(logPath, 'utf-8')
			expect(content).toContain('\x1b[31m')
		})
	})

	describe('level filtering', () => {
		test('writes all levels when no level filter set', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({ path: logPath, blocking: true })

			await drain(testLogger, 'trace', 'trace msg')
			await drain(testLogger, 'debug', 'debug msg')
			await drain(testLogger, 'info', 'info msg')
			await drain(testLogger, 'warn', 'warn msg')
			await drain(testLogger, 'error', 'error msg')

			const lines = readLogFile(logPath)
			expect(lines.length).toBe(5)
		})

		test('filters out levels below configured minimum', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({ path: logPath, blocking: true, level: 'warn' })

			await drain(testLogger, 'trace', 'trace msg')
			await drain(testLogger, 'debug', 'debug msg')
			await drain(testLogger, 'info', 'info msg')
			await drain(testLogger, 'warn', 'warn msg')
			await drain(testLogger, 'error', 'error msg')

			const lines = readLogFile(logPath)
			expect(lines.length).toBe(2) // Only warn and error
		})

		test('writes levels at or above configured minimum', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({ path: logPath, blocking: true, level: 'info' })

			await drain(testLogger, 'info', 'info msg')
			await drain(testLogger, 'warn', 'warn msg')
			await drain(testLogger, 'error', 'error msg')

			const lines = readLogFile(logPath)
			expect(lines.length).toBe(3)
			expect(lines.some((l) => l.includes('info msg'))).toBe(true)
			expect(lines.some((l) => l.includes('warn msg'))).toBe(true)
			expect(lines.some((l) => l.includes('error msg'))).toBe(true)
		})
	})

	describe('blocking mode', () => {
		test('blocking: logs are on disk immediately after await', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({ path: logPath, blocking: true })

			await drain(testLogger, 'info', 'blocking message')

			// Should be readable immediately without any flush
			const content = readFileSync(logPath, 'utf-8')
			expect(content).toContain('blocking message')
		})
	})

	describe('output format', () => {
		test('text format: [TIMESTAMP] [LEVEL] - message', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({ path: logPath, blocking: true, timestamp: 'iso', format: 'text' })

			await drain(testLogger, 'info', 'test message')

			const content = readFileSync(logPath, 'utf-8').trim()
			// Format: [TIMESTAMP] [LEVEL] - message
			expect(content).toMatch(/^\[.+\] \[INFO\] - test message$/)
		})

		test('json format: {"timestamp":...,"level":...,"message":...}', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({ path: logPath, blocking: true, timestamp: 'iso', format: 'json' })

			await drain(testLogger, 'info', 'json test')

			const lines = readLogFile(logPath)
			const parsed = parseJsonLogLine(lines[0])
			expect(parsed.level).toBe('info')
			expect(parsed.message).toContain('json test')
			expect(parsed.timestamp).toBeDefined()
		})

		test('handles objects in message data', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({ path: logPath, blocking: true })

			await drain(testLogger, 'info', 'Object:', { key: 'value', nested: { a: 1 } })

			const content = readFileSync(logPath, 'utf-8')
			expect(content).toContain('key')
			expect(content).toContain('value')
		})

		test('handles Error objects with stack traces', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({ path: logPath, blocking: true })

			const error = new Error('Test error')
			await drain(testLogger, 'error', 'Error occurred:', error)

			const content = readFileSync(logPath, 'utf-8')
			expect(content).toContain('Test error')
			expect(content).toContain('Error')
		})
	})

	describe('file rotation', () => {
		test('rotates file when maxSize exceeded', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({
				path: logPath,
				blocking: true,
				maxSize: 100, // 100 bytes
				maxFiles: 3
			})

			// Write enough to trigger rotation
			const largeMessage = createLargeString(80)
			await drain(testLogger, 'info', largeMessage)
			await drain(testLogger, 'info', largeMessage) // This should trigger rotation

			// Check that rotated file exists
			expect(existsSync(`${logPath}.1`)).toBe(true)
		})

		test('renames current file to .1 on rotation', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({
				path: logPath,
				blocking: true,
				maxSize: 50,
				maxFiles: 3
			})

			await drain(testLogger, 'info', createLargeString(40))
			const firstContent = readFileSync(logPath, 'utf-8')

			await drain(testLogger, 'info', createLargeString(40)) // Triggers rotation

			// Original content should now be in .1
			expect(existsSync(`${logPath}.1`)).toBe(true)
			const rotatedContent = readFileSync(`${logPath}.1`, 'utf-8')
			expect(rotatedContent).toBe(firstContent)
		})

		test('shifts existing rotated files (.1 -> .2, etc)', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({
				path: logPath,
				blocking: true,
				maxSize: 50,
				maxFiles: 5
			})

			// Create 3 rotations
			for (let i = 0; i < 4; i++) {
				await drain(testLogger, 'info', createLargeString(40) + `_v${i}`)
			}

			// Should have test.log, test.log.1, test.log.2, test.log.3
			expect(existsSync(logPath)).toBe(true)
			expect(existsSync(`${logPath}.1`)).toBe(true)
			expect(existsSync(`${logPath}.2`)).toBe(true)
			expect(existsSync(`${logPath}.3`)).toBe(true)
		})

		test('deletes oldest file when maxFiles exceeded', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({
				path: logPath,
				blocking: true,
				maxSize: 50,
				maxFiles: 2
			})

			// Create enough rotations to exceed maxFiles
			for (let i = 0; i < 4; i++) {
				await drain(testLogger, 'info', createLargeString(40) + `_v${i}`)
			}

			// Should only have test.log and test.log.1 (maxFiles=2 means current + 1 rotated)
			expect(existsSync(logPath)).toBe(true)
			expect(existsSync(`${logPath}.1`)).toBe(true)
			// Older files should be deleted
		})

		test('respects maxFiles limit', async () => {
			const logPath = join(tempDir, 'test.log')
			const drain = createFileDrain({
				path: logPath,
				blocking: true,
				maxSize: 50,
				maxFiles: 3
			})

			// Create many rotations
			for (let i = 0; i < 10; i++) {
				await drain(testLogger, 'info', createLargeString(40) + `_v${i}`)
			}

			// Count actual rotated files
			let count = 0
			for (let i = 1; i <= 10; i++) {
				if (existsSync(`${logPath}.${i}`)) count++
			}

			// Should not exceed maxFiles - 1 rotated files
			expect(count).toBeLessThanOrEqual(2) // maxFiles=3 means 2 rotated files max
		})
	})
})

describe('formatTimestamp', () => {
	const testDate = new Date('2025-01-15T10:30:45.123Z')

	test('iso: returns ISO 8601 format', () => {
		expect(formatTimestamp(testDate, 'iso')).toBe('2025-01-15T10:30:45.123Z')
	})

	test('unix: returns milliseconds since epoch', () => {
		expect(formatTimestamp(testDate, 'unix')).toBe(String(testDate.getTime()))
	})

	test('short: returns time only', () => {
		expect(formatTimestamp(testDate, 'short')).toBe('10:30:45.123')
	})

	test('long: returns date and time with space', () => {
		expect(formatTimestamp(testDate, 'long')).toBe('2025-01-15 10:30:45.123')
	})

	test('false: returns null', () => {
		expect(formatTimestamp(testDate, false)).toBeNull()
	})
})
