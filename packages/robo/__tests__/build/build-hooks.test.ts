/**
 * Build Hooks Tests
 *
 * Tests the build hooks system including:
 * - Hook path resolution (project and plugin)
 * - Build store creation and management
 * - Mode-specific hook paths
 *
 * NOTE: These tests focus on path resolution and store functionality.
 * Actual hook execution requires a full build context which is tested in E2E tests.
 *
 * API Mocking Notes (for future reference):
 * - Flashcore is NOT mocked here - tests use real filesystem
 * - If Flashcore tests are needed, they should be in a separate test file
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'

// Use built dist files
import {
	resolvePluginBuildHookPath,
	resolveProjectBuildHookPath,
	createBuildStore,
	hasBuildHooks
} from '../../dist/cli/utils/build-hooks.js'
import { RoboPaths } from '../../dist/core/paths.js'

describe('Build Hooks', () => {
	let tempDir: string

	beforeEach(async () => {
		tempDir = path.join(os.tmpdir(), `robo-hooks-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
		await fs.mkdir(tempDir, { recursive: true })
		RoboPaths.configure({ baseDir: tempDir, customBuildDir: undefined })
	})

	afterEach(async () => {
		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch {
			// Ignore
		}
	})

	describe('createBuildStore()', () => {
		it('should create a new build store', () => {
			const store = createBuildStore()
			expect(store).toBeDefined()
			expect(typeof store.get).toBe('function')
			expect(typeof store.set).toBe('function')
			expect(typeof store.has).toBe('function')
			expect(typeof store.delete).toBe('function')
			expect(typeof store.clear).toBe('function')
		})

		it('should store and retrieve values', () => {
			const store = createBuildStore()

			store.set('key1', 'value1')
			store.set('key2', { nested: true })
			store.set('key3', 123)

			expect(store.get('key1')).toBe('value1')
			expect(store.get('key2')).toEqual({ nested: true })
			expect(store.get('key3')).toBe(123)
		})

		it('should return undefined for non-existent keys', () => {
			const store = createBuildStore()
			expect(store.get('nonexistent')).toBeUndefined()
		})

		it('should check if key exists with has()', () => {
			const store = createBuildStore()

			store.set('exists', true)

			expect(store.has('exists')).toBe(true)
			expect(store.has('missing')).toBe(false)
		})

		it('should delete keys', () => {
			const store = createBuildStore()

			store.set('toDelete', 'value')
			expect(store.has('toDelete')).toBe(true)

			store.delete('toDelete')
			expect(store.has('toDelete')).toBe(false)
		})

		it('should clear all values', () => {
			const store = createBuildStore()

			store.set('a', 1)
			store.set('b', 2)
			store.set('c', 3)

			store.clear()

			expect(store.has('a')).toBe(false)
			expect(store.has('b')).toBe(false)
			expect(store.has('c')).toBe(false)
		})

		it('should handle complex values', () => {
			const store = createBuildStore()

			const complexValue = {
				array: [1, 2, 3],
				nested: {
					deep: {
						value: 'test'
					}
				},
				date: new Date(),
				regex: /test/g
			}

			store.set('complex', complexValue)

			const retrieved = store.get('complex')
			expect(retrieved).toEqual(complexValue)
		})

		it('should be independent between instances', () => {
			const store1 = createBuildStore()
			const store2 = createBuildStore()

			store1.set('key', 'store1')
			store2.set('key', 'store2')

			expect(store1.get('key')).toBe('store1')
			expect(store2.get('key')).toBe('store2')
		})

		it('should overwrite existing values', () => {
			const store = createBuildStore()

			store.set('key', 'original')
			store.set('key', 'updated')

			expect(store.get('key')).toBe('updated')
		})

		it('should store null and undefined explicitly', () => {
			const store = createBuildStore()

			store.set('nullValue', null)
			store.set('undefinedValue', undefined)

			expect(store.get('nullValue')).toBeNull()
			expect(store.get('undefinedValue')).toBeUndefined()
			expect(store.has('nullValue')).toBe(true)
			expect(store.has('undefinedValue')).toBe(true)
		})
	})

	describe('resolveProjectBuildHookPath()', () => {
		describe('with default build directory', () => {
			it('should return null when hook file does not exist', async () => {
				const result = await resolveProjectBuildHookPath('start', 'production')
				expect(result).toBeNull()
			})

			it('should return path when start hook exists', async () => {
				// Create hook file in mode-specific location
				const hookDir = path.join(tempDir, '.robo', 'build', 'production', 'robo', 'build')
				await fs.mkdir(hookDir, { recursive: true })
				await fs.writeFile(path.join(hookDir, 'start.js'), 'export default () => {}')

				const result = await resolveProjectBuildHookPath('start', 'production')
				expect(result).toBe(path.join(hookDir, 'start.js'))
			})

			it('should return path when transform hook exists', async () => {
				const hookDir = path.join(tempDir, '.robo', 'build', 'production', 'robo', 'build')
				await fs.mkdir(hookDir, { recursive: true })
				await fs.writeFile(path.join(hookDir, 'transform.js'), 'export default () => {}')

				const result = await resolveProjectBuildHookPath('transform', 'production')
				expect(result).toBe(path.join(hookDir, 'transform.js'))
			})

			it('should return path when complete hook exists', async () => {
				const hookDir = path.join(tempDir, '.robo', 'build', 'production', 'robo', 'build')
				await fs.mkdir(hookDir, { recursive: true })
				await fs.writeFile(path.join(hookDir, 'complete.js'), 'export default () => {}')

				const result = await resolveProjectBuildHookPath('complete', 'production')
				expect(result).toBe(path.join(hookDir, 'complete.js'))
			})

			it('should use mode-specific path for development', async () => {
				const hookDir = path.join(tempDir, '.robo', 'build', 'development', 'robo', 'build')
				await fs.mkdir(hookDir, { recursive: true })
				await fs.writeFile(path.join(hookDir, 'start.js'), 'export default () => {}')

				const result = await resolveProjectBuildHookPath('start', 'development')
				expect(result).toContain('development')
			})

			it('should use mode-specific path for custom modes', async () => {
				const hookDir = path.join(tempDir, '.robo', 'build', 'staging', 'robo', 'build')
				await fs.mkdir(hookDir, { recursive: true })
				await fs.writeFile(path.join(hookDir, 'start.js'), 'export default () => {}')

				const result = await resolveProjectBuildHookPath('start', 'staging')
				expect(result).toContain('staging')
			})

			it('should default to production mode when mode is undefined', async () => {
				const hookDir = path.join(tempDir, '.robo', 'build', 'production', 'robo', 'build')
				await fs.mkdir(hookDir, { recursive: true })
				await fs.writeFile(path.join(hookDir, 'start.js'), 'export default () => {}')

				const result = await resolveProjectBuildHookPath('start')
				expect(result).toContain('production')
			})
		})

		describe('with custom build directory', () => {
			it('should use custom static build directory', async () => {
				RoboPaths.configure({ customBuildDir: 'dist' })

				const hookDir = path.join(tempDir, 'dist', 'robo', 'build')
				await fs.mkdir(hookDir, { recursive: true })
				await fs.writeFile(path.join(hookDir, 'start.js'), 'export default () => {}')

				const result = await resolveProjectBuildHookPath('start', 'production')
				expect(result).toContain('dist')
				expect(result).not.toContain('.robo')
			})

			it('should use custom dynamic build directory', async () => {
				RoboPaths.configure({ customBuildDir: (ctx) => `out/${ctx.mode}` })

				const hookDir = path.join(tempDir, 'out', 'staging', 'robo', 'build')
				await fs.mkdir(hookDir, { recursive: true })
				await fs.writeFile(path.join(hookDir, 'start.js'), 'export default () => {}')

				const result = await resolveProjectBuildHookPath('start', 'staging')
				expect(result).toContain('out')
				expect(result).toContain('staging')
			})
		})
	})

	describe('resolvePluginBuildHookPath()', () => {
		const pluginName = '@robojs/test-plugin'

		it('should return null when plugin hook does not exist', async () => {
			const result = await resolvePluginBuildHookPath(pluginName, 'start')
			expect(result).toBeNull()
		})

		it('should find hook in .robo/build location', async () => {
			const hookDir = path.join(tempDir, 'node_modules', pluginName, '.robo', 'build', 'robo', 'build')
			await fs.mkdir(hookDir, { recursive: true })
			await fs.writeFile(path.join(hookDir, 'start.js'), 'export default () => {}')

			const result = await resolvePluginBuildHookPath(pluginName, 'start')
			expect(result).toBe(path.join(hookDir, 'start.js'))
		})

		/**
		 * NOTE: Legacy dist location test is skipped because the implementation uses
		 * process.cwd() directly for the legacy path, not RoboPaths.baseDir.
		 * This test would require files under the actual cwd.
		 */
		it.skip('should find hook in legacy dist location (uses process.cwd())', async () => {
			// Legacy dist location uses process.cwd() directly, making isolated testing difficult
			// In production, this path would be: ${cwd}/node_modules/${plugin}/dist/robo/build/
		})

		it('should prefer .robo/build over dist', async () => {
			// Create both locations
			const roboBuildDir = path.join(tempDir, 'node_modules', pluginName, '.robo', 'build', 'robo', 'build')
			const distDir = path.join(tempDir, 'node_modules', pluginName, 'dist', 'robo', 'build')

			await fs.mkdir(roboBuildDir, { recursive: true })
			await fs.mkdir(distDir, { recursive: true })

			await fs.writeFile(path.join(roboBuildDir, 'start.js'), '// robo build')
			await fs.writeFile(path.join(distDir, 'start.js'), '// dist')

			const result = await resolvePluginBuildHookPath(pluginName, 'start')
			expect(result).toContain('.robo')
		})

		it('should not include mode in plugin hook path', async () => {
			const hookDir = path.join(tempDir, 'node_modules', pluginName, '.robo', 'build', 'robo', 'build')
			await fs.mkdir(hookDir, { recursive: true })
			await fs.writeFile(path.join(hookDir, 'start.js'), 'export default () => {}')

			const result = await resolvePluginBuildHookPath(pluginName, 'start')
			expect(result).not.toContain('production')
			expect(result).not.toContain('development')
		})

		it('should resolve transform hook for plugin', async () => {
			const hookDir = path.join(tempDir, 'node_modules', pluginName, '.robo', 'build', 'robo', 'build')
			await fs.mkdir(hookDir, { recursive: true })
			await fs.writeFile(path.join(hookDir, 'transform.js'), 'export default () => {}')

			const result = await resolvePluginBuildHookPath(pluginName, 'transform')
			expect(result).toContain('transform.js')
		})

		it('should resolve complete hook for plugin', async () => {
			const hookDir = path.join(tempDir, 'node_modules', pluginName, '.robo', 'build', 'robo', 'build')
			await fs.mkdir(hookDir, { recursive: true })
			await fs.writeFile(path.join(hookDir, 'complete.js'), 'export default () => {}')

			const result = await resolvePluginBuildHookPath(pluginName, 'complete')
			expect(result).toContain('complete.js')
		})

		it('should handle scoped package names', async () => {
			const scopedPlugin = '@company/my-plugin'
			const hookDir = path.join(tempDir, 'node_modules', scopedPlugin, '.robo', 'build', 'robo', 'build')
			await fs.mkdir(hookDir, { recursive: true })
			await fs.writeFile(path.join(hookDir, 'start.js'), 'export default () => {}')

			const result = await resolvePluginBuildHookPath(scopedPlugin, 'start')
			expect(result).toContain('@company')
			expect(result).toContain('my-plugin')
		})

		it('should handle non-scoped package names', async () => {
			const plugin = 'robo-plugin-test'
			const hookDir = path.join(tempDir, 'node_modules', plugin, '.robo', 'build', 'robo', 'build')
			await fs.mkdir(hookDir, { recursive: true })
			await fs.writeFile(path.join(hookDir, 'start.js'), 'export default () => {}')

			const result = await resolvePluginBuildHookPath(plugin, 'start')
			expect(result).toContain('robo-plugin-test')
		})
	})

	describe('hasBuildHooks()', () => {
		it('should return false when no hooks exist', async () => {
			const plugins = new Map()
			const result = await hasBuildHooks(plugins, 'production')
			expect(result).toBe(false)
		})

		it('should return true when project start hook exists', async () => {
			const hookDir = path.join(tempDir, '.robo', 'build', 'production', 'robo', 'build')
			await fs.mkdir(hookDir, { recursive: true })
			await fs.writeFile(path.join(hookDir, 'start.js'), 'export default () => {}')

			const plugins = new Map()
			const result = await hasBuildHooks(plugins, 'production')
			expect(result).toBe(true)
		})

		it('should return true when project transform hook exists', async () => {
			const hookDir = path.join(tempDir, '.robo', 'build', 'production', 'robo', 'build')
			await fs.mkdir(hookDir, { recursive: true })
			await fs.writeFile(path.join(hookDir, 'transform.js'), 'export default () => {}')

			const plugins = new Map()
			const result = await hasBuildHooks(plugins, 'production')
			expect(result).toBe(true)
		})

		it('should return true when project complete hook exists', async () => {
			const hookDir = path.join(tempDir, '.robo', 'build', 'production', 'robo', 'build')
			await fs.mkdir(hookDir, { recursive: true })
			await fs.writeFile(path.join(hookDir, 'complete.js'), 'export default () => {}')

			const plugins = new Map()
			const result = await hasBuildHooks(plugins, 'production')
			expect(result).toBe(true)
		})

		it('should return true when plugin has build hook', async () => {
			const pluginName = '@robojs/test-plugin'
			const hookDir = path.join(tempDir, 'node_modules', pluginName, '.robo', 'build', 'robo', 'build')
			await fs.mkdir(hookDir, { recursive: true })
			await fs.writeFile(path.join(hookDir, 'start.js'), 'export default () => {}')

			const plugins = new Map([[pluginName, { name: pluginName }]])
			const result = await hasBuildHooks(plugins, 'production')
			expect(result).toBe(true)
		})

		it('should check all hook types for project', async () => {
			const hookDir = path.join(tempDir, '.robo', 'build', 'production', 'robo', 'build')
			await fs.mkdir(hookDir, { recursive: true })

			// No hooks initially
			const plugins = new Map()
			expect(await hasBuildHooks(plugins, 'production')).toBe(false)

			// Add complete hook
			await fs.writeFile(path.join(hookDir, 'complete.js'), 'export default () => {}')
			expect(await hasBuildHooks(plugins, 'production')).toBe(true)
		})

		it('should use mode-specific paths', async () => {
			// Create hook in development mode
			const devHookDir = path.join(tempDir, '.robo', 'build', 'development', 'robo', 'build')
			await fs.mkdir(devHookDir, { recursive: true })
			await fs.writeFile(path.join(devHookDir, 'start.js'), 'export default () => {}')

			const plugins = new Map()

			// Should find in development
			expect(await hasBuildHooks(plugins, 'development')).toBe(true)

			// Should NOT find in production
			expect(await hasBuildHooks(plugins, 'production')).toBe(false)
		})

		it('should check multiple plugins', async () => {
			const plugin1 = '@robojs/plugin1'
			const plugin2 = '@robojs/plugin2'

			// Only plugin2 has a hook
			const hookDir = path.join(tempDir, 'node_modules', plugin2, '.robo', 'build', 'robo', 'build')
			await fs.mkdir(hookDir, { recursive: true })
			await fs.writeFile(path.join(hookDir, 'transform.js'), 'export default () => {}')

			const plugins = new Map([
				[plugin1, { name: plugin1 }],
				[plugin2, { name: plugin2 }]
			])

			const result = await hasBuildHooks(plugins, 'production')
			expect(result).toBe(true)
		})
	})
})

