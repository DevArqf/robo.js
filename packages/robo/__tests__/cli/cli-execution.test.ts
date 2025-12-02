// @ts-nocheck
/**
 * Tests for CLI Execution Functions
 *
 * Tests executePluginCommand, runWithExtensions, getMergedOptionsForCommand,
 * showUnknownCommandError, and clearCliManifestCache with real filesystem operations.
 *
 * These tests verify actual behavior, not just implementation details.
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
	executePluginCommand,
	runWithExtensions,
	getMergedOptionsForCommand,
	showUnknownCommandError,
	clearCliManifestCache,
	loadCliManifest
} from '../../dist/cli/utils/cli-loader.js'

describe('CLI Execution Functions', () => {
	let tempDir: string
	let manifestDir: string
	let originalCwd: string
	let consoleLogSpy
	let consoleErrorSpy
	let processExitSpy
	let stderrWriteSpy
	let stdoutWriteSpy
	let stderrOutput: string[]
	let stdoutOutput: string[]

	beforeAll(async () => {
		// Create temp directory structure
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'robo-cli-exec-test-'))
		manifestDir = path.join(tempDir, '.robo', 'manifest', 'cli')
		await fs.mkdir(manifestDir, { recursive: true })

		// Save original cwd
		originalCwd = process.cwd()
	})

	afterAll(async () => {
		// Restore cwd
		process.chdir(originalCwd)
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	beforeEach(() => {
		// Change to temp directory so loadCliManifest finds our manifest
		process.chdir(tempDir)

		// Clear manifest cache before each test
		clearCliManifestCache()

		// Spy on console methods
		consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
		consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

		// Capture process.stderr.write and process.stdout.write for Robo logger output
		// The mock must handle the callback parameter to avoid logger.flush() hanging
		stderrOutput = []
		stdoutOutput = []
		stderrWriteSpy = jest.spyOn(process.stderr, 'write').mockImplementation((chunk, encodingOrCallback?, callback?) => {
			stderrOutput.push(String(chunk))
			// Handle callback (either 2nd or 3rd param depending on overload)
			const cb = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback
			if (cb) setImmediate(cb)
			return true
		})
		stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation((chunk, encodingOrCallback?, callback?) => {
			stdoutOutput.push(String(chunk))
			const cb = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback
			if (cb) setImmediate(cb)
			return true
		})

		// Mock process.exit to throw instead of terminating
		// This allows us to verify exit was called and with what code
		processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
			throw new Error(`process.exit(${code})`)
		})
	})

	afterEach(() => {
		consoleLogSpy.mockRestore()
		consoleErrorSpy.mockRestore()
		stderrWriteSpy.mockRestore()
		stdoutWriteSpy.mockRestore()
		processExitSpy.mockRestore()
	})

	// Helper to get all output from all sources
	const getAllOutput = () => {
		const logOutput = consoleLogSpy.mock.calls.map((c) => c.join(' ')).join('\n')
		const errorOutput = consoleErrorSpy.mock.calls.map((c) => c.join(' ')).join('\n')
		return {
			log: logOutput,
			error: errorOutput,
			stderr: stderrOutput.join(''),
			stdout: stdoutOutput.join(''),
			all: logOutput + '\n' + errorOutput + '\n' + stderrOutput.join('') + '\n' + stdoutOutput.join('')
		}
	}

	describe('clearCliManifestCache', () => {
		it('should allow fresh manifest to be loaded after cache clear', async () => {
			// Create initial manifest
			const manifest1 = {
				commands: {
					test: { path: '/test.js', plugin: null, description: 'Test', priority: 0 }
				},
				extensions: {}
			}
			await fs.writeFile(path.join(manifestDir, '@.json'), JSON.stringify(manifest1))

			// Load and cache
			const first = await loadCliManifest()
			expect(first?.commands['test']).toBeDefined()

			// Modify manifest file
			const manifest2 = {
				commands: {
					different: { path: '/different.js', plugin: null, description: 'Different', priority: 0 }
				},
				extensions: {}
			}
			await fs.writeFile(path.join(manifestDir, '@.json'), JSON.stringify(manifest2))

			// Without clearing cache, should still return old manifest
			const stillCached = await loadCliManifest()
			expect(stillCached?.commands['test']).toBeDefined()
			expect(stillCached?.commands['different']).toBeUndefined()

			// Clear cache
			clearCliManifestCache()

			// Now should load new manifest
			const fresh = await loadCliManifest()
			expect(fresh?.commands['different']).toBeDefined()
			expect(fresh?.commands['test']).toBeUndefined()
		})
	})

	describe('showUnknownCommandError', () => {
		it('should display error message with the unknown command name', async () => {
			const manifest = {
				commands: {
					dev: { path: '/dev.js', plugin: null, description: 'Dev mode', priority: 0 }
				},
				extensions: {}
			}

			try {
				await showUnknownCommandError('foobar', manifest)
			} catch (e) {
				// Expected - process.exit throws
			}

			const output = getAllOutput()
			// Should contain the exact error format from the implementation
			expect(output.all).toMatch(/command.*foobar.*does not exist/i)
		})

		it('should call process.exit(1) for unknown command', async () => {
			const manifest = {
				commands: {
					dev: { path: '/dev.js', plugin: null, description: 'Dev', priority: 0 }
				},
				extensions: {}
			}

			try {
				await showUnknownCommandError('unknown', manifest)
				// Should not reach here
				expect(true).toBe(false)
			} catch (e) {
				expect(e.message).toBe('process.exit(1)')
			}

			expect(processExitSpy).toHaveBeenCalledWith(1)
		})

		it('should suggest similar commands when partial match exists', async () => {
			const manifest = {
				commands: {
					deploy: { path: '/deploy.js', plugin: null, description: 'Deploy app', priority: 0 },
					'deploy staging': { path: '/deploy/staging.js', plugin: null, description: 'Deploy to staging', priority: 0 }
				},
				extensions: {}
			}

			try {
				await showUnknownCommandError('dep', manifest)
			} catch (e) {
				// Expected
			}

			const output = getAllOutput()
			// Should show "Did you mean" section with similar commands
			expect(output.log).toMatch(/did you mean/i)
			expect(output.log).toContain('deploy')
		})

		it('should show available commands when manifest has commands', async () => {
			const manifest = {
				commands: {
					start: { path: '/start.js', plugin: null, description: 'Start server', priority: 0 },
					stop: { path: '/stop.js', plugin: null, description: 'Stop server', priority: 0 }
				},
				extensions: {}
			}

			try {
				await showUnknownCommandError('xyz', manifest)
			} catch (e) {
				// Expected
			}

			const output = getAllOutput()
			// Should show available commands section
			expect(output.log).toMatch(/commands available/i)
		})

		it('should show help suggestion', async () => {
			const manifest = {
				commands: {
					dev: { path: '/dev.js', plugin: null, description: 'Dev', priority: 0 }
				},
				extensions: {}
			}

			try {
				await showUnknownCommandError('nonexistent', manifest)
			} catch (e) {
				// Expected
			}

			const output = getAllOutput()
			// Should suggest using --help
			expect(output.all).toMatch(/--help/i)
		})

		it('should handle null manifest gracefully', async () => {
			try {
				await showUnknownCommandError('anything', null)
			} catch (e) {
				expect(e.message).toBe('process.exit(1)')
			}

			const output = getAllOutput()
			expect(output.all).toMatch(/anything.*does not exist/i)
		})
	})

	describe('getMergedOptionsForCommand', () => {
		it('should include core options in result', async () => {
			// Remove manifest to test without extensions
			try {
				await fs.unlink(path.join(manifestDir, '@.json'))
			} catch {}
			clearCliManifestCache()

			const coreOptions = [
				{ alias: '-v', name: '--verbose', description: 'Verbose output' },
				{ alias: '-q', name: '--quiet', description: 'Quiet mode' }
			]

			const merged = await getMergedOptionsForCommand('dev', coreOptions)

			expect(merged.some((o) => o.name === '--verbose')).toBe(true)
			expect(merged.some((o) => o.name === '--quiet')).toBe(true)
		})

		it('should add help option when manifest exists with extensions', async () => {
			// Help option is added by mergeOptions, which is only called when manifest exists
			const manifest = {
				commands: {
					dev: { path: '/dev.js', plugin: null, description: 'Dev', priority: 0 }
				},
				extensions: {}
			}
			await fs.writeFile(path.join(manifestDir, '@.json'), JSON.stringify(manifest))
			clearCliManifestCache()

			const merged = await getMergedOptionsForCommand('dev', [])

			expect(merged.some((o) => o.name === '--help')).toBe(true)
			expect(merged.some((o) => o.alias === '-h')).toBe(true)
		})

		it('should return core options as-is when no manifest exists', async () => {
			// When no manifest, returns coreOptions directly without mergeOptions
			try {
				await fs.unlink(path.join(manifestDir, '@.json'))
			} catch {}
			clearCliManifestCache()

			const coreOptions = [{ alias: '-v', name: '--verbose', description: 'Verbose' }]
			const merged = await getMergedOptionsForCommand('dev', coreOptions)

			expect(merged).toEqual(coreOptions)
			// Help is NOT added because mergeOptions isn't called without manifest
		})

		it('should merge extension options from manifest', async () => {
			const ts = Date.now()
			const extFile = path.join(tempDir, `dev-ext-${ts}.mjs`)
			await fs.writeFile(
				extFile,
				`export const config = { options: [{ alias: '-w', name: '--watch', description: 'Watch mode' }] };
export function before() { return true; }`
			)

			const manifest = {
				commands: {
					dev: { path: '/dev.js', plugin: null, description: 'Dev', priority: 0 }
				},
				extensions: {
					dev: [
						{
							path: extFile,
							plugin: '@robojs/watch',
							priority: 0,
							hasBefore: true,
							options: [{ alias: '-w', name: '--watch', description: 'Watch mode' }]
						}
					]
				}
			}
			await fs.writeFile(path.join(manifestDir, '@.json'), JSON.stringify(manifest))
			clearCliManifestCache()

			const coreOptions = [{ alias: '-v', name: '--verbose', description: 'Verbose' }]
			const merged = await getMergedOptionsForCommand('dev', coreOptions)

			// Should have core option
			expect(merged.some((o) => o.name === '--verbose')).toBe(true)
			// Should have extension option
			expect(merged.some((o) => o.name === '--watch')).toBe(true)
			// Should have help option
			expect(merged.some((o) => o.name === '--help')).toBe(true)
		})
	})

	describe('runWithExtensions', () => {
		it('should execute handler and return its result when no extensions', async () => {
			try {
				await fs.unlink(path.join(manifestDir, '@.json'))
			} catch {}
			clearCliManifestCache()

			const result = await runWithExtensions('dev', [], {}, async () => {
				return { status: 'success', value: 42 }
			})

			expect(result).toEqual({ status: 'success', value: 42 })
		})

		it('should call handler without arguments (args/options are for extensions)', async () => {
			// Note: runWithExtensions passes args/options to extension hooks, not the handler
			// The handler signature is () => Promise<T> | T
			try {
				await fs.unlink(path.join(manifestDir, '@.json'))
			} catch {}
			clearCliManifestCache()

			let handlerCalledWithArgs = false
			await runWithExtensions(
				'dev',
				['file1.ts', 'file2.ts'],
				{ verbose: true, port: 3000 },
				async function () {
					// Handler receives no arguments - this verifies the function signature
					handlerCalledWithArgs = arguments.length > 0
					return 'done'
				}
			)

			expect(handlerCalledWithArgs).toBe(false)
		})

		it('should run before hooks before handler', async () => {
			const ts = Date.now()
			const extFile = path.join(tempDir, `before-hook-${ts}.mjs`)
			const executionOrder = []

			await fs.writeFile(
				extFile,
				`export const config = {};
export function before(ctx) {
	console.log('BEFORE_HOOK_EXECUTED');
	return true;
}`
			)

			const manifest = {
				commands: {
					dev: { path: '/dev.js', plugin: null, description: 'Dev', priority: 0 }
				},
				extensions: {
					dev: [{ path: extFile, plugin: '@test/plugin', priority: 0, hasBefore: true }]
				}
			}
			await fs.writeFile(path.join(manifestDir, '@.json'), JSON.stringify(manifest))
			clearCliManifestCache()

			await runWithExtensions('dev', [], {}, async () => {
				executionOrder.push('handler')
			})

			const output = getAllOutput()
			expect(output.log).toContain('BEFORE_HOOK_EXECUTED')
		})

		it('should abort execution when before hook returns false', async () => {
			const ts = Date.now()
			const extFile = path.join(tempDir, `abort-hook-${ts}.mjs`)
			await fs.writeFile(
				extFile,
				`export const config = {};
export function before(ctx) {
	console.log('ABORTING');
	return false;
}`
			)

			const manifest = {
				commands: {
					dev: { path: '/dev.js', plugin: null, description: 'Dev', priority: 0 }
				},
				extensions: {
					dev: [{ path: extFile, plugin: '@test/abort', priority: 0, hasBefore: true }]
				}
			}
			await fs.writeFile(path.join(manifestDir, '@.json'), JSON.stringify(manifest))
			clearCliManifestCache()

			let handlerExecuted = false
			const result = await runWithExtensions('dev', [], {}, async () => {
				handlerExecuted = true
				return 'should-not-reach'
			})

			expect(handlerExecuted).toBe(false)
			expect(result).toBeUndefined()
			expect(getAllOutput().log).toContain('ABORTING')
		})

		it('should run after hooks with handler result', async () => {
			const ts = Date.now()
			const extFile = path.join(tempDir, `after-hook-${ts}.mjs`)
			await fs.writeFile(
				extFile,
				`export const config = {};
export function after(ctx) {
	console.log('AFTER_RECEIVED:' + JSON.stringify(ctx.result));
}`
			)

			const manifest = {
				commands: {
					build: { path: '/build.js', plugin: null, description: 'Build', priority: 0 }
				},
				extensions: {
					build: [{ path: extFile, plugin: '@test/after', priority: 0, hasAfter: true }]
				}
			}
			await fs.writeFile(path.join(manifestDir, '@.json'), JSON.stringify(manifest))
			clearCliManifestCache()

			const result = await runWithExtensions('build', [], {}, async () => {
				return { built: true, files: 5 }
			})

			expect(result).toEqual({ built: true, files: 5 })
			const output = getAllOutput()
			expect(output.log).toContain('AFTER_RECEIVED:')
			expect(output.log).toContain('"built":true')
		})
	})

	describe('executePluginCommand', () => {
		it('should execute command handler successfully', async () => {
			const ts = Date.now()
			const cmdFile = path.join(tempDir, `exec-cmd-${ts}.mjs`)
			await fs.writeFile(
				cmdFile,
				`export const config = { description: 'Test command' };
export default function(ctx) {
	console.log('COMMAND_EXECUTED');
	return { success: true };
}`
			)

			const entry = {
				path: cmdFile,
				plugin: null,
				description: 'Test command',
				priority: 0
			}

			await executePluginCommand(entry, [], [])

			const output = getAllOutput()
			expect(output.log).toContain('COMMAND_EXECUTED')
		})

		it('should display help and exit(0) when --help is passed', async () => {
			const ts = Date.now()
			const cmdFile = path.join(tempDir, `help-cmd-${ts}.mjs`)
			await fs.writeFile(
				cmdFile,
				`export const config = {
	description: 'A helpful command',
	options: [
		{ alias: '-p', name: '--port', description: 'Port number', type: 'number' }
	]
};
export default function() {
	console.log('SHOULD_NOT_RUN');
}`
			)

			const entry = {
				path: cmdFile,
				plugin: '@test/plugin',
				description: 'A helpful command',
				priority: 0,
				options: [{ alias: '-p', name: '--port', description: 'Port number', type: 'number' }]
			}

			try {
				await executePluginCommand(entry, [], ['--help'])
				expect(true).toBe(false) // Should not reach
			} catch (e) {
				expect(e.message).toBe('process.exit(0)')
			}

			const output = getAllOutput()
			// Help was shown
			expect(output.log).toContain('A helpful command')
			expect(output.log).toContain('--port')
			// Handler was NOT executed
			expect(output.log).not.toContain('SHOULD_NOT_RUN')
		})

		it('should show validation error and exit(1) for missing required option', async () => {
			const ts = Date.now()
			const cmdFile = path.join(tempDir, `required-cmd-${ts}.mjs`)
			await fs.writeFile(
				cmdFile,
				`export const config = {
	description: 'Requires input',
	options: [{ alias: '-i', name: '--input', description: 'Input file', required: true }]
};
export default function() {
	console.log('SHOULD_NOT_RUN');
}`
			)

			const entry = {
				path: cmdFile,
				plugin: null,
				description: 'Requires input',
				priority: 0,
				options: [{ alias: '-i', name: '--input', description: 'Input file', required: true }]
			}

			try {
				await executePluginCommand(entry, [], []) // No --input provided
				expect(true).toBe(false) // Should not reach
			} catch (e) {
				expect(e.message).toBe('process.exit(1)')
			}

			const output = getAllOutput()
			// Should show error about missing required option
			expect(output.all).toMatch(/required.*--input|--input.*required|missing.*--input/i)
			// Handler was NOT executed
			expect(output.all).not.toContain('SHOULD_NOT_RUN')
		})

		it('should run extension before hooks before command handler', async () => {
			const ts = Date.now()
			const cmdFile = path.join(tempDir, `ext-cmd-${ts}.mjs`)
			await fs.writeFile(
				cmdFile,
				`export const config = { description: 'With extensions' };
export default function(ctx) {
	console.log('HANDLER_RAN');
}`
			)

			const extFile = path.join(tempDir, `ext-before-${ts}.mjs`)
			await fs.writeFile(
				extFile,
				`export const config = {};
export function before(ctx) {
	console.log('BEFORE_HOOK_RAN');
	return true;
}`
			)

			const entry = {
				path: cmdFile,
				plugin: null,
				description: 'With extensions',
				priority: 0
			}

			const extensions = [{ path: extFile, plugin: '@test/ext', priority: 0, hasBefore: true }]

			await executePluginCommand(entry, extensions, [])

			const output = getAllOutput()
			expect(output.log).toContain('BEFORE_HOOK_RAN')
			expect(output.log).toContain('HANDLER_RAN')

			// Verify order: before hook should come before handler
			const beforeIndex = output.log.indexOf('BEFORE_HOOK_RAN')
			const handlerIndex = output.log.indexOf('HANDLER_RAN')
			expect(beforeIndex).toBeLessThan(handlerIndex)
		})

		it('should pass parsed options to command handler', async () => {
			const ts = Date.now()
			const cmdFile = path.join(tempDir, `options-cmd-${ts}.mjs`)
			await fs.writeFile(
				cmdFile,
				`export const config = {
	description: 'Options test',
	options: [
		{ alias: '-p', name: '--port', description: 'Port', type: 'number', default: 3000 },
		{ alias: '-v', name: '--verbose', description: 'Verbose', type: 'boolean' }
	]
};
export default function(ctx) {
	console.log('OPTIONS:' + JSON.stringify(ctx.options));
}`
			)

			const entry = {
				path: cmdFile,
				plugin: null,
				description: 'Options test',
				priority: 0,
				options: [
					{ alias: '-p', name: '--port', description: 'Port', type: 'number', default: 3000 },
					{ alias: '-v', name: '--verbose', description: 'Verbose', type: 'boolean' }
				]
			}

			await executePluginCommand(entry, [], ['--port', '8080', '--verbose'])

			const output = getAllOutput()
			expect(output.log).toContain('OPTIONS:')
			expect(output.log).toContain('"port":8080')
			expect(output.log).toContain('"verbose":true')
		})
	})
})
