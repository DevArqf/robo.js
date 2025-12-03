// @ts-nocheck
/**
 * Tests for CLI Scanner Functions
 *
 * Tests scanCommands and scanExtensions with real filesystem operations.
 * Creates temporary directories and fixture files for comprehensive testing.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { scanCommands, scanExtensions, getPluginCliDir } from '../../dist/cli/utils/cli-shared.js'

describe('CLI Scanner Functions', () => {
	let tempDir: string
	let commandsDir: string
	let extensionsDir: string

	beforeAll(async () => {
		// Create temp directory structure
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'robo-cli-test-'))
		commandsDir = path.join(tempDir, 'commands')
		extensionsDir = path.join(tempDir, 'extend')
		await fs.mkdir(commandsDir, { recursive: true })
		await fs.mkdir(extensionsDir, { recursive: true })
	})

	afterAll(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	describe('scanCommands', () => {
		it('should return empty commands for empty directory', async () => {
			const emptyDir = path.join(tempDir, 'empty-commands')
			await fs.mkdir(emptyDir, { recursive: true })

			const { commands, subcommandMap } = await scanCommands(emptyDir, null)

			expect(Object.keys(commands)).toHaveLength(0)
			expect(subcommandMap.size).toBe(0)
		})

		it('should return empty commands for non-existent directory', async () => {
			const { commands, subcommandMap } = await scanCommands(path.join(tempDir, 'nonexistent'), null)

			expect(Object.keys(commands)).toHaveLength(0)
			expect(subcommandMap.size).toBe(0)
		})

		it('should discover a simple command with config and handler', async () => {
			const testDir = path.join(tempDir, `simple-commands-${Date.now()}`)
			await fs.mkdir(testDir, { recursive: true })

			// Create a simple command file with unique filename to avoid caching
			const filename = `greet-${Date.now()}.mjs`
			await fs.writeFile(
				path.join(testDir, filename),
				`export const config = {
	description: 'Greet the user',
	options: [
		{ alias: '-n', name: '--name', description: 'Name to greet' }
	]
};
export default function(ctx) {
	console.log('Hello!');
};
`
			)

			const { commands } = await scanCommands(testDir, null, { cacheBust: true })

			const cmdName = filename.replace('.mjs', '')
			expect(commands[cmdName]).toBeDefined()
			expect(commands[cmdName].description).toBe('Greet the user')
			expect(commands[cmdName].options).toHaveLength(1)
			expect(commands[cmdName].options[0].name).toBe('--name')
			expect(commands[cmdName].plugin).toBeNull()
		})

		it('should discover command with plugin attribution', async () => {
			const testDir = path.join(tempDir, `plugin-commands-${Date.now()}`)
			await fs.mkdir(testDir, { recursive: true })

			const filename = `deploy-${Date.now()}.mjs`
			await fs.writeFile(
				path.join(testDir, filename),
				`export const config = { description: 'Deploy app' };
export default function() {};
`
			)

			const { commands } = await scanCommands(testDir, '@robojs/deploy', { cacheBust: true })
			const cmdName = filename.replace('.mjs', '')

			expect(commands[cmdName].plugin).toBe('@robojs/deploy')
		})

		it('should discover nested subcommands', async () => {
			const testDir = path.join(tempDir, `nested-commands-${Date.now()}`)
			const serviceDir = `svc-${Date.now()}`
			await fs.mkdir(path.join(testDir, serviceDir), { recursive: true })

			// Parent command
			await fs.writeFile(
				path.join(testDir, serviceDir, 'index.mjs'),
				`
export const config = { description: 'Service commands' }
export default function() {}
`
			)

			// Subcommand
			await fs.writeFile(
				path.join(testDir, serviceDir, 'start.mjs'),
				`
export const config = { description: 'Start the service' }
export default function() {}
`
			)

			const { commands, subcommandMap } = await scanCommands(testDir, null, { cacheBust: true })

			expect(commands[serviceDir]).toBeDefined()
			expect(commands[`${serviceDir} start`]).toBeDefined()
			expect(commands[serviceDir].description).toBe('Service commands')
			expect(commands[`${serviceDir} start`].description).toBe('Start the service')
			expect(subcommandMap.get(serviceDir)).toContain('start')
		})

		it('should discover deeply nested commands', async () => {
			const testDir = path.join(tempDir, `deep-commands-${Date.now()}`)
			const dbDir = `db-${Date.now()}`
			const migrateDir = `migrate-${Date.now()}`
			await fs.mkdir(path.join(testDir, dbDir, migrateDir), { recursive: true })

			await fs.writeFile(
				path.join(testDir, dbDir, 'index.mjs'),
				`
export const config = { description: 'Database commands' }
export default function() {}
`
			)

			await fs.writeFile(
				path.join(testDir, dbDir, migrateDir, 'index.mjs'),
				`
export const config = { description: 'Migration commands' }
export default function() {}
`
			)

			await fs.writeFile(
				path.join(testDir, dbDir, migrateDir, 'up.mjs'),
				`
export const config = { description: 'Run migrations up' }
export default function() {}
`
			)

			const { commands, subcommandMap } = await scanCommands(testDir, null, { cacheBust: true })

			expect(commands[dbDir]).toBeDefined()
			expect(commands[`${dbDir} ${migrateDir}`]).toBeDefined()
			expect(commands[`${dbDir} ${migrateDir} up`]).toBeDefined()
			expect(subcommandMap.get(dbDir)).toContain(migrateDir)
			expect(subcommandMap.get(`${dbDir} ${migrateDir}`)).toContain('up')
		})

		it('should skip files without default export', async () => {
			const testDir = path.join(tempDir, `no-handler-commands-${Date.now()}`)
			await fs.mkdir(testDir, { recursive: true })

			const filename = `broken-${Date.now()}.mjs`
			await fs.writeFile(
				path.join(testDir, filename),
				`
export const config = { description: 'No handler' }
// Missing default export
`
			)

			const { commands } = await scanCommands(testDir, null, { cacheBust: true })

			expect(commands[filename.replace('.mjs', '')]).toBeUndefined()
		})

		it('should skip top-level index.js files', async () => {
			const testDir = path.join(tempDir, `index-commands-${Date.now()}`)
			await fs.mkdir(testDir, { recursive: true })

			await fs.writeFile(
				path.join(testDir, 'index.mjs'),
				`
export const config = { description: 'Should be skipped' }
export default function() {}
`
			)

			const { commands } = await scanCommands(testDir, null, { cacheBust: true })

			// Top-level index should be skipped
			expect(commands['index']).toBeUndefined()
			expect(Object.keys(commands)).toHaveLength(0)
		})

		it('should apply priority boost', async () => {
			const testDir = path.join(tempDir, `priority-commands-${Date.now()}`)
			await fs.mkdir(testDir, { recursive: true })

			const filename = `boost-${Date.now()}.mjs`
			await fs.writeFile(
				path.join(testDir, filename),
				`
export const config = { description: 'Boosted', priority: 10 }
export default function() {}
`
			)

			const { commands } = await scanCommands(testDir, null, { priorityBoost: 100, cacheBust: true })

			expect(commands[filename.replace('.mjs', '')].priority).toBe(110) // 10 + 100
		})

		it('should handle .mjs files', async () => {
			const testDir = path.join(tempDir, `mjs-commands-${Date.now()}`)
			await fs.mkdir(testDir, { recursive: true })

			const filename = `esm-${Date.now()}.mjs`
			await fs.writeFile(
				path.join(testDir, filename),
				`
export const config = { description: 'ESM module' }
export default function() {}
`
			)

			const { commands } = await scanCommands(testDir, null, { cacheBust: true })

			expect(commands[filename.replace('.mjs', '')]).toBeDefined()
			expect(commands[filename.replace('.mjs', '')].description).toBe('ESM module')
		})

		it('should validate option formats', async () => {
			const testDir = path.join(tempDir, `option-validation-commands-${Date.now()}`)
			await fs.mkdir(testDir, { recursive: true })

			const filename = `validate-${Date.now()}.mjs`
			await fs.writeFile(
				path.join(testDir, filename),
				`
export const config = {
	description: 'Test options',
	options: [
		{ alias: '-v', name: '--verbose', description: 'Valid' },
		{ alias: 'bad', name: '--bad', description: 'Invalid alias - no dash' },
		{ alias: '-x', name: 'bad', description: 'Invalid name - no dashes' },
		{ alias: '-g', name: '--good', description: 'Also valid' }
	]
}
export default function() {}
`
			)

			const { commands } = await scanCommands(testDir, null, { cacheBust: true })
			const cmdName = filename.replace('.mjs', '')

			// Should only include valid options
			expect(commands[cmdName].options).toHaveLength(2)
			expect(commands[cmdName].options[0].alias).toBe('-v')
			expect(commands[cmdName].options[1].alias).toBe('-g')
		})

		it('should capture positionalArgs config', async () => {
			const testDir = path.join(tempDir, `positional-commands-${Date.now()}`)
			await fs.mkdir(testDir, { recursive: true })

			const filename = `copy-${Date.now()}.mjs`
			await fs.writeFile(
				path.join(testDir, filename),
				`
export const config = {
	description: 'Copy files',
	positionalArgs: true
}
export default function() {}
`
			)

			const { commands } = await scanCommands(testDir, null, { cacheBust: true })

			expect(commands[filename.replace('.mjs', '')].positionalArgs).toBe(true)
		})
	})

	describe('scanExtensions', () => {
		it('should return empty extensions for empty directory', async () => {
			const emptyDir = path.join(tempDir, `empty-extensions-${Date.now()}`)
			await fs.mkdir(emptyDir, { recursive: true })

			const extensions = await scanExtensions(emptyDir, null)

			expect(Object.keys(extensions)).toHaveLength(0)
		})

		it('should return empty extensions for non-existent directory', async () => {
			const extensions = await scanExtensions(path.join(tempDir, `nonexistent-ext-${Date.now()}`), null)

			expect(Object.keys(extensions)).toHaveLength(0)
		})

		it('should discover extension with before hook', async () => {
			const testDir = path.join(tempDir, `before-extensions-${Date.now()}`)
			await fs.mkdir(testDir, { recursive: true })

			// Use underscore instead of hyphen to avoid hyphen-to-space conversion
			const ts = Date.now()
			const filename = `devext_${ts}.mjs`
			await fs.writeFile(
				path.join(testDir, filename),
				`
export const config = { priority: 10 }
export async function before(ctx) {
	console.log('Before dev')
}
`
			)

			const extensions = await scanExtensions(testDir, null, { cacheBust: true })
			// Extension name is filename without extension (hyphens become spaces)
			const extName = `devext_${ts}`

			expect(extensions[extName]).toBeDefined()
			expect(extensions[extName]).toHaveLength(1)
			expect(extensions[extName][0].hasBefore).toBe(true)
			expect(extensions[extName][0].hasAfter).toBe(false)
		})

		it('should discover extension with after hook', async () => {
			const testDir = path.join(tempDir, `after-extensions-${Date.now()}`)
			await fs.mkdir(testDir, { recursive: true })

			const ts = Date.now()
			const filename = `buildext_${ts}.mjs`
			await fs.writeFile(
				path.join(testDir, filename),
				`
export const config = {}
export async function after(ctx) {
	console.log('After build')
}
`
			)

			const extensions = await scanExtensions(testDir, null, { cacheBust: true })
			const extName = `buildext_${ts}`

			expect(extensions[extName]).toBeDefined()
			expect(extensions[extName][0].hasAfter).toBe(true)
		})

		it('should discover extension with both hooks', async () => {
			const testDir = path.join(tempDir, `both-extensions-${Date.now()}`)
			await fs.mkdir(testDir, { recursive: true })

			const ts = Date.now()
			const filename = `startext_${ts}.mjs`
			await fs.writeFile(
				path.join(testDir, filename),
				`
export const config = { options: [{ alias: '-p', name: '--port', description: 'Port' }] }
export async function before(ctx) { return true }
export async function after(ctx) { console.log('done') }
`
			)

			const extensions = await scanExtensions(testDir, null, { cacheBust: true })
			const extName = `startext_${ts}`

			expect(extensions[extName][0].hasBefore).toBe(true)
			expect(extensions[extName][0].hasAfter).toBe(true)
			expect(extensions[extName][0].options).toHaveLength(1)
		})

		it('should discover nested extension folders', async () => {
			const testDir = path.join(tempDir, `nested-extensions-${Date.now()}`)
			const ts = Date.now()
			const subDir = `tunnel_${ts}`
			await fs.mkdir(path.join(testDir, subDir), { recursive: true })

			await fs.writeFile(
				path.join(testDir, subDir, 'start.mjs'),
				`
export const config = {}
export function before() {}
`
			)

			const extensions = await scanExtensions(testDir, null, { cacheBust: true })

			// "tunnel_{ts}/start.mjs" should map to "tunnel_{ts} start"
			expect(extensions[`${subDir} start`]).toBeDefined()
			expect(extensions[`${subDir} start`][0].hasBefore).toBe(true)
		})

		it('should discover deeply nested extension folders', async () => {
			const testDir = path.join(tempDir, `deep-nested-extensions-${Date.now()}`)
			const ts = Date.now()
			const cloudDir = `cloud_${ts}`
			const statusDir = `status_${ts}`
			await fs.mkdir(path.join(testDir, cloudDir, statusDir), { recursive: true })

			await fs.writeFile(
				path.join(testDir, cloudDir, statusDir, 'check.mjs'),
				`
export const config = { priority: 5 }
export function after() {}
`
			)

			const extensions = await scanExtensions(testDir, null, { cacheBust: true })

			// "cloud_{ts}/status_{ts}/check.mjs" should map to "cloud_{ts} status_{ts} check"
			expect(extensions[`${cloudDir} ${statusDir} check`]).toBeDefined()
			expect(extensions[`${cloudDir} ${statusDir} check`][0].hasAfter).toBe(true)
			expect(extensions[`${cloudDir} ${statusDir} check`][0].priority).toBe(5)
		})

		it('should apply priority boost to extensions', async () => {
			const testDir = path.join(tempDir, `boost-extensions-${Date.now()}`)
			await fs.mkdir(testDir, { recursive: true })

			const ts = Date.now()
			const filename = `devext_${ts}.mjs`
			await fs.writeFile(
				path.join(testDir, filename),
				`
export const config = { priority: 5 }
export function before() {}
`
			)

			const extensions = await scanExtensions(testDir, null, { priorityBoost: 100, cacheBust: true })
			const extName = `devext_${ts}`

			expect(extensions[extName][0].priority).toBe(105)
		})

		it('should attribute extensions to plugin', async () => {
			const testDir = path.join(tempDir, `plugin-extensions-${Date.now()}`)
			await fs.mkdir(testDir, { recursive: true })

			const ts = Date.now()
			const filename = `deployext_${ts}.mjs`
			await fs.writeFile(
				path.join(testDir, filename),
				`
export const config = {}
export function after() {}
`
			)

			const extensions = await scanExtensions(testDir, '@robojs/deploy', { cacheBust: true })
			const extName = `deployext_${ts}`

			expect(extensions[extName][0].plugin).toBe('@robojs/deploy')
		})
	})

	describe('getPluginCliDir', () => {
		it('should return null for non-existent plugin', async () => {
			const result = await getPluginCliDir('nonexistent-plugin-12345')
			expect(result).toBeNull()
		})
	})
})
