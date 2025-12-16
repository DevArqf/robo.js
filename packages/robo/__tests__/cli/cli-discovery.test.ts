// @ts-nocheck
/**
 * Tests for CLI Discovery Functions
 *
 * Tests discoverProjectCli and loadCliManifest with real filesystem operations.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// We need to mock process.cwd() for these tests since the discovery functions use it
describe('CLI Discovery Functions', () => {
	let tempDir: string
	let originalCwd: string
	let testCounter = 0

	// Helper to get unique directory names
	const uniqueDir = (prefix: string) => `${prefix}-${Date.now()}-${++testCounter}`

	beforeAll(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'robo-discovery-test-'))
		originalCwd = process.cwd()
	})

	afterAll(async () => {
		process.chdir(originalCwd)
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	describe('loadCliManifest - File-based loading', () => {
		let projectDir: string

		beforeEach(async () => {
			projectDir = path.join(tempDir, uniqueDir('project'))
			await fs.mkdir(path.join(projectDir, '.robo', 'manifest', 'cli'), { recursive: true })
			process.chdir(projectDir)
		})

		afterEach(() => {
			// Clear cached manifest between tests
			// The loader caches manifests, so we need to work around that
		})

		it('should load manifest from @.json file', async () => {
			const manifest = {
				commands: {
					deploy: {
						path: '/path/to/deploy.js',
						plugin: '@robojs/deploy',
						description: 'Deploy application',
						priority: 0
					}
				},
				extensions: {}
			}

			await fs.writeFile(
				path.join(projectDir, '.robo', 'manifest', 'cli', '@.json'),
				JSON.stringify(manifest)
			)

			// Import dynamically to get fresh module
			const { loadCliManifest, clearCliManifestCache } = await import('../../dist/cli/utils/cli-loader.js')
			clearCliManifestCache()

			const loaded = await loadCliManifest()

			expect(loaded).not.toBeNull()
			expect(loaded.commands['deploy']).toBeDefined()
			expect(loaded.commands['deploy'].description).toBe('Deploy application')
		})

		it('should return null when no manifest and no CLI directories exist', async () => {
			// Empty project with no manifest
			const emptyProject = path.join(tempDir, uniqueDir('empty'))
			await fs.mkdir(emptyProject, { recursive: true })
			process.chdir(emptyProject)

			const { loadCliManifest, clearCliManifestCache } = await import('../../dist/cli/utils/cli-loader.js')
			clearCliManifestCache()

			const loaded = await loadCliManifest()

			// Should return null (no manifest, no CLI directories)
			expect(loaded).toBeNull()
		})

		it('should parse manifest with extensions', async () => {
			const manifest = {
				commands: {
					start: {
						path: '/start.js',
						plugin: null,
						description: 'Start server',
						priority: 100
					}
				},
				extensions: {
					start: [
						{
							path: '/ext/start.js',
							plugin: '@robojs/metrics',
							priority: 10,
							hasBefore: true,
							hasAfter: false
						}
					]
				}
			}

			await fs.writeFile(
				path.join(projectDir, '.robo', 'manifest', 'cli', '@.json'),
				JSON.stringify(manifest)
			)

			const { loadCliManifest, clearCliManifestCache } = await import('../../dist/cli/utils/cli-loader.js')
			clearCliManifestCache()

			const loaded = await loadCliManifest()

			expect(loaded.extensions['start']).toHaveLength(1)
			expect(loaded.extensions['start'][0].plugin).toBe('@robojs/metrics')
		})
	})

	describe('discoverPluginsFromFilesystem', () => {
		let projectDir: string

		beforeEach(async () => {
			projectDir = path.join(tempDir, uniqueDir('discover'))
			await fs.mkdir(projectDir, { recursive: true })
			process.chdir(projectDir)
		})

		describe('scoped plugins', () => {
			it('should discover @robojs/mock from config/plugins/robojs/mock.ts', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins', 'robojs'), { recursive: true })
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'robojs', 'mock.ts'), 'export default {}')

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toContain('@robojs/mock')
			})

			it('should discover multiple scoped plugins in same scope', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins', 'robojs'), { recursive: true })
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'robojs', 'mock.ts'), '')
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'robojs', 'server.ts'), '')
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'robojs', 'ai.mjs'), '')

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toContain('@robojs/mock')
				expect(plugins).toContain('@robojs/server')
				expect(plugins).toContain('@robojs/ai')
			})

			it('should discover plugins from multiple scopes', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins', 'robojs'), { recursive: true })
				await fs.mkdir(path.join(projectDir, 'config', 'plugins', 'myorg'), { recursive: true })
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'robojs', 'mock.ts'), '')
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'myorg', 'custom.ts'), '')

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toContain('@robojs/mock')
				expect(plugins).toContain('@myorg/custom')
			})

			it('should handle single-letter scopes', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins', 'a'), { recursive: true })
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'a', 'plugin.ts'), '')

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toContain('@a/plugin')
			})

			it('should handle hyphenated scopes', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins', 'my-org'), { recursive: true })
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'my-org', 'plugin.ts'), '')

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toContain('@my-org/plugin')
			})
		})

		describe('non-scoped plugins', () => {
			it('should discover non-scoped plugin from config/plugins/plugin-ai.ts', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins'), { recursive: true })
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'plugin-ai.ts'), '')

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toContain('plugin-ai')
			})

			it('should discover plugins with various names', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins'), { recursive: true })
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'my-plugin.ts'), '')
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'plugin-v2.ts'), '')
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'my_plugin.ts'), '')

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toContain('my-plugin')
				expect(plugins).toContain('plugin-v2')
				expect(plugins).toContain('my_plugin')
			})
		})

		describe('file extension handling', () => {
			it('should discover plugins with .ts extension', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins'), { recursive: true })
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'plugin-a.ts'), '')

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toContain('plugin-a')
			})

			it('should discover plugins with .tsx extension', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins'), { recursive: true })
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'plugin-b.tsx'), '')

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toContain('plugin-b')
			})

			it('should discover plugins with .mjs extension', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins'), { recursive: true })
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'plugin-c.mjs'), '')

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toContain('plugin-c')
			})

			it('should discover plugins with .js extension', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins'), { recursive: true })
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'plugin-d.js'), '')

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toContain('plugin-d')
			})

			it('should discover plugins with .cjs extension', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins'), { recursive: true })
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'plugin-e.cjs'), '')

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toContain('plugin-e')
			})

			it('should discover plugins with mixed extensions in same directory', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins'), { recursive: true })
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'plugin-a.ts'), '')
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'plugin-b.tsx'), '')
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'plugin-c.mjs'), '')
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'plugin-d.js'), '')
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'plugin-e.cjs'), '')

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toContain('plugin-a')
				expect(plugins).toContain('plugin-b')
				expect(plugins).toContain('plugin-c')
				expect(plugins).toContain('plugin-d')
				expect(plugins).toContain('plugin-e')
			})
		})

		describe('files to ignore', () => {
			it('should ignore README.md files', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins'), { recursive: true })
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'README.md'), '')
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'real-plugin.ts'), '')

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).not.toContain('README')
				expect(plugins).toContain('real-plugin')
			})

			it('should ignore .gitkeep files', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins'), { recursive: true })
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', '.gitkeep'), '')
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'real-plugin.ts'), '')

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toHaveLength(1)
				expect(plugins).toContain('real-plugin')
			})

			it('should ignore .json files', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins'), { recursive: true })
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'config.json'), '')
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'real-plugin.ts'), '')

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).not.toContain('config')
				expect(plugins).toContain('real-plugin')
			})

			it('should ignore files without valid extensions', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins'), { recursive: true })
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'no-extension'), '')
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'real-plugin.ts'), '')

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toHaveLength(1)
				expect(plugins).toContain('real-plugin')
			})
		})

		describe('mixed scoped and non-scoped plugins', () => {
			it('should discover both scoped and non-scoped plugins', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins', 'robojs'), { recursive: true })
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'robojs', 'mock.ts'), '')
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'my-plugin.ts'), '')

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toContain('@robojs/mock')
				expect(plugins).toContain('my-plugin')
			})

			it('should handle file named like a scope', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins', 'robojs'), { recursive: true })
				// A file named robojs.ts at the plugins level (non-scoped)
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'robojs.ts'), '')
				// A plugin in the robojs scope directory
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'robojs', 'mock.ts'), '')

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toContain('@robojs/mock')
				// The directory entry will be processed as a scope, not a file
				// since it's a directory. The file robojs.ts should not appear
				// because we only process files, not directories with .ts suffix
			})
		})

		describe('edge cases', () => {
			it('should return empty array when no config/plugins directory', async () => {
				// No plugins directory at all
				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toEqual([])
			})

			it('should return empty array when config/plugins is empty', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins'), { recursive: true })

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toEqual([])
			})

			it('should return empty array when no config directory', async () => {
				// Just an empty project
				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toEqual([])
			})

			it('should ignore empty scope directories', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins', 'emptyorg'), { recursive: true })

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toEqual([])
			})

			it('should only scan one level deep in scope directories', async () => {
				// Deeply nested files should be ignored
				await fs.mkdir(path.join(projectDir, 'config', 'plugins', 'robojs', 'nested'), { recursive: true })
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'robojs', 'nested', 'deep.ts'), '')
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'robojs', 'mock.ts'), '')

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				// Should only find @robojs/mock, not @robojs/nested or anything deeper
				expect(plugins).toContain('@robojs/mock')
				expect(plugins).not.toContain('@robojs/nested')
				expect(plugins).not.toContain('@robojs/deep')
				expect(plugins.filter((p) => p.startsWith('@robojs/'))).toHaveLength(1)
			})

			it('should handle plugins with dots in name', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins'), { recursive: true })
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'plugin.legacy.ts'), '')

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toContain('plugin.legacy')
			})
		})

		describe('realistic scenarios', () => {
			it('should handle mockbot-ts plugin structure', async () => {
				// Simulate mockbot-ts config/plugins structure
				await fs.mkdir(path.join(projectDir, 'config', 'plugins', 'robojs'), { recursive: true })
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'robojs', 'mock.ts'), '')
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'robojs', 'server.ts'), '')
				await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'robojs', 'discordjs.ts'), '')

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toContain('@robojs/mock')
				expect(plugins).toContain('@robojs/server')
				expect(plugins).toContain('@robojs/discordjs')
				expect(plugins).toHaveLength(3)
			})

			it('should handle project with 10+ plugins', async () => {
				await fs.mkdir(path.join(projectDir, 'config', 'plugins', 'robojs'), { recursive: true })
				await fs.mkdir(path.join(projectDir, 'config', 'plugins', 'myorg'), { recursive: true })

				// 5 scoped robojs plugins
				for (const name of ['mock', 'server', 'ai', 'trpc', 'analytics']) {
					await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'robojs', `${name}.ts`), '')
				}

				// 3 scoped myorg plugins
				for (const name of ['custom', 'internal', 'utils']) {
					await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'myorg', `${name}.ts`), '')
				}

				// 4 non-scoped plugins
				for (const name of ['plugin-a', 'plugin-b', 'plugin-c', 'plugin-d']) {
					await fs.writeFile(path.join(projectDir, 'config', 'plugins', `${name}.ts`), '')
				}

				const { discoverPluginsFromFilesystem } = await import('../../dist/cli/utils/cli-loader.js')
				const plugins = await discoverPluginsFromFilesystem()

				expect(plugins).toHaveLength(12)
				expect(plugins).toContain('@robojs/mock')
				expect(plugins).toContain('@robojs/analytics')
				expect(plugins).toContain('@myorg/custom')
				expect(plugins).toContain('plugin-a')
			})
		})
	})

	describe('Runtime Discovery Integration', () => {
		let projectDir: string

		beforeEach(async () => {
			projectDir = path.join(tempDir, uniqueDir('runtime'))
			await fs.mkdir(projectDir, { recursive: true })
			process.chdir(projectDir)
		})

		it('should work before any build has been run (no .robo directory)', async () => {
			// No .robo directory - simulates fresh project
			await fs.mkdir(path.join(projectDir, 'config', 'plugins', 'robojs'), { recursive: true })
			await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'robojs', 'mock.ts'), '')

			// No node_modules, but plugins are discovered from config
			const { discoverPluginsFromFilesystem, loadCliManifest, clearCliManifestCache } = await import(
				'../../dist/cli/utils/cli-loader.js'
			)
			clearCliManifestCache()

			const plugins = await discoverPluginsFromFilesystem()
			expect(plugins).toContain('@robojs/mock')

			// loadCliManifest will attempt runtime discovery, which will find the plugins
			// but fail to find CLI dirs (no node_modules)
			const manifest = await loadCliManifest()
			// Should return null since no actual CLI files exist
			expect(manifest).toBeNull()
		})

		it('should prefer manifest file when available', async () => {
			// Create a manifest file
			await fs.mkdir(path.join(projectDir, '.robo', 'manifest', 'cli'), { recursive: true })
			await fs.mkdir(path.join(projectDir, 'config', 'plugins', 'robojs'), { recursive: true })

			const manifest = {
				commands: {
					test: {
						path: '/path/to/test.js',
						plugin: '@robojs/test',
						description: 'Test command from manifest',
						priority: 0
					}
				},
				extensions: {}
			}
			await fs.writeFile(
				path.join(projectDir, '.robo', 'manifest', 'cli', '@.json'),
				JSON.stringify(manifest)
			)

			// Also have a plugin in config (won't be discovered since manifest exists)
			await fs.writeFile(path.join(projectDir, 'config', 'plugins', 'robojs', 'mock.ts'), '')

			const { loadCliManifest, clearCliManifestCache } = await import('../../dist/cli/utils/cli-loader.js')
			clearCliManifestCache()

			const loaded = await loadCliManifest()

			// Should load from manifest file, not discover at runtime
			expect(loaded).not.toBeNull()
			expect(loaded.commands['test']).toBeDefined()
			expect(loaded.commands['test'].description).toBe('Test command from manifest')
		})
	})
})
