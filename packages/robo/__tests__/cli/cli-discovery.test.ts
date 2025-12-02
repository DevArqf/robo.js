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
			projectDir = path.join(tempDir, `project-${Date.now()}`)
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
			const emptyProject = path.join(tempDir, `empty-${Date.now()}`)
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

	// Note: Runtime Discovery tests (discoverCliAtRuntime, discoverProjectCli, discoverPluginCli)
	// require Robo config infrastructure (loadConfig, getConfig) and are documented in MOCK_REQUIRED_TESTS.md
	// Those tests would require mocking the config module to work properly.
})
