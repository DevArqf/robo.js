// @ts-nocheck
/**
 * Tests for CLI Command/Extension Loader Functions
 *
 * Tests loadCliCommand and loadCliExtension with real fixture files.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { loadCliCommand, loadCliExtension } from '../../dist/cli/utils/cli-loader.js'

describe('CLI Command Loader Functions', () => {
	let tempDir: string

	beforeAll(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'robo-cli-loader-test-'))
	})

	afterAll(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	describe('loadCliCommand', () => {
		it('should load a command with default handler', async () => {
			const commandFile = path.join(tempDir, `simple-cmd-${Date.now()}.mjs`)
			await fs.writeFile(
				commandFile,
				`export const config = {
	description: 'Simple command'
};
export default function(ctx) {
	return 'executed';
};
`
			)

			const entry = {
				path: commandFile,
				plugin: null,
				description: 'Simple command',
				priority: 0
			}

			const loaded = await loadCliCommand(entry)

			expect(loaded).not.toBeNull()
			expect(loaded.config.description).toBe('Simple command')
			expect(typeof loaded.handler).toBe('function')
		})

		it('should load command with options', async () => {
			const commandFile = path.join(tempDir, `options-cmd-${Date.now()}.mjs`)
			await fs.writeFile(
				commandFile,
				`export const config = {
	description: 'Command with options',
	options: [
		{ alias: '-v', name: '--verbose', description: 'Verbose', type: 'boolean' }
	]
};
export default function() {};
`
			)

			const entry = {
				path: commandFile,
				plugin: null,
				description: 'Command with options',
				priority: 0,
				options: [{ alias: '-v', name: '--verbose', description: 'Verbose', type: 'boolean' }]
			}

			const loaded = await loadCliCommand(entry)

			expect(loaded.config.options).toHaveLength(1)
			expect(loaded.config.options[0].type).toBe('boolean')
		})

		it('should handle auto-generated parent command (no path)', async () => {
			const entry = {
				path: '', // Empty path = auto-generated
				plugin: '@robojs/test',
				description: 'Test commands',
				priority: 0,
				subcommands: ['start', 'stop']
			}

			const loaded = await loadCliCommand(entry)

			expect(loaded).not.toBeNull()
			expect(loaded.plugin).toBe('@robojs/test')
			expect(typeof loaded.handler).toBe('function')
		})

		it('should return null for command with no default export', async () => {
			const commandFile = path.join(tempDir, `no-default-cmd-${Date.now()}.mjs`)
			await fs.writeFile(
				commandFile,
				`export const config = { description: 'No handler' };
// Missing default export
`
			)

			const entry = {
				path: commandFile,
				plugin: null,
				description: 'No handler',
				priority: 0
			}

			const loaded = await loadCliCommand(entry)

			expect(loaded).toBeNull()
		})

		it('should return null for non-existent file', async () => {
			const entry = {
				path: path.join(tempDir, 'nonexistent.js'),
				plugin: null,
				description: 'Missing',
				priority: 0
			}

			const loaded = await loadCliCommand(entry)

			expect(loaded).toBeNull()
		})

		it('should preserve plugin attribution', async () => {
			const commandFile = path.join(tempDir, `plugin-cmd-${Date.now()}.mjs`)
			await fs.writeFile(
				commandFile,
				`export const config = { description: 'Plugin command' };
export default function() {};
`
			)

			const entry = {
				path: commandFile,
				plugin: '@robojs/deploy',
				description: 'Plugin command',
				priority: 50
			}

			const loaded = await loadCliCommand(entry)

			expect(loaded.plugin).toBe('@robojs/deploy')
			expect(loaded.config.priority).toBe(50)
		})

		it('should execute loaded handler', async () => {
			const commandFile = path.join(tempDir, `exec-cmd-${Date.now()}.mjs`)
			await fs.writeFile(
				commandFile,
				`export const config = { description: 'Executable' };
export default function(ctx) {
	return { executed: true, options: ctx.options };
};
`
			)

			const entry = {
				path: commandFile,
				plugin: null,
				description: 'Executable',
				priority: 0
			}

			const loaded = await loadCliCommand(entry)
			const result = await loaded.handler({
				args: [],
				options: { verbose: true },
				logger: console,
				cwd: process.cwd(),
				argv: []
			})

			expect(result).toEqual({ executed: true, options: { verbose: true } })
		})
	})

	describe('loadCliExtension', () => {
		it('should load extension with before hook', async () => {
			const extFile = path.join(tempDir, `before-ext-${Date.now()}.mjs`)
			await fs.writeFile(
				extFile,
				`export const config = { priority: 10 };
export async function before(ctx) {
	return true;
};
`
			)

			const entry = {
				path: extFile,
				plugin: null,
				priority: 10,
				hasBefore: true
			}

			const loaded = await loadCliExtension(entry)

			expect(loaded).not.toBeNull()
			expect(typeof loaded.before).toBe('function')
			expect(loaded.after).toBeUndefined()
		})

		it('should load extension with after hook', async () => {
			const extFile = path.join(tempDir, `after-ext-${Date.now()}.mjs`)
			await fs.writeFile(
				extFile,
				`export const config = {};
export async function after(ctx) {
	console.log('After:', ctx.result);
};
`
			)

			const entry = {
				path: extFile,
				plugin: null,
				priority: 0,
				hasAfter: true
			}

			const loaded = await loadCliExtension(entry)

			expect(loaded).not.toBeNull()
			expect(typeof loaded.after).toBe('function')
			expect(loaded.before).toBeUndefined()
		})

		it('should load extension with both hooks', async () => {
			const extFile = path.join(tempDir, `both-ext-${Date.now()}.mjs`)
			await fs.writeFile(
				extFile,
				`export const config = {
	options: [{ alias: '-x', name: '--extra', description: 'Extra option' }]
};
export function before(ctx) { return true; };
export function after(ctx) { };
`
			)

			const entry = {
				path: extFile,
				plugin: '@robojs/test',
				priority: 20,
				options: [{ alias: '-x', name: '--extra', description: 'Extra option' }],
				hasBefore: true,
				hasAfter: true
			}

			const loaded = await loadCliExtension(entry)

			expect(loaded.before).toBeDefined()
			expect(loaded.after).toBeDefined()
			expect(loaded.plugin).toBe('@robojs/test')
			expect(loaded.config.priority).toBe(20)
		})

		it('should return null for non-existent extension file', async () => {
			const entry = {
				path: path.join(tempDir, 'missing-ext.js'),
				plugin: null,
				priority: 0
			}

			const loaded = await loadCliExtension(entry)

			expect(loaded).toBeNull()
		})

		it('should execute before hook and allow abort', async () => {
			const extFile = path.join(tempDir, `abort-ext-${Date.now()}.mjs`)
			await fs.writeFile(
				extFile,
				`export const config = {};
export function before(ctx) {
	if (ctx.options.abort) {
		return false;
	}
	return true;
};
`
			)

			const entry = {
				path: extFile,
				plugin: null,
				priority: 0,
				hasBefore: true
			}

			const loaded = await loadCliExtension(entry)

			// Test continue
			const continueResult = await loaded.before({
				args: [],
				options: { abort: false },
				logger: console,
				cwd: process.cwd(),
				argv: []
			})
			expect(continueResult).toBe(true)

			// Test abort
			const abortResult = await loaded.before({
				args: [],
				options: { abort: true },
				logger: console,
				cwd: process.cwd(),
				argv: []
			})
			expect(abortResult).toBe(false)
		})
	})
})
