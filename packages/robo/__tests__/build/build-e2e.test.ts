/**
 * Build System End-to-End Tests
 *
 * Tests the full build flow using a real fixture project.
 * This tests:
 * - Full build command execution
 * - Mode-specific build output
 * - Multiple mode builds coexisting
 * - Build output structure verification
 * - Manifest generation (mode-specific)
 *
 * These tests use the build-test-project fixture and run actual
 * robo build commands to verify end-to-end behavior.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { execSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import { existsSync, rmSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIR = path.join(__dirname, '../fixtures/build-test-project')
const ROBO_CLI = path.join(FIXTURE_DIR, 'node_modules/robo.js/dist/cli/index.js')

// Helper to run robo commands
function runRobo(
	args: string,
	options: { expectError?: boolean; cwd?: string; nodeEnv?: string } = {}
): { stdout: string; stderr: string; exitCode: number } {
	const cwd = options.cwd ?? FIXTURE_DIR
	try {
		const result = spawnSync('node', [ROBO_CLI, ...args.split(' ')], {
			cwd,
			encoding: 'utf-8',
			timeout: 60000,
			env: {
				...process.env,
				// Override NODE_ENV to prevent Jest's test mode from affecting build mode
				NODE_ENV: options.nodeEnv ?? 'production',
				NO_COLOR: '1',
				FORCE_COLOR: '0'
			}
		})

		return {
			stdout: result.stdout || '',
			stderr: result.stderr || '',
			exitCode: result.status ?? 1
		}
	} catch (error) {
		if (options.expectError) {
			return {
				stdout: '',
				stderr: error instanceof Error ? error.message : String(error),
				exitCode: 1
			}
		}
		throw error
	}
}

// Helper to clean build artifacts
function cleanBuildArtifacts() {
	const roboBuildDir = path.join(FIXTURE_DIR, '.robo')
	if (existsSync(roboBuildDir)) {
		rmSync(roboBuildDir, { recursive: true, force: true })
	}
}

describe('Build E2E Tests', () => {
	let fixtureInstalled = false

	beforeAll(async () => {
		// Clean any previous build artifacts
		cleanBuildArtifacts()

		// Install dependencies
		try {
			execSync('pnpm install', {
				cwd: FIXTURE_DIR,
				encoding: 'utf-8',
				timeout: 60000,
				stdio: 'pipe'
			})
			fixtureInstalled = true
		} catch (e) {
			console.warn('pnpm install warning:', e instanceof Error ? e.message : String(e))
			// Check if robo.js is already linked
			fixtureInstalled = existsSync(path.join(FIXTURE_DIR, 'node_modules/robo.js'))
		}
	}, 120000)

	afterAll(() => {
		// Optional cleanup
		// cleanBuildArtifacts()
	})

	describe('Fixture Verification', () => {
		it('should have fixture project installed', () => {
			expect(fixtureInstalled).toBe(true)
			expect(existsSync(path.join(FIXTURE_DIR, 'node_modules/robo.js'))).toBe(true)
		})

		it('should have source files', () => {
			expect(existsSync(path.join(FIXTURE_DIR, 'src/commands/ping.ts'))).toBe(true)
			expect(existsSync(path.join(FIXTURE_DIR, 'src/commands/greet.ts'))).toBe(true)
			expect(existsSync(path.join(FIXTURE_DIR, 'tsconfig.json'))).toBe(true)
		})
	})

	describe('Production Build', () => {
		beforeEach(() => {
			// Clean before each build test
			cleanBuildArtifacts()
		})

		it('should build successfully with default mode (production)', () => {
			const result = runRobo('build')

			expect(result.exitCode).toBe(0)
			expect(existsSync(path.join(FIXTURE_DIR, '.robo/build/production'))).toBe(true)
		})

		it('should output compiled files to .robo/build/production/', () => {
			runRobo('build')

			const buildDir = path.join(FIXTURE_DIR, '.robo/build/production')
			expect(existsSync(path.join(buildDir, 'commands/ping.js'))).toBe(true)
			expect(existsSync(path.join(buildDir, 'commands/greet.js'))).toBe(true)
		})

		it('should generate manifest in .robo/manifest/production/', () => {
			runRobo('build')

			const manifestDir = path.join(FIXTURE_DIR, '.robo/manifest/production')
			expect(existsSync(manifestDir)).toBe(true)
			expect(existsSync(path.join(manifestDir, 'robo.json'))).toBe(true)
		})

		it('should compile TypeScript to JavaScript', () => {
			runRobo('build')

			const pingJs = path.join(FIXTURE_DIR, '.robo/build/production/commands/ping.js')
			const content = readFileSync(pingJs, 'utf-8')

			// Should be valid JavaScript (no type annotations)
			expect(content).not.toContain(': string')
			expect(content).toContain('pong')
		})

		it('should preserve nested directory structure', () => {
			runRobo('build')

			const nestedJs = path.join(FIXTURE_DIR, '.robo/build/production/commands/nested/deep.js')
			expect(existsSync(nestedJs)).toBe(true)
		})

		it('should copy non-TypeScript files', () => {
			runRobo('build')

			const configJson = path.join(FIXTURE_DIR, '.robo/build/production/data/config.json')
			expect(existsSync(configJson)).toBe(true)

			const content = JSON.parse(readFileSync(configJson, 'utf-8'))
			expect(content.name).toBe('build-test')
		})
	})

	describe('Development Build', () => {
		beforeEach(() => {
			cleanBuildArtifacts()
		})

		it('should build with --dev flag', () => {
			// Use NODE_ENV=development to ensure dev mode is used
			const result = runRobo('build --dev', { nodeEnv: 'development' })

			expect(result.exitCode).toBe(0)
			expect(existsSync(path.join(FIXTURE_DIR, '.robo/build/development'))).toBe(true)
		})

		it('should output to .robo/build/development/', () => {
			runRobo('build --dev', { nodeEnv: 'development' })

			const buildDir = path.join(FIXTURE_DIR, '.robo/build/development')
			expect(existsSync(path.join(buildDir, 'commands/ping.js'))).toBe(true)
		})

		it('should generate manifest in .robo/manifest/development/', () => {
			runRobo('build --dev', { nodeEnv: 'development' })

			const manifestDir = path.join(FIXTURE_DIR, '.robo/manifest/development')
			expect(existsSync(manifestDir)).toBe(true)
		})
	})

	describe('Custom Mode Build', () => {
		beforeEach(() => {
			cleanBuildArtifacts()
		})

		it('should build with --mode beta', () => {
			const result = runRobo('build --mode beta')

			expect(result.exitCode).toBe(0)
			expect(existsSync(path.join(FIXTURE_DIR, '.robo/build/beta'))).toBe(true)
		})

		it('should build with --mode staging', () => {
			const result = runRobo('build --mode staging')

			expect(result.exitCode).toBe(0)
			expect(existsSync(path.join(FIXTURE_DIR, '.robo/build/staging'))).toBe(true)
		})

		it('should generate mode-specific manifest', () => {
			runRobo('build --mode staging')

			expect(existsSync(path.join(FIXTURE_DIR, '.robo/manifest/staging'))).toBe(true)
			expect(existsSync(path.join(FIXTURE_DIR, '.robo/manifest/staging/robo.json'))).toBe(true)
		})
	})

	describe('Multiple Mode Builds', () => {
		beforeEach(() => {
			cleanBuildArtifacts()
		})

		it('should support multiple mode builds coexisting', () => {
			// Build for multiple modes
			runRobo('build') // production
			runRobo('build --dev', { nodeEnv: 'development' }) // development
			runRobo('build --mode staging') // staging

			// All should exist
			expect(existsSync(path.join(FIXTURE_DIR, '.robo/build/production'))).toBe(true)
			expect(existsSync(path.join(FIXTURE_DIR, '.robo/build/development'))).toBe(true)
			expect(existsSync(path.join(FIXTURE_DIR, '.robo/build/staging'))).toBe(true)
		})

		it('should have independent manifests for each mode', () => {
			runRobo('build')
			runRobo('build --mode staging')

			// Both manifests should exist
			const prodManifest = JSON.parse(
				readFileSync(path.join(FIXTURE_DIR, '.robo/manifest/production/robo.json'), 'utf-8')
			)
			const stagingManifest = JSON.parse(
				readFileSync(path.join(FIXTURE_DIR, '.robo/manifest/staging/robo.json'), 'utf-8')
			)

			// Both should have mode info
			expect(prodManifest).toBeDefined()
			expect(stagingManifest).toBeDefined()
		})

		it('should not affect other mode builds when rebuilding one mode', () => {
			// Initial builds
			runRobo('build')
			runRobo('build --mode staging')

			// Get staging build time
			const stagingManifest1 = JSON.parse(
				readFileSync(path.join(FIXTURE_DIR, '.robo/manifest/staging/robo.json'), 'utf-8')
			)
			const stagingTime1 = stagingManifest1.buildTime

			// Wait a bit and rebuild production only (sync delay)
			const start = Date.now()
			while (Date.now() - start < 100) {
				/* wait */
			}

			runRobo('build')

			// Staging should be unchanged
			const stagingManifest2 = JSON.parse(
				readFileSync(path.join(FIXTURE_DIR, '.robo/manifest/staging/robo.json'), 'utf-8')
			)
			expect(stagingManifest2.buildTime).toBe(stagingTime1)
		})
	})

	describe('Build Output Verification', () => {
		beforeEach(() => {
			cleanBuildArtifacts()
		})

		it('should have correct file extensions in output', () => {
			runRobo('build')

			const buildDir = path.join(FIXTURE_DIR, '.robo/build/production/commands')
			const files = readdirSync(buildDir, { withFileTypes: true })

			// All command files should be .js (directories are allowed for nested commands)
			for (const entry of files) {
				if (!entry.name.startsWith('.')) {
					// Skip hidden files
					if (entry.isFile()) {
						expect(entry.name.endsWith('.js')).toBe(true)
					} else if (entry.isDirectory()) {
						// Directories are allowed (e.g., 'nested' for nested commands)
						expect(entry.name).toBe('nested')
					}
				}
			}
		})

		it('should compile build hooks', () => {
			runRobo('build')

			const hookDir = path.join(FIXTURE_DIR, '.robo/build/production/robo/build')
			expect(existsSync(path.join(hookDir, 'start.js'))).toBe(true)
			expect(existsSync(path.join(hookDir, 'complete.js'))).toBe(true)
		})

		it('should generate types in shared .robo/types/ (not mode-specific)', () => {
			runRobo('build')

			// Types are shared across modes
			expect(existsSync(path.join(FIXTURE_DIR, '.robo/types'))).toBe(true)
			// Should NOT have mode-specific types
			expect(existsSync(path.join(FIXTURE_DIR, '.robo/types/production'))).toBe(false)
		})
	})

	describe('Build Timing', () => {
		beforeEach(() => {
			cleanBuildArtifacts()
		})

		it('should complete build in reasonable time', () => {
			const start = Date.now()
			const result = runRobo('build')
			const duration = Date.now() - start

			expect(result.exitCode).toBe(0)
			// Build should complete in under 30 seconds for this small project
			expect(duration).toBeLessThan(30000)
		})
	})

	describe('Error Handling', () => {
		beforeEach(() => {
			cleanBuildArtifacts()
		})

		it('should handle build with invalid mode gracefully', () => {
			// Unusual characters in mode name - should still work
			const result = runRobo('build --mode test-mode-123')

			expect(result.exitCode).toBe(0)
			expect(existsSync(path.join(FIXTURE_DIR, '.robo/build/test-mode-123'))).toBe(true)
		})
	})
})

describe('Build E2E - Clean Build Verification', () => {
	beforeAll(() => {
		cleanBuildArtifacts()
	})

	afterAll(() => {
		// Leave artifacts for inspection if needed
	})

	it('should perform clean build from scratch', () => {
		const result = runRobo('build')

		expect(result.exitCode).toBe(0)

		// Verify complete build structure
		const buildDir = path.join(FIXTURE_DIR, '.robo/build/production')
		const manifestDir = path.join(FIXTURE_DIR, '.robo/manifest/production')

		expect(existsSync(buildDir)).toBe(true)
		expect(existsSync(manifestDir)).toBe(true)
		expect(existsSync(path.join(manifestDir, 'robo.json'))).toBe(true)
	})
})
