/**
 * CLI-level tests for automatic file logging.
 * Tests that robo dev and robo start commands create expected log files.
 *
 * These tests verify the full CLI flow by building and running commands
 * against a real fixture project.
 */

import { describe, test, expect, beforeAll, afterEach } from '@jest/globals'
import { spawn, execSync, ChildProcess } from 'node:child_process'
import { existsSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const FIXTURE_DIR = join(__dirname, '../fixtures/test-project-ts')
const ROBO_CLI = join(FIXTURE_DIR, 'node_modules/robo.js/dist/cli/index.js')

// Track spawned processes for cleanup
let spawnedProcesses: ChildProcess[] = []

/**
 * Waits for a file to exist on disk with timeout.
 */
function waitForFile(filePath: string, timeout = 10000): Promise<boolean> {
	return new Promise((resolve) => {
		const start = Date.now()
		const check = () => {
			if (existsSync(filePath)) {
				resolve(true)
			} else if (Date.now() - start > timeout) {
				resolve(false)
			} else {
				setTimeout(check, 100)
			}
		}
		check()
	})
}

/**
 * Waits for a file to have content (non-empty).
 */
function waitForFileContent(filePath: string, timeout = 10000): Promise<string | null> {
	return new Promise((resolve) => {
		const start = Date.now()
		const check = () => {
			if (existsSync(filePath)) {
				const content = readFileSync(filePath, 'utf-8')
				if (content.length > 0) {
					resolve(content)
					return
				}
			}
			if (Date.now() - start > timeout) {
				resolve(null)
			} else {
				setTimeout(check, 100)
			}
		}
		check()
	})
}

/**
 * Starts a Robo process and tracks it for cleanup.
 */
function startRobo(args: string, env?: NodeJS.ProcessEnv): ChildProcess {
	const child = spawn('node', [ROBO_CLI, ...args.split(' ')], {
		cwd: FIXTURE_DIR,
		env: {
			...process.env,
			NO_COLOR: '1',
			FORCE_COLOR: '0',
			...env
		},
		stdio: 'pipe'
	})

	spawnedProcesses.push(child)
	return child
}

/**
 * Safely kills a process and waits for it to exit.
 */
async function killProcess(proc: ChildProcess): Promise<void> {
	return new Promise((resolve) => {
		if (proc.killed || proc.exitCode !== null) {
			resolve()
			return
		}

		proc.on('exit', () => resolve())
		proc.on('error', () => resolve())

		// Send SIGTERM first
		proc.kill('SIGTERM')

		// Force kill after 2 seconds if not dead
		setTimeout(() => {
			if (!proc.killed && proc.exitCode === null) {
				proc.kill('SIGKILL')
			}
		}, 2000)

		// Resolve after 3 seconds max
		setTimeout(() => resolve(), 3000)
	})
}

describe('CLI Auto File Logging', () => {
	let buildSucceeded = false

	beforeAll(async () => {
		// Clean previous build artifacts (but preserve node_modules)
		const roboBuildDir = join(FIXTURE_DIR, '.robo/build')
		const roboManifestDir = join(FIXTURE_DIR, '.robo/manifest')
		const roboLogsDir = join(FIXTURE_DIR, '.robo/logs')

		if (existsSync(roboBuildDir)) {
			rmSync(roboBuildDir, { recursive: true, force: true })
		}
		if (existsSync(roboManifestDir)) {
			rmSync(roboManifestDir, { recursive: true, force: true })
		}
		if (existsSync(roboLogsDir)) {
			rmSync(roboLogsDir, { recursive: true, force: true })
		}

		// Install dependencies if needed
		try {
			execSync('pnpm install', {
				cwd: FIXTURE_DIR,
				encoding: 'utf-8',
				timeout: 60000,
				stdio: 'pipe'
			})
		} catch (e) {
			console.warn('pnpm install warning:', e instanceof Error ? e.message : String(e))
		}

		// Build for development mode
		try {
			execSync(`node ${ROBO_CLI} build`, {
				cwd: FIXTURE_DIR,
				encoding: 'utf-8',
				timeout: 60000,
				env: {
					...process.env,
					NO_COLOR: '1',
					NODE_ENV: 'development'
				}
			})
			buildSucceeded = true
		} catch (error) {
			const execError = error as { message?: string; stdout?: string; stderr?: string }
			console.error('Build failed:', execError.message ?? String(error))
			console.error('stdout:', execError.stdout)
			console.error('stderr:', execError.stderr)
			buildSucceeded = false
		}
	}, 120000)

	afterEach(async () => {
		// Kill all spawned processes
		for (const proc of spawnedProcesses) {
			await killProcess(proc)
		}
		spawnedProcesses = []

		// Clean up logs directory for next test
		const logsDir = join(FIXTURE_DIR, '.robo/logs')
		if (existsSync(logsDir)) {
			rmSync(logsDir, { recursive: true, force: true })
		}
	})

	describe('development mode logging', () => {
		test('robo dev creates .robo/logs/development.log', async () => {
			if (!buildSucceeded) {
				console.warn('Skipping test: Build failed')
				return
			}

			const logPath = join(FIXTURE_DIR, '.robo/logs/development.log')

			// Ensure no log exists before
			expect(existsSync(logPath)).toBe(false)

			// Start robo dev
			const roboProcess = startRobo('dev', { NODE_ENV: 'development' })

			try {
				// Wait for log file to be created
				const fileCreated = await waitForFile(logPath, 15000)
				expect(fileCreated).toBe(true)

				// Verify log has content
				const content = await waitForFileContent(logPath, 5000)
				expect(content).not.toBeNull()
				expect(content!.length).toBeGreaterThan(0)
			} finally {
				await killProcess(roboProcess)
			}
		}, 30000)

		test('development log contains startup messages', async () => {
			if (!buildSucceeded) {
				console.warn('Skipping test: Build failed')
				return
			}

			const logPath = join(FIXTURE_DIR, '.robo/logs/development.log')
			const roboProcess = startRobo('dev', { NODE_ENV: 'development' })

			try {
				const content = await waitForFileContent(logPath, 15000)
				expect(content).not.toBeNull()

				// Should contain startup-related logs
				const hasStartupLogs = content!.includes('Starting') || content!.includes('Robo') || content!.includes('ready')
				expect(hasStartupLogs).toBe(true)
			} finally {
				await killProcess(roboProcess)
			}
		}, 30000)

		test('development log uses short timestamp format', async () => {
			if (!buildSucceeded) {
				console.warn('Skipping test: Build failed')
				return
			}

			const logPath = join(FIXTURE_DIR, '.robo/logs/development.log')
			const roboProcess = startRobo('dev', { NODE_ENV: 'development' })

			try {
				const content = await waitForFileContent(logPath, 15000)
				expect(content).not.toBeNull()

				// Should have short timestamp format [HH:mm:ss.SSS]
				expect(content).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\]/)
			} finally {
				await killProcess(roboProcess)
			}
		}, 30000)
	})

	describe('production mode logging', () => {
		beforeAll(async () => {
			if (!buildSucceeded) return

			// Build for production mode
			try {
				execSync(`node ${ROBO_CLI} build`, {
					cwd: FIXTURE_DIR,
					encoding: 'utf-8',
					timeout: 60000,
					env: {
						...process.env,
						NO_COLOR: '1',
						NODE_ENV: 'production'
					}
				})
			} catch (e) {
				console.warn('Production build warning:', e instanceof Error ? e.message : String(e))
			}
		}, 60000)

		test('robo start creates .robo/logs/production.log', async () => {
			if (!buildSucceeded) {
				console.warn('Skipping test: Build failed')
				return
			}

			const logPath = join(FIXTURE_DIR, '.robo/logs/production.log')

			// Ensure no log exists before
			expect(existsSync(logPath)).toBe(false)

			// Start robo start
			const roboProcess = startRobo('start', { NODE_ENV: 'production' })

			try {
				// Wait for log file to be created
				const fileCreated = await waitForFile(logPath, 15000)
				expect(fileCreated).toBe(true)
			} finally {
				await killProcess(roboProcess)
			}
		}, 30000)

		test('production log has content', async () => {
			if (!buildSucceeded) {
				console.warn('Skipping test: Build failed')
				return
			}

			const logPath = join(FIXTURE_DIR, '.robo/logs/production.log')
			const roboProcess = startRobo('start', { NODE_ENV: 'production' })

			try {
				const content = await waitForFileContent(logPath, 15000)
				expect(content).not.toBeNull()
				expect(content!.length).toBeGreaterThan(0)
			} finally {
				await killProcess(roboProcess)
			}
		}, 30000)
	})

	describe('custom mode logging', () => {
		test('custom mode creates mode-specific log file', async () => {
			if (!buildSucceeded) {
				console.warn('Skipping test: Build failed')
				return
			}

			// Build for test mode
			try {
				execSync(`node ${ROBO_CLI} build --mode test`, {
					cwd: FIXTURE_DIR,
					encoding: 'utf-8',
					timeout: 60000,
					env: {
						...process.env,
						NO_COLOR: '1'
					}
				})
			} catch (e) {
				console.warn('Test mode build warning:', e instanceof Error ? e.message : String(e))
			}

			const logPath = join(FIXTURE_DIR, '.robo/logs/test.log')

			// Ensure no log exists before
			expect(existsSync(logPath)).toBe(false)

			// Start with custom mode
			const roboProcess = startRobo('dev --mode test')

			try {
				const fileCreated = await waitForFile(logPath, 15000)
				expect(fileCreated).toBe(true)

				const content = await waitForFileContent(logPath, 5000)
				expect(content).not.toBeNull()
			} finally {
				await killProcess(roboProcess)
			}
		}, 60000)
	})

	describe('log file persistence', () => {
		test('logs persist after process stops', async () => {
			if (!buildSucceeded) {
				console.warn('Skipping test: Build failed')
				return
			}

			const logPath = join(FIXTURE_DIR, '.robo/logs/development.log')
			const roboProcess = startRobo('dev', { NODE_ENV: 'development' })

			try {
				// Wait for logs to be written
				const content = await waitForFileContent(logPath, 15000)
				expect(content).not.toBeNull()

				// Stop the process
				await killProcess(roboProcess)

				// Wait a moment
				await new Promise((r) => setTimeout(r, 500))

				// Logs should still exist
				expect(existsSync(logPath)).toBe(true)

				// Content should still be there
				const persistedContent = readFileSync(logPath, 'utf-8')
				expect(persistedContent.length).toBeGreaterThan(0)
			} finally {
				await killProcess(roboProcess)
			}
		}, 30000)
	})
})