/**
 * Tests for hook context with custom build directories.
 *
 * These tests verify that when RoboPaths.configure() is called with a custom
 * build directory BEFORE hook execution, hooks receive the correct paths.output.
 *
 * This validates the fix for the bug where hooks received wrong output paths
 * because RoboPaths.configure() was called AFTER hook execution.
 */
describe('Build Hooks - Custom Build Directory Context', () => {
	let tempDir: string

	beforeEach(async () => {
		tempDir = path.join(os.tmpdir(), `robo-hooks-custom-${Date.now()}-${Math.random().toString(36).slice(2)}`)
		await fs.mkdir(tempDir, { recursive: true })
		RoboPaths.configure({ baseDir: tempDir, customBuildDir: undefined })
	})

	afterEach(async () => {
		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch {
			// Ignore
		}
	})

	it('should resolve paths.output with custom static build directory', () => {
		// Configure with custom build directory (this simulates what build command does)
		RoboPaths.configure({ customBuildDir: 'custom-out' })

		// Verify RoboPaths.build() returns custom path (this is what hooks use for context.paths.output)
		const outputPath = RoboPaths.build('production')
		expect(outputPath).toBe(path.join(tempDir, 'custom-out'))
		expect(outputPath).not.toContain('.robo')
	})

	it('should resolve paths.output with custom dynamic build directory', () => {
		// Configure with dynamic build directory function
		RoboPaths.configure({ customBuildDir: (ctx) => `dist/${ctx.mode}` })

		// Verify different modes produce different paths
		expect(RoboPaths.build('production')).toBe(path.join(tempDir, 'dist', 'production'))
		expect(RoboPaths.build('development')).toBe(path.join(tempDir, 'dist', 'development'))
		expect(RoboPaths.build('staging')).toBe(path.join(tempDir, 'dist', 'staging'))
	})

	it('should use default mode-specific path when customBuildDir is undefined', () => {
		// Clear custom build directory
		RoboPaths.configure({ customBuildDir: undefined })

		// Verify default behavior
		expect(RoboPaths.build('production')).toBe(path.join(tempDir, '.robo', 'build', 'production'))
		expect(RoboPaths.build('development')).toBe(path.join(tempDir, '.robo', 'build', 'development'))
	})

	it('should resolve hook paths with custom build directory', async () => {
		RoboPaths.configure({ customBuildDir: 'custom-dist' })

		// Create hook in custom location
		const hookDir = path.join(tempDir, 'custom-dist', 'robo', 'build')
		await fs.mkdir(hookDir, { recursive: true })
		await fs.writeFile(path.join(hookDir, 'start.js'), 'export default () => {}')

		// Hook resolution should find it in custom location
		const result = await resolveProjectBuildHookPath('start', 'production')
		expect(result).toBe(path.join(hookDir, 'start.js'))
		expect(result).toContain('custom-dist')
	})

	it('should resolve hook paths with dynamic custom build directory', async () => {
		RoboPaths.configure({ customBuildDir: (ctx) => `builds/${ctx.mode}` })

		// Create hooks in mode-specific custom locations
		const prodHookDir = path.join(tempDir, 'builds', 'production', 'robo', 'build')
		const devHookDir = path.join(tempDir, 'builds', 'development', 'robo', 'build')

		await fs.mkdir(prodHookDir, { recursive: true })
		await fs.mkdir(devHookDir, { recursive: true })

		await fs.writeFile(path.join(prodHookDir, 'start.js'), '// production hook')
		await fs.writeFile(path.join(devHookDir, 'start.js'), '// development hook')

		// Each mode should find its own hook
		const prodResult = await resolveProjectBuildHookPath('start', 'production')
		const devResult = await resolveProjectBuildHookPath('start', 'development')

		expect(prodResult).toContain('builds')
		expect(prodResult).toContain('production')
		expect(devResult).toContain('builds')
		expect(devResult).toContain('development')
	})
})

