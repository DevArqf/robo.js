/**
 * HMR Linker Tests
 *
 * Tests for the import specifier rewriting used to ensure cache correctness
 * when utility files change during HMR.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { linkModules, hasRelativeImports } from '../../src/cli/utils/hmr-linker.js'

describe('HMR Linker', () => {
	let tempDir: string
	let buildDir: string

	beforeEach(() => {
		// Create a temporary directory for each test
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hmr-linker-test-'))
		buildDir = path.join(tempDir, '.robo', 'build', 'development')
		fs.mkdirSync(buildDir, { recursive: true })
	})

	afterEach(() => {
		// Clean up temporary directory
		fs.rmSync(tempDir, { recursive: true, force: true })
	})

	/**
	 * Helper to create a file in the build directory
	 */
	function createBuildFile(relativePath: string, content: string): string {
		const fullPath = path.join(buildDir, relativePath)
		fs.mkdirSync(path.dirname(fullPath), { recursive: true })
		fs.writeFileSync(fullPath, content, 'utf-8')
		return fullPath
	}

	/**
	 * Helper to read a file from the build directory
	 */
	function readBuildFile(relativePath: string): string {
		return fs.readFileSync(path.join(buildDir, relativePath), 'utf-8')
	}

	describe('hasRelativeImports', () => {
		it('returns true for content with relative imports', () => {
			expect(hasRelativeImports(`import foo from './foo.js'`)).toBe(true)
			expect(hasRelativeImports(`import { bar } from '../bar.js'`)).toBe(true)
			expect(hasRelativeImports(`export { baz } from './baz.js'`)).toBe(true)
		})

		it('returns false for content with only external imports', () => {
			expect(hasRelativeImports(`import Discord from 'discord.js'`)).toBe(false)
			expect(hasRelativeImports(`import fs from 'node:fs'`)).toBe(false)
		})

		it('returns false for empty content', () => {
			expect(hasRelativeImports('')).toBe(false)
		})

		it('returns true for dynamic imports with relative paths', () => {
			expect(hasRelativeImports(`const mod = await import('./lazy.js')`)).toBe(true)
		})
	})

	describe('linkModules - basic rewriting', () => {
		beforeEach(() => {
			// Override process.cwd() for tests
			jest.spyOn(process, 'cwd').mockReturnValue(tempDir)
		})

		afterEach(() => {
			jest.restoreAllMocks()
		})

		it('rewrites static default imports', async () => {
			createBuildFile('handler.js', `import foo from './utils.js'\nexport default foo`)

			const result = await linkModules({
				mode: 'development',
				version: 123,
				modules: ['handler.js']
			})

			expect(result.success).toBe(true)
			expect(result.linkedCount).toBe(1)

			const content = readBuildFile('handler.js')
			expect(content).toContain(`import foo from './utils.js?robo_hmr=123'`)
		})

		it('rewrites static named imports', async () => {
			createBuildFile('handler.js', `import { foo, bar } from './utils.js'\nexport { foo, bar }`)

			const result = await linkModules({
				mode: 'development',
				version: 456,
				modules: ['handler.js']
			})

			expect(result.success).toBe(true)
			expect(result.linkedCount).toBe(1)

			const content = readBuildFile('handler.js')
			expect(content).toContain(`import { foo, bar } from './utils.js?robo_hmr=456'`)
		})

		it('rewrites side-effect imports', async () => {
			createBuildFile('handler.js', `import './side-effect.js'\nexport default null`)

			const result = await linkModules({
				mode: 'development',
				version: 789,
				modules: ['handler.js']
			})

			expect(result.success).toBe(true)
			const content = readBuildFile('handler.js')
			expect(content).toContain(`import './side-effect.js?robo_hmr=789'`)
		})

		it('rewrites re-exports', async () => {
			createBuildFile('index.js', `export { foo, bar } from './utils.js'`)

			const result = await linkModules({
				mode: 'development',
				version: 100,
				modules: ['index.js']
			})

			expect(result.success).toBe(true)
			const content = readBuildFile('index.js')
			expect(content).toContain(`export { foo, bar } from './utils.js?robo_hmr=100'`)
		})

		it('rewrites namespace re-exports', async () => {
			createBuildFile('index.js', `export * from './all.js'`)

			const result = await linkModules({
				mode: 'development',
				version: 200,
				modules: ['index.js']
			})

			expect(result.success).toBe(true)
			const content = readBuildFile('index.js')
			expect(content).toContain(`export * from './all.js?robo_hmr=200'`)
		})

		it('rewrites dynamic imports with literal strings', async () => {
			createBuildFile('handler.js', `const mod = await import('./lazy.js')\nexport default mod`)

			const result = await linkModules({
				mode: 'development',
				version: 300,
				modules: ['handler.js']
			})

			expect(result.success).toBe(true)
			const content = readBuildFile('handler.js')
			expect(content).toContain(`import('./lazy.js?robo_hmr=300')`)
		})

		it('rewrites parent directory imports', async () => {
			fs.mkdirSync(path.join(buildDir, 'commands'), { recursive: true })
			createBuildFile('commands/ping.js', `import { format } from '../utils/format.js'\nexport default format`)

			const result = await linkModules({
				mode: 'development',
				version: 400,
				modules: ['commands/ping.js']
			})

			expect(result.success).toBe(true)
			const content = readBuildFile('commands/ping.js')
			expect(content).toContain(`import { format } from '../utils/format.js?robo_hmr=400'`)
		})

		it('rewrites multiple imports in one file', async () => {
			// Create handler in a subdirectory so ../lib/baz.js stays within build root
			fs.mkdirSync(path.join(buildDir, 'commands'), { recursive: true })
			fs.mkdirSync(path.join(buildDir, 'lib'), { recursive: true })
			createBuildFile('commands/handler.js', `
import foo from './foo.js'
import { bar } from './bar.js'
import * as baz from '../lib/baz.js'
export { foo, bar, baz }
`)

			const result = await linkModules({
				mode: 'development',
				version: 500,
				modules: ['commands/handler.js']
			})

			expect(result.success).toBe(true)
			expect(result.linkedCount).toBe(1)

			const content = readBuildFile('commands/handler.js')
			expect(content).toContain(`'./foo.js?robo_hmr=500'`)
			expect(content).toContain(`'./bar.js?robo_hmr=500'`)
			expect(content).toContain(`'../lib/baz.js?robo_hmr=500'`)
		})

		it('processes multiple modules', async () => {
			createBuildFile('handler1.js', `import foo from './utils.js'`)
			createBuildFile('handler2.js', `import bar from './utils.js'`)

			const result = await linkModules({
				mode: 'development',
				version: 600,
				modules: ['handler1.js', 'handler2.js']
			})

			expect(result.success).toBe(true)
			expect(result.linkedCount).toBe(2)

			expect(readBuildFile('handler1.js')).toContain(`'./utils.js?robo_hmr=600'`)
			expect(readBuildFile('handler2.js')).toContain(`'./utils.js?robo_hmr=600'`)
		})
	})

	describe('linkModules - skips external imports', () => {
		beforeEach(() => {
			jest.spyOn(process, 'cwd').mockReturnValue(tempDir)
		})

		afterEach(() => {
			jest.restoreAllMocks()
		})

		it('does not rewrite npm package imports', async () => {
			createBuildFile('handler.js', `import Discord from 'discord.js'\nexport default Discord`)

			const result = await linkModules({
				mode: 'development',
				version: 123,
				modules: ['handler.js']
			})

			expect(result.success).toBe(true)
			expect(result.linkedCount).toBe(0) // No changes made

			const content = readBuildFile('handler.js')
			expect(content).toBe(`import Discord from 'discord.js'\nexport default Discord`)
		})

		it('does not rewrite node: imports', async () => {
			createBuildFile('handler.js', `import fs from 'node:fs'\nimport path from 'node:path'`)

			const result = await linkModules({
				mode: 'development',
				version: 123,
				modules: ['handler.js']
			})

			expect(result.success).toBe(true)
			expect(result.linkedCount).toBe(0)

			const content = readBuildFile('handler.js')
			expect(content).not.toContain('robo_hmr')
		})

		it('does not rewrite scoped package imports', async () => {
			createBuildFile('handler.js', `import { Client } from '@robojs/server'`)

			const result = await linkModules({
				mode: 'development',
				version: 123,
				modules: ['handler.js']
			})

			expect(result.success).toBe(true)
			expect(result.linkedCount).toBe(0)
		})

		it('only rewrites relative imports in mixed file', async () => {
			createBuildFile('handler.js', `
import Discord from 'discord.js'
import fs from 'node:fs'
import { format } from './utils.js'
import { Client } from '@robojs/server'
export { format }
`)

			const result = await linkModules({
				mode: 'development',
				version: 123,
				modules: ['handler.js']
			})

			expect(result.success).toBe(true)
			expect(result.linkedCount).toBe(1)

			const content = readBuildFile('handler.js')
			expect(content).toContain(`'./utils.js?robo_hmr=123'`)
			expect(content).toContain(`'discord.js'`)
			expect(content).toContain(`'node:fs'`)
			expect(content).toContain(`'@robojs/server'`)
		})
	})

	describe('linkModules - query string handling', () => {
		beforeEach(() => {
			jest.spyOn(process, 'cwd').mockReturnValue(tempDir)
		})

		afterEach(() => {
			jest.restoreAllMocks()
		})

		it('replaces existing robo_hmr query param', async () => {
			createBuildFile('handler.js', `import foo from './utils.js?robo_hmr=100'`)

			const result = await linkModules({
				mode: 'development',
				version: 200,
				modules: ['handler.js']
			})

			expect(result.success).toBe(true)
			expect(result.linkedCount).toBe(1)

			const content = readBuildFile('handler.js')
			expect(content).toContain(`'./utils.js?robo_hmr=200'`)
			expect(content).not.toContain('robo_hmr=100')
		})

		it('appends robo_hmr to existing query params', async () => {
			createBuildFile('handler.js', `import foo from './utils.js?v=1'`)

			const result = await linkModules({
				mode: 'development',
				version: 300,
				modules: ['handler.js']
			})

			expect(result.success).toBe(true)
			const content = readBuildFile('handler.js')
			expect(content).toContain(`'./utils.js?v=1&robo_hmr=300'`)
		})

		it('replaces robo_hmr while preserving other params', async () => {
			createBuildFile('handler.js', `import foo from './utils.js?a=1&robo_hmr=old&b=2'`)

			const result = await linkModules({
				mode: 'development',
				version: 'new',
				modules: ['handler.js']
			})

			expect(result.success).toBe(true)
			const content = readBuildFile('handler.js')
			expect(content).toContain(`'./utils.js?a=1&robo_hmr=new&b=2'`)
		})
	})

	describe('linkModules - quote handling', () => {
		beforeEach(() => {
			jest.spyOn(process, 'cwd').mockReturnValue(tempDir)
		})

		afterEach(() => {
			jest.restoreAllMocks()
		})

		it('preserves single quotes', async () => {
			createBuildFile('handler.js', `import foo from './utils.js'`)

			await linkModules({
				mode: 'development',
				version: 123,
				modules: ['handler.js']
			})

			const content = readBuildFile('handler.js')
			expect(content).toContain(`'./utils.js?robo_hmr=123'`)
			expect(content).not.toContain(`"./utils.js`)
		})

		it('preserves double quotes', async () => {
			createBuildFile('handler.js', `import foo from "./utils.js"`)

			await linkModules({
				mode: 'development',
				version: 123,
				modules: ['handler.js']
			})

			const content = readBuildFile('handler.js')
			expect(content).toContain(`"./utils.js?robo_hmr=123"`)
			expect(content).not.toContain(`'./utils.js`)
		})

		it('handles mixed quotes in same file', async () => {
			createBuildFile('handler.js', `
import foo from './foo.js'
import bar from "./bar.js"
`)

			await linkModules({
				mode: 'development',
				version: 123,
				modules: ['handler.js']
			})

			const content = readBuildFile('handler.js')
			expect(content).toContain(`'./foo.js?robo_hmr=123'`)
			expect(content).toContain(`"./bar.js?robo_hmr=123"`)
		})
	})

	describe('linkModules - error handling', () => {
		beforeEach(() => {
			jest.spyOn(process, 'cwd').mockReturnValue(tempDir)
		})

		afterEach(() => {
			jest.restoreAllMocks()
		})

		it('returns error when build directory does not exist', async () => {
			jest.spyOn(process, 'cwd').mockReturnValue('/nonexistent/path')

			const result = await linkModules({
				mode: 'development',
				version: 123,
				modules: ['handler.js']
			})

			expect(result.success).toBe(false)
			expect(result.errors).toHaveLength(1)
			expect(result.errors[0]).toContain('Build directory not found')
		})

		it('skips non-existent module files gracefully', async () => {
			createBuildFile('exists.js', `import foo from './utils.js'`)

			const result = await linkModules({
				mode: 'development',
				version: 123,
				modules: ['exists.js', 'does-not-exist.js']
			})

			expect(result.success).toBe(true)
			expect(result.linkedCount).toBe(1)
			expect(result.errors).toHaveLength(0)
		})

		it('skips non-JS files', async () => {
			createBuildFile('data.json', `{"foo": "bar"}`)

			const result = await linkModules({
				mode: 'development',
				version: 123,
				modules: ['data.json']
			})

			expect(result.success).toBe(true)
			expect(result.linkedCount).toBe(0)

			// Verify file wasn't modified
			expect(readBuildFile('data.json')).toBe(`{"foo": "bar"}`)
		})

		it('does not write file if no changes made', async () => {
			createBuildFile('handler.js', `import Discord from 'discord.js'\nexport default Discord`)
			const originalMtime = fs.statSync(path.join(buildDir, 'handler.js')).mtimeMs

			// Small delay to ensure mtime would change if file was written
			await new Promise((resolve) => setTimeout(resolve, 50))

			await linkModules({
				mode: 'development',
				version: 123,
				modules: ['handler.js']
			})

			const newMtime = fs.statSync(path.join(buildDir, 'handler.js')).mtimeMs
			expect(newMtime).toBe(originalMtime)
		})
	})

	describe('linkModules - path boundary enforcement', () => {
		beforeEach(() => {
			jest.spyOn(process, 'cwd').mockReturnValue(tempDir)
		})

		afterEach(() => {
			jest.restoreAllMocks()
		})

		it('does not rewrite imports that escape build root', async () => {
			// File in build/commands trying to import ../../../../outside
			fs.mkdirSync(path.join(buildDir, 'commands'), { recursive: true })
			createBuildFile('commands/handler.js', `import foo from '../../../../outside.js'`)

			const result = await linkModules({
				mode: 'development',
				version: 123,
				modules: ['commands/handler.js']
			})

			expect(result.success).toBe(true)
			expect(result.linkedCount).toBe(0)

			// Import should remain unchanged
			const content = readBuildFile('commands/handler.js')
			expect(content).toBe(`import foo from '../../../../outside.js'`)
		})

		it('rewrites valid nested directory imports', async () => {
			fs.mkdirSync(path.join(buildDir, 'commands/admin'), { recursive: true })
			createBuildFile('commands/admin/handler.js', `import foo from '../../utils/format.js'`)

			const result = await linkModules({
				mode: 'development',
				version: 123,
				modules: ['commands/admin/handler.js']
			})

			expect(result.success).toBe(true)
			expect(result.linkedCount).toBe(1)

			const content = readBuildFile('commands/admin/handler.js')
			expect(content).toContain(`'../../utils/format.js?robo_hmr=123'`)
		})
	})

	describe('linkModules - real-world patterns', () => {
		beforeEach(() => {
			jest.spyOn(process, 'cwd').mockReturnValue(tempDir)
		})

		afterEach(() => {
			jest.restoreAllMocks()
		})

		it('handles typical handler file', async () => {
			createBuildFile('events/ready.js', `
import { logger } from 'robo.js'
import { formatMessage } from './utils/format.js'
import { db } from '../lib/database.js'

export default async () => {
	const message = formatMessage('Ready!')
	await db.save(message)
	logger.info('Bot ready')
}
`)

			const result = await linkModules({
				mode: 'development',
				version: Date.now(),
				modules: ['events/ready.js']
			})

			expect(result.success).toBe(true)
			expect(result.linkedCount).toBe(1)

			const content = readBuildFile('events/ready.js')
			// Relative imports rewritten
			expect(content).toMatch(/from '\.\/utils\/format\.js\?robo_hmr=\d+'/)
			expect(content).toMatch(/from '\.\.\/lib\/database\.js\?robo_hmr=\d+'/)
			// External import unchanged
			expect(content).toContain(`from 'robo.js'`)
		})

		it('handles utility file with re-exports', async () => {
			createBuildFile('utils/index.js', `
export { formatDate, formatNumber } from './formatters.js'
export * from './helpers.js'
export { default as config } from '../config.js'
`)

			const result = await linkModules({
				mode: 'development',
				version: 12345,
				modules: ['utils/index.js']
			})

			expect(result.success).toBe(true)
			expect(result.linkedCount).toBe(1)

			const content = readBuildFile('utils/index.js')
			expect(content).toContain(`'./formatters.js?robo_hmr=12345'`)
			expect(content).toContain(`'./helpers.js?robo_hmr=12345'`)
			expect(content).toContain(`'../config.js?robo_hmr=12345'`)
		})

		it('handles file with lazy loading', async () => {
			createBuildFile('commands/advanced.js', `
import { logger } from 'robo.js'

export default async (interaction) => {
	if (interaction.options.get('advanced')) {
		const { processAdvanced } = await import('./advanced-handler.js')
		return processAdvanced(interaction)
	}
	return 'Simple response'
}
`)

			const result = await linkModules({
				mode: 'development',
				version: 999,
				modules: ['commands/advanced.js']
			})

			expect(result.success).toBe(true)
			expect(result.linkedCount).toBe(1)

			const content = readBuildFile('commands/advanced.js')
			expect(content).toContain(`import('./advanced-handler.js?robo_hmr=999')`)
		})

		it('handles multiline imports', async () => {
			createBuildFile('handler.js', `
import {
	foo,
	bar,
	baz
} from './multiline.js'

export { foo, bar, baz }
`)

			const result = await linkModules({
				mode: 'development',
				version: 777,
				modules: ['handler.js']
			})

			expect(result.success).toBe(true)
			expect(result.linkedCount).toBe(1)

			const content = readBuildFile('handler.js')
			expect(content).toContain(`'./multiline.js?robo_hmr=777'`)
		})
	})
})
