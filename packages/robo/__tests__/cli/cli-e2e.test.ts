
/**
 * CLI End-to-End Tests
 *
 * Tests the full CLI flow by building and running commands against
 * a real fixture project. This tests the actual robo build + robo <command> flow.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { execSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import { existsSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIR = path.join(__dirname, '../fixtures/test-project-ts')
// Use the actual JS entry point, not the shell wrapper
const ROBO_CLI = path.join(FIXTURE_DIR, 'node_modules/robo.js/dist/cli/index.js')

// Helper to run robo commands in the fixture directory
function runRobo(args: string, options: { expectError?: boolean } = {}): { stdout: string; stderr: string; exitCode: number } {
	try {
		const result = spawnSync('node', [ROBO_CLI, ...args.split(' ')], {
			cwd: FIXTURE_DIR,
			encoding: 'utf-8',
			timeout: 30000,
			env: {
				...process.env,
				// Disable color output for easier assertion matching
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

describe('CLI E2E Tests', () => {
	let buildSucceeded = false

	// Helper to skip test with proper message if build failed
	function requireBuild() {
		if (!buildSucceeded) {
			throw new Error('Skipped: Build failed in beforeAll')
		}
	}

	beforeAll(async () => {
		// Clean previous build artifacts
		const roboBuildDir = path.join(FIXTURE_DIR, '.robo')
		if (existsSync(roboBuildDir)) {
			rmSync(roboBuildDir, { recursive: true, force: true })
		}

		// Install dependencies if needed (pnpm should link workspace deps)
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

		// Build the fixture project
		try {
			const buildResult = execSync('node ' + ROBO_CLI + ' build', {
				cwd: FIXTURE_DIR,
				encoding: 'utf-8',
				timeout: 60000,
				env: {
					...process.env,
					NO_COLOR: '1'
				}
			})
			console.log('Build output:', buildResult)
			buildSucceeded = true
		} catch (error) {
			const execError = error as { message?: string; stdout?: string; stderr?: string }
			console.error('Build failed:', execError.message ?? String(error))
			console.error('stdout:', execError.stdout)
			console.error('stderr:', execError.stderr)
			buildSucceeded = false
		}
	}, 120000)

	afterAll(() => {
		// Optional: Clean up build artifacts after tests
		// Uncomment if you want clean state after each test run
		// const roboBuildDir = path.join(FIXTURE_DIR, '.robo')
		// if (existsSync(roboBuildDir)) {
		//   rmSync(roboBuildDir, { recursive: true, force: true })
		// }
	})

	describe('Build Verification', () => {
		it('should have successfully built the fixture project', () => {
			expect(buildSucceeded).toBe(true)
		})

		it('should have generated CLI manifest', () => {
			const manifestPath = path.join(FIXTURE_DIR, '.robo/manifest/cli/@.json')
			expect(existsSync(manifestPath)).toBe(true)
		})
	})

	describe('Simple Command Execution', () => {
		it('should run greet command with default options', () => {
			requireBuild()

			const result = runRobo('greet')

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('Hello, World!')
		})

		it('should run greet command with --name option', () => {
			requireBuild()

			const result = runRobo('greet --name Alice')

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('Hello, Alice!')
		})

		it('should run greet command with -n short alias', () => {
			requireBuild()

			const result = runRobo('greet -n Bob')

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('Hello, Bob!')
		})

		it('should run greet command with --loud boolean flag', () => {
			requireBuild()

			const result = runRobo('greet --loud')

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('HELLO, WORLD!')
		})

		it('should run greet command with multiple options', () => {
			requireBuild()

			const result = runRobo('greet --name Charlie --loud')

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('HELLO, CHARLIE!')
		})
	})

	describe('Subcommand Execution', () => {
		it('should run ship parent command', () => {
			requireBuild()

			const result = runRobo('ship')

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('Use a subcommand')
		})

		it('should run ship staging subcommand with defaults', () => {
			requireBuild()

			const result = runRobo('ship staging')

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('Shipping to staging')
			expect(result.stdout).toContain('main') // default branch
		})

		it('should run ship staging with --branch option', () => {
			requireBuild()

			const result = runRobo('ship staging --branch feature/test')

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('feature/test')
		})

		it('should run ship prod with required --tag option', () => {
			requireBuild()

			const result = runRobo('ship prod --tag v1.0.0')

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('Shipping to production')
			expect(result.stdout).toContain('v1.0.0')
		})

		it('should fail ship prod without required --tag option', () => {
			requireBuild()

			const result = runRobo('ship prod', { expectError: true })

			// Should exit with error for missing required option
			expect(result.exitCode).not.toBe(0)
		})
	})

	describe('Help Display', () => {
		it('should show help for greet command', () => {
			requireBuild()

			const result = runRobo('greet --help')

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('Greet someone')
			expect(result.stdout).toContain('--name')
			expect(result.stdout).toContain('--loud')
		})

		it('should show help for ship prod command', () => {
			requireBuild()

			const result = runRobo('ship prod --help')

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('Ship to production')
			expect(result.stdout).toContain('--tag')
			expect(result.stdout).toContain('--force')
		})
	})

	describe('Extension Hooks', () => {
		it('should run extension before hook for greet', () => {
			requireBuild()

			const result = runRobo('greet')

			expect(result.stdout).toContain('[greet extension] Before hook')
		})

		it('should run extension after hook for greet', () => {
			requireBuild()

			const result = runRobo('greet')

			expect(result.stdout).toContain('[greet extension] After hook')
		})

		it('should include extension options in greet help', () => {
			requireBuild()

			const result = runRobo('greet --help')

			// Extension added --count option
			expect(result.stdout).toContain('--count')
		})

		it('should run extension hooks for ship prod', () => {
			requireBuild()

			const result = runRobo('ship prod --tag v2.0.0')

			expect(result.stdout).toContain('[ship prod extension]')
		})
	})

	describe('Error Handling', () => {
		it('should show error for unknown command', () => {
			requireBuild()

			const result = runRobo('nonexistent', { expectError: true })

			expect(result.exitCode).not.toBe(0)
		})

		it('should handle invalid option value without crashing', () => {
			requireBuild()

			// --count expects a number, provide invalid value
			// The CLI should either coerce the value or show an error, but not crash
			const result = runRobo('greet --count notanumber')

			// Command should complete (either successfully with coerced value, or with validation error)
			// The key test is that it produces output and doesn't hang/crash
			expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0)
		})
	})
})
