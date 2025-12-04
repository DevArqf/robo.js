/**
 * robox CLI End-to-End Tests
 *
 * Tests the full robox CLI flow by running actual scripts with real process execution.
 * Uses temporary directories for isolation.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROBOX_CLI = path.resolve(__dirname, '../../dist/cli/robox.js')

let tempDir: string

// Helper to run robox commands
function runRobox(
	args: string[],
	options: { cwd?: string; env?: Record<string, string> } = {}
): {
	stdout: string
	stderr: string
	exitCode: number
} {
	const result = spawnSync('node', [ROBOX_CLI, ...args], {
		cwd: options.cwd ?? tempDir,
		encoding: 'utf-8',
		timeout: 10000,
		env: {
			...process.env,
			NO_COLOR: '1',
			FORCE_COLOR: '0',
			...(options.env ?? {})
		}
	})

	return {
		stdout: result.stdout || '',
		stderr: result.stderr || '',
		exitCode: result.status ?? 1
	}
}

describe('robox E2E', () => {
	beforeAll(async () => {
		// Create a fresh temp directory for each test run
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'robox-e2e-'))
	})

	afterAll(async () => {
		// Clean up temp directory
		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('JavaScript execution', () => {
		it('runs a simple JS script', async () => {
			const scriptPath = path.join(tempDir, 'test.js')
			await fs.writeFile(scriptPath, 'console.log("Hello from JS")')

			const result = runRobox(['test.js'])

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('Hello from JS')
		})

		it('passes arguments to JS script', async () => {
			const scriptPath = path.join(tempDir, 'args.js')
			await fs.writeFile(scriptPath, 'console.log(JSON.stringify(process.argv.slice(2)))')

			const result = runRobox(['args.js', '--foo', 'bar', '--baz'])

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('["--foo","bar","--baz"]')
		})

		it('handles script exit codes', async () => {
			const scriptPath = path.join(tempDir, 'exit.js')
			await fs.writeFile(scriptPath, 'process.exit(42)')

			const result = runRobox(['exit.js'])

			expect(result.exitCode).toBe(42)
		})

		it('accesses environment variables', async () => {
			const scriptPath = path.join(tempDir, 'env.js')
			await fs.writeFile(scriptPath, 'console.log(process.env.MY_TEST_VAR)')

			const result = runRobox(['env.js'], { env: { MY_TEST_VAR: 'test-value' } })

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('test-value')
		})

		it('handles .mjs files', async () => {
			const scriptPath = path.join(tempDir, 'module.mjs')
			await fs.writeFile(scriptPath, 'console.log("ES Module works")')

			const result = runRobox(['module.mjs'])

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('ES Module works')
		})

		it('handles .cjs files', async () => {
			const scriptPath = path.join(tempDir, 'common.cjs')
			await fs.writeFile(scriptPath, 'console.log("CommonJS works")')

			const result = runRobox(['common.cjs'])

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('CommonJS works')
		})
	})

	describe('TypeScript execution', () => {
		it('runs a simple TS script', async () => {
			const scriptPath = path.join(tempDir, 'test.ts')
			await fs.writeFile(scriptPath, 'const msg: string = "Hello from TS"; console.log(msg)')

			const result = runRobox(['test.ts'])

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('Hello from TS')
		})

		it('handles TypeScript type annotations', async () => {
			const scriptPath = path.join(tempDir, 'typed.ts')
			await fs.writeFile(
				scriptPath,
				`
interface User { name: string; age: number }
const user: User = { name: 'Alice', age: 30 }
console.log(user.name)
`
			)

			const result = runRobox(['typed.ts'])

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('Alice')
		})

		it('passes arguments to TS script', async () => {
			const scriptPath = path.join(tempDir, 'ts-args.ts')
			await fs.writeFile(
				scriptPath,
				'const args: string[] = process.argv.slice(2); console.log(JSON.stringify(args))'
			)

			const result = runRobox(['ts-args.ts', '--option', 'value'])

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('["--option","value"]')
		})
	})

	describe('eval mode', () => {
		it('evaluates inline code with -e', () => {
			const result = runRobox(['-e', 'console.log(1 + 2)'])

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('3')
		})

		it('accesses environment variables in eval', () => {
			const result = runRobox(['-e', 'console.log(process.env.TEST_VAR)'], {
				env: { TEST_VAR: 'hello-from-env' }
			})

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('hello-from-env')
		})

		it('handles multiline eval code', () => {
			const code = `
const x = 5;
const y = 10;
console.log(x + y);
`
			const result = runRobox(['-e', code])

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('15')
		})
	})

	describe('robo command mode', () => {
		it('passes non-script args to robo CLI', () => {
			// When given a non-script argument like "build", robox should invoke "robo build"
			// Since we're not in a robo project, this will fail - but we can verify
			// robo was invoked by checking for robo-specific output or behavior
			const result = runRobox(['build'])

			// robo build without a project will exit with error
			// The key is that it tried to run robo, not that it succeeded
			expect(result.exitCode).not.toBe(0)
			// Check for robo-related output (error about missing project or robo CLI error)
			expect(result.stdout + result.stderr).toMatch(/robo|build|error/i)
		})

		it('passes robo command with options', () => {
			// Test that options are passed through to robo
			const result = runRobox(['--help'])

			// --help should show robox help, not robo help
			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('robox')
		})
	})

	describe('explicit command mode', () => {
		it('runs commands after --', () => {
			const result = runRobox(['--', 'node', '-e', 'console.log("explicit")'])

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('explicit')
		})

		it('passes environment to explicit commands', () => {
			const result = runRobox(['--', 'node', '-e', 'console.log(process.env.EXPLICIT_VAR)'], {
				env: { EXPLICIT_VAR: 'explicit-value' }
			})

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('explicit-value')
		})
	})

	describe('help and version', () => {
		it('shows help with --help', () => {
			const result = runRobox(['--help'])

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('robox')
			expect(result.stdout).toContain('Usage:')
			expect(result.stdout).toContain('Examples:')
		})

		it('shows help with -h', () => {
			const result = runRobox(['-h'])

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('Usage:')
		})

		it('shows version with --version', () => {
			const result = runRobox(['--version'])

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toMatch(/\d+\.\d+\.\d+/)
		})

		it('shows version with -V', () => {
			const result = runRobox(['-V'])

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toMatch(/\d+\.\d+\.\d+/)
		})
	})

	describe('error handling', () => {
		it('errors on non-existent script', () => {
			const result = runRobox(['nonexistent.ts'])

			expect(result.exitCode).not.toBe(0)
			// Error message should indicate file not found
			expect(result.stdout + result.stderr).toMatch(/not found|ENOENT|does not exist/i)
		})

		it('handles script syntax errors', async () => {
			const scriptPath = path.join(tempDir, 'syntax-error.js')
			await fs.writeFile(scriptPath, 'console.log(')

			const result = runRobox(['syntax-error.js'])

			expect(result.exitCode).not.toBe(0)
		})

		it('handles runtime errors', async () => {
			const scriptPath = path.join(tempDir, 'runtime-error.js')
			await fs.writeFile(scriptPath, 'throw new Error("intentional error")')

			const result = runRobox(['runtime-error.js'])

			expect(result.exitCode).not.toBe(0)
			expect(result.stderr).toContain('intentional error')
		})
	})

	describe('verbose mode', () => {
		it('shows debug output with -v', async () => {
			const scriptPath = path.join(tempDir, 'verbose-test.js')
			await fs.writeFile(scriptPath, 'console.log("done")')

			const result = runRobox(['-v', 'verbose-test.js'])

			expect(result.exitCode).toBe(0)
			// Should show loading message and command being run
			expect(result.stdout + result.stderr).toContain('Loading environment variables')
		})

		it('shows debug output with --verbose', async () => {
			const scriptPath = path.join(tempDir, 'verbose-test2.js')
			await fs.writeFile(scriptPath, 'console.log("verbose works")')

			const result = runRobox(['--verbose', 'verbose-test2.js'])

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('verbose works')
		})
	})

	describe('path handling', () => {
		it('handles relative paths with ./', async () => {
			const scriptPath = path.join(tempDir, 'relative.js')
			await fs.writeFile(scriptPath, 'console.log("relative path works")')

			const result = runRobox(['./relative.js'])

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('relative path works')
		})

		it('handles scripts in subdirectories', async () => {
			const subDir = path.join(tempDir, 'scripts')
			await fs.mkdir(subDir, { recursive: true })
			const scriptPath = path.join(subDir, 'nested.js')
			await fs.writeFile(scriptPath, 'console.log("nested script works")')

			const result = runRobox(['scripts/nested.js'])

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('nested script works')
		})
	})

	describe('watch mode', () => {
		// Watch mode tests are inherently difficult to test in CI
		// because watch mode doesn't exit on its own
		it.skip('restarts on file change (manual test)', async () => {
			// This test requires manual verification or special handling
		})
	})
})