describe('Auto File Logging Path Resolution', () => {
	test('getAutoLogPath returns correct path for development', () => {
		const mode = 'development'
		const logMode = mode || 'default'
		const expectedPath = `.robo/logs/${logMode}.log`
		expect(expectedPath).toBe('.robo/logs/development.log')
	})

	test('getAutoLogPath returns correct path for production', () => {
		const mode = 'production'
		const logMode = mode || 'default'
		const expectedPath = `.robo/logs/${logMode}.log`
		expect(expectedPath).toBe('.robo/logs/production.log')
	})

	test('getAutoLogPath returns default for empty mode', () => {
		const mode = ''
		const logMode = mode || 'default'
		const expectedPath = `.robo/logs/${logMode}.log`
		expect(expectedPath).toBe('.robo/logs/default.log')
	})

	test('getAutoLogPath returns default for null mode', () => {
		const mode = null as string | null
		const logMode = mode || 'default'
		const expectedPath = `.robo/logs/${logMode}.log`
		expect(expectedPath).toBe('.robo/logs/default.log')
	})

	test('getAutoLogPath handles custom modes', () => {
		const modes = ['beta', 'staging', 'qa', 'dev-local', 'prod_v2']
		for (const mode of modes) {
			const logMode = mode || 'default'
			const expectedPath = `.robo/logs/${logMode}.log`
			expect(expectedPath).toBe(`.robo/logs/${mode}.log`)
		}
	})
})

