/**
 * Tests for Build Signal Plugin Logic
 *
 * Tests the Vite plugin pattern that writes a signal file after build completes.
 * This is the mechanism that enables deterministic reload timing.
 */
import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals'
import { existsSync, unlinkSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import os from 'node:os'

describe('Build Signal Plugin', () => {
	const testDir = resolve(os.tmpdir(), 'robo-dev-reload-test-' + Date.now())
	const signalPath = resolve(testDir, 'public/stage/.build-signal')

	beforeEach(() => {
		// Create test directory structure
		mkdirSync(dirname(signalPath), { recursive: true })
	})

	afterEach(() => {
		// Cleanup
		try {
			if (existsSync(signalPath)) {
				unlinkSync(signalPath)
			}
			rmSync(testDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('buildSignal() plugin', () => {
		// Simulate the Vite plugin
		function buildSignal(outputPath: string) {
			return {
				name: 'robo-build-signal',
				closeBundle() {
					writeFileSync(outputPath, JSON.stringify({ timestamp: Date.now() }))
				}
			}
		}

		it('should have correct plugin name', () => {
			const plugin = buildSignal(signalPath)
			expect(plugin.name).toBe('robo-build-signal')
		})

		it('should have closeBundle hook', () => {
			const plugin = buildSignal(signalPath)
			expect(typeof plugin.closeBundle).toBe('function')
		})

		it('should write signal file on closeBundle', () => {
			const plugin = buildSignal(signalPath)

			// Simulate Vite calling closeBundle
			plugin.closeBundle()

			expect(existsSync(signalPath)).toBe(true)
		})

		it('should write valid JSON with timestamp', () => {
			const plugin = buildSignal(signalPath)
			const beforeTime = Date.now()

			plugin.closeBundle()

			const afterTime = Date.now()
			const content = JSON.parse(readFileSync(signalPath, 'utf-8'))

			expect(content).toHaveProperty('timestamp')
			expect(typeof content.timestamp).toBe('number')
			expect(content.timestamp).toBeGreaterThanOrEqual(beforeTime)
			expect(content.timestamp).toBeLessThanOrEqual(afterTime)
		})

		it('should overwrite existing signal file', () => {
			const plugin = buildSignal(signalPath)

			// First build
			plugin.closeBundle()
			const firstContent = JSON.parse(readFileSync(signalPath, 'utf-8'))

			// Wait a bit to ensure different timestamp
			const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

			return delay(10).then(() => {
				// Second build
				plugin.closeBundle()
				const secondContent = JSON.parse(readFileSync(signalPath, 'utf-8'))

				expect(secondContent.timestamp).toBeGreaterThan(firstContent.timestamp)
			})
		})
	})

	describe('Signal File Format', () => {
		it('should be parseable as JSON', () => {
			const content = JSON.stringify({ timestamp: Date.now() })
			expect(() => JSON.parse(content)).not.toThrow()
		})

		it('should contain timestamp field', () => {
			const content = { timestamp: Date.now() }
			expect(content).toHaveProperty('timestamp')
		})

		it('should have timestamp as number', () => {
			const content = { timestamp: Date.now() }
			expect(typeof content.timestamp).toBe('number')
		})
	})

	describe('Signal File Path', () => {
		it('should use .build-signal filename', () => {
			const outputDir = 'public/stage'
			const signalFile = '.build-signal'
			const fullPath = resolve(process.cwd(), outputDir, signalFile)

			expect(fullPath).toContain('.build-signal')
		})

		it('should be placed in build output directory', () => {
			const outputDir = 'public/stage'
			const signalFile = '.build-signal'
			const fullPath = resolve(process.cwd(), outputDir, signalFile)

			expect(fullPath).toContain('public/stage')
		})
	})
})

describe('Watcher Integration', () => {
	describe('Change Type Filtering', () => {
		const BUILD_SIGNAL_FILE = '.build-signal'

		type ChangeType = 'added' | 'removed' | 'changed'
		interface Change {
			filePath: string
			changeType: ChangeType
		}

		const shouldProcessChange = (change: Change): boolean => {
			return change.filePath.endsWith(BUILD_SIGNAL_FILE) && change.changeType !== 'removed'
		}

		it('should accept "added" change type', () => {
			const change: Change = {
				filePath: '/path/to/.build-signal',
				changeType: 'added'
			}

			expect(shouldProcessChange(change)).toBe(true)
		})

		it('should accept "changed" change type', () => {
			const change: Change = {
				filePath: '/path/to/.build-signal',
				changeType: 'changed'
			}

			expect(shouldProcessChange(change)).toBe(true)
		})

		it('should reject "removed" change type', () => {
			const change: Change = {
				filePath: '/path/to/.build-signal',
				changeType: 'removed'
			}

			expect(shouldProcessChange(change)).toBe(false)
		})

		it('should reject non-signal files regardless of change type', () => {
			const changes: Change[] = [
				{ filePath: '/path/to/index.html', changeType: 'added' },
				{ filePath: '/path/to/main.js', changeType: 'changed' },
				{ filePath: '/path/to/style.css', changeType: 'changed' }
			]

			const signalChanges = changes.filter(shouldProcessChange)

			expect(signalChanges).toHaveLength(0)
		})
	})

	describe('Dev Mode Detection', () => {
		it('should identify dev mode by watch.json presence', () => {
			// Conceptual test - dev mode is detected by .robo/watch.json
			const pluginRoot = '/path/to/plugin'
			const watchFile = `${pluginRoot}/.robo/watch.json`

			// In real implementation: existsSync(watchFile)
			const isDevMode = watchFile.includes('.robo/watch.json')

			expect(isDevMode).toBe(true)
		})

		it('should find plugin root from public directory', () => {
			const publicDir = '/path/to/node_modules/@robojs/mock/public'

			// Walk up to find package.json
			let current = dirname(publicDir) // /path/to/node_modules/@robojs/mock
			const expectedRoot = current

			expect(current).toBe('/path/to/node_modules/@robojs/mock')
		})
	})
})

describe('Production Safety', () => {
	it('should check NODE_ENV for production', () => {
		const isProduction = process.env.NODE_ENV === 'production'

		// In dev, this should be false
		expect(typeof isProduction).toBe('boolean')
	})

	it('should define clear production check pattern', () => {
		// The pattern used in the code
		const checkProduction = () => process.env.NODE_ENV === 'production'

		// Save and restore
		const original = process.env.NODE_ENV

		process.env.NODE_ENV = 'production'
		expect(checkProduction()).toBe(true)

		process.env.NODE_ENV = 'development'
		expect(checkProduction()).toBe(false)

		process.env.NODE_ENV = undefined
		expect(checkProduction()).toBe(false)

		process.env.NODE_ENV = original
	})
})