describe('Build Hooks - Mode Isolation', () => {
	let tempDir: string

	beforeEach(async () => {
		tempDir = path.join(os.tmpdir(), `robo-hooks-isolation-${Date.now()}-${Math.random().toString(36).slice(2)}`)
		await fs.mkdir(tempDir, { recursive: true })
		RoboPaths.configure({ baseDir: tempDir, customBuildDir: undefined })
	})

	afterEach(async () => {
		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch {
			// Ignore
		}
	})

	it('should find hooks only in the correct mode directory', async () => {
		// Create hooks in different modes
		const modes = ['production', 'development', 'staging']

		for (const mode of modes) {
			const hookDir = path.join(tempDir, '.robo', 'build', mode, 'robo', 'build')
			await fs.mkdir(hookDir, { recursive: true })
			await fs.writeFile(path.join(hookDir, 'start.js'), `// ${mode} hook`)
		}

		// Each mode should find its own hook
		for (const mode of modes) {
			const result = await resolveProjectBuildHookPath('start', mode)
			expect(result).toContain(mode)

			// Verify content
			const content = await fs.readFile(result!, 'utf-8')
			expect(content).toContain(mode)
		}
	})

	it('should not cross-contaminate between modes', async () => {
		// Only create hook in production
		const hookDir = path.join(tempDir, '.robo', 'build', 'production', 'robo', 'build')
		await fs.mkdir(hookDir, { recursive: true })
		await fs.writeFile(path.join(hookDir, 'start.js'), 'export default () => {}')

		// Production should find it
		expect(await resolveProjectBuildHookPath('start', 'production')).not.toBeNull()

		// Other modes should not find it
		expect(await resolveProjectBuildHookPath('start', 'development')).toBeNull()
		expect(await resolveProjectBuildHookPath('start', 'staging')).toBeNull()
		expect(await resolveProjectBuildHookPath('start', 'beta')).toBeNull()
	})
})