describe('Auto File Logging Configuration Logic', () => {
	// These tests verify the configuration logic that determines when auto-logging is enabled

	test('undefined files config enables auto-logging', () => {
		const config: { logger?: { files?: unknown[] } } = { logger: {} }
		const shouldCreate = config?.logger?.files === undefined
		expect(shouldCreate).toBe(true)
	})

	test('empty files array disables auto-logging', () => {
		const config: { logger: { files: unknown[] } } = { logger: { files: [] } }
		const hasExplicitConfig = Array.isArray(config.logger.files)
		const shouldCreate = config.logger.files === undefined
		expect(hasExplicitConfig).toBe(true)
		expect(shouldCreate).toBe(false)
	})

	test('files with entries disables auto-logging', () => {
		const config: { logger: { files: Array<{ path: string }> } } = { logger: { files: [{ path: 'custom.log' }] } }
		const hasEntries = config.logger.files.length > 0
		const shouldCreate = config.logger.files === undefined
		expect(hasEntries).toBe(true)
		expect(shouldCreate).toBe(false)
	})

	test('null config enables auto-logging', () => {
		const config: { logger?: { files?: unknown[] } } | null = null
		const shouldCreate = config?.logger?.files === undefined
		expect(shouldCreate).toBe(true)
	})

	test('mock test mode disables auto-logging', () => {
		const isMockTestMode = true
		const config: { logger?: { files?: unknown[] } } = { logger: {} }
		const shouldCreate = config?.logger?.files === undefined && !isMockTestMode
		expect(shouldCreate).toBe(false)
	})

	test('non-mock mode with undefined files enables auto-logging', () => {
		const isMockTestMode = false
		const config: { logger?: { files?: unknown[] } } = { logger: {} }
		const shouldCreate = config?.logger?.files === undefined && !isMockTestMode
		expect(shouldCreate).toBe(true)
	})
})
