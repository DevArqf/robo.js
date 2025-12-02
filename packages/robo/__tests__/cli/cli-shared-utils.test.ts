// @ts-nocheck
/**
 * Tests for CLI Shared Utilities
 *
 * Tests utility functions in cli-shared.ts excluding parseCliOptions
 * which has its own comprehensive test file.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
	pathExists,
	getProjectCliDir,
	getPluginCliPaths,
	mergeExtensions,
	applySubcommands,
	PROJECT_PRIORITY_BOOST,
	parseCliOptions
} from '../../dist/cli/utils/cli-shared.js'

describe('CLI Shared Utilities', () => {
	describe('PROJECT_PRIORITY_BOOST', () => {
		it('should be a positive number', () => {
			expect(typeof PROJECT_PRIORITY_BOOST).toBe('number')
			expect(PROJECT_PRIORITY_BOOST).toBeGreaterThan(0)
		})

		it('should be 100', () => {
			expect(PROJECT_PRIORITY_BOOST).toBe(100)
		})
	})

	describe('pathExists', () => {
		let tempDir: string

		beforeAll(async () => {
			tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cli-test-'))
		})

		afterAll(async () => {
			await fs.rm(tempDir, { recursive: true, force: true })
		})

		it('should return true for existing directory', async () => {
			const result = await pathExists(tempDir)
			expect(result).toBe(true)
		})

		it('should return true for existing file', async () => {
			const testFile = path.join(tempDir, 'test.txt')
			await fs.writeFile(testFile, 'test content')

			const result = await pathExists(testFile)
			expect(result).toBe(true)
		})

		it('should return false for non-existing path', async () => {
			const result = await pathExists(path.join(tempDir, 'nonexistent'))
			expect(result).toBe(false)
		})

		it('should return false for empty string path', async () => {
			const result = await pathExists('')
			expect(result).toBe(false)
		})
	})

	describe('getProjectCliDir', () => {
		it('should return path under .robo/build/robo/cli', () => {
			const result = getProjectCliDir()
			expect(result).toContain('.robo')
			expect(result).toContain('build')
			expect(result).toContain('robo')
			expect(result).toContain('cli')
		})

		it('should return absolute path', () => {
			const result = getProjectCliDir()
			expect(path.isAbsolute(result)).toBe(true)
		})

		it('should be based on current working directory', () => {
			const result = getProjectCliDir()
			expect(result.startsWith(process.cwd())).toBe(true)
		})
	})

	describe('getPluginCliPaths', () => {
		it('should return array of possible paths', () => {
			const result = getPluginCliPaths('@robojs/test-plugin')
			expect(Array.isArray(result)).toBe(true)
			expect(result.length).toBeGreaterThan(0)
		})

		it('should include node_modules path', () => {
			const result = getPluginCliPaths('@robojs/test-plugin')
			const hasNodeModules = result.some((p) => p.includes('node_modules'))
			expect(hasNodeModules).toBe(true)
		})

		it('should include .robo/build path', () => {
			const result = getPluginCliPaths('@robojs/test-plugin')
			const hasRoboBuild = result.some((p) => p.includes('.robo') && p.includes('build'))
			expect(hasRoboBuild).toBe(true)
		})

		it('should include dist path', () => {
			const result = getPluginCliPaths('@robojs/test-plugin')
			const hasDist = result.some((p) => p.includes('dist'))
			expect(hasDist).toBe(true)
		})

		it('should handle scoped package names', () => {
			const result = getPluginCliPaths('@scope/package')
			const allContainPackageName = result.every((p) => p.includes('@scope/package') || p.includes('@scope'))
			expect(allContainPackageName).toBe(true)
		})

		it('should handle unscoped package names', () => {
			const result = getPluginCliPaths('simple-plugin')
			const allContainPackageName = result.every((p) => p.includes('simple-plugin'))
			expect(allContainPackageName).toBe(true)
		})
	})

	describe('mergeExtensions', () => {
		it('should return empty object for no sources', () => {
			const result = mergeExtensions()
			expect(result).toEqual({})
		})

		it('should return single source unchanged', () => {
			const source: Record<string, CliExtensionEntry[]> = {
				dev: [
					{ path: '/path/to/ext.js', plugin: 'plugin-a', priority: 0 }
				]
			}
			const result = mergeExtensions(source)
			expect(result).toEqual(source)
		})

		it('should merge extensions from multiple sources', () => {
			const source1: Record<string, CliExtensionEntry[]> = {
				dev: [{ path: '/a.js', plugin: 'plugin-a', priority: 0 }]
			}
			const source2: Record<string, CliExtensionEntry[]> = {
				dev: [{ path: '/b.js', plugin: 'plugin-b', priority: 0 }]
			}

			const result = mergeExtensions(source1, source2)
			expect(result.dev).toHaveLength(2)
		})

		it('should merge extensions for different commands', () => {
			const source1: Record<string, CliExtensionEntry[]> = {
				dev: [{ path: '/dev-ext.js', plugin: 'plugin-a', priority: 0 }]
			}
			const source2: Record<string, CliExtensionEntry[]> = {
				build: [{ path: '/build-ext.js', plugin: 'plugin-b', priority: 0 }]
			}

			const result = mergeExtensions(source1, source2)
			expect(result.dev).toBeDefined()
			expect(result.build).toBeDefined()
		})

		it('should sort extensions by priority (highest first)', () => {
			const source1: Record<string, CliExtensionEntry[]> = {
				dev: [
					{ path: '/low.js', plugin: 'plugin-low', priority: 1 }
				]
			}
			const source2: Record<string, CliExtensionEntry[]> = {
				dev: [
					{ path: '/high.js', plugin: 'plugin-high', priority: 100 }
				]
			}
			const source3: Record<string, CliExtensionEntry[]> = {
				dev: [
					{ path: '/medium.js', plugin: 'plugin-medium', priority: 50 }
				]
			}

			const result = mergeExtensions(source1, source2, source3)

			expect(result.dev[0].priority).toBe(100)
			expect(result.dev[1].priority).toBe(50)
			expect(result.dev[2].priority).toBe(1)
		})

		it('should handle empty arrays in sources', () => {
			const source1: Record<string, CliExtensionEntry[]> = {
				dev: []
			}
			const source2: Record<string, CliExtensionEntry[]> = {
				dev: [{ path: '/ext.js', plugin: 'plugin', priority: 0 }]
			}

			const result = mergeExtensions(source1, source2)
			expect(result.dev).toHaveLength(1)
		})
	})

	describe('applySubcommands', () => {
		it('should not modify commands when subcommandMap is empty', () => {
			const commands: Record<string, CliCommandEntry> = {
				dev: { path: '/dev.js', plugin: null, description: 'Dev', priority: 0 }
			}
			const subcommandMap = new Map<string, string[]>()

			applySubcommands(commands, subcommandMap)

			expect(commands.dev.subcommands).toBeUndefined()
		})

		it('should apply subcommands to parent command', () => {
			const commands: Record<string, CliCommandEntry> = {
				config: { path: '/config.js', plugin: null, description: 'Config', priority: 0 },
				'config get': { path: '/config/get.js', plugin: null, description: 'Get', priority: 0 },
				'config set': { path: '/config/set.js', plugin: null, description: 'Set', priority: 0 }
			}
			const subcommandMap = new Map<string, string[]>([
				['config', ['get', 'set']]
			])

			applySubcommands(commands, subcommandMap)

			expect(commands.config.subcommands).toEqual(['get', 'set'])
		})

		it('should handle nested subcommands', () => {
			const commands: Record<string, CliCommandEntry> = {
				service: { path: '/service.js', plugin: null, description: 'Service', priority: 0 },
				'service db': { path: '/service/db.js', plugin: null, description: 'DB', priority: 0 },
				'service db connect': { path: '/service/db/connect.js', plugin: null, description: 'Connect', priority: 0 }
			}
			const subcommandMap = new Map<string, string[]>([
				['service', ['db']],
				['service db', ['connect']]
			])

			applySubcommands(commands, subcommandMap)

			expect(commands.service.subcommands).toEqual(['db'])
			expect(commands['service db'].subcommands).toEqual(['connect'])
		})

		it('should not add subcommands if parent does not exist', () => {
			const commands: Record<string, CliCommandEntry> = {
				'config get': { path: '/config/get.js', plugin: null, description: 'Get', priority: 0 }
			}
			const subcommandMap = new Map<string, string[]>([
				['config', ['get', 'set']]
			])

			// Should not throw
			expect(() => applySubcommands(commands, subcommandMap)).not.toThrow()

			// Parent doesn't exist, so nothing to modify
			expect(commands['config']).toBeUndefined()
		})

		it('should handle multiple parents with subcommands', () => {
			const commands: Record<string, CliCommandEntry> = {
				config: { path: '/config.js', plugin: null, description: 'Config', priority: 0 },
				'config get': { path: '/config/get.js', plugin: null, description: 'Get', priority: 0 },
				deploy: { path: '/deploy.js', plugin: null, description: 'Deploy', priority: 0 },
				'deploy staging': { path: '/deploy/staging.js', plugin: null, description: 'Staging', priority: 0 }
			}
			const subcommandMap = new Map<string, string[]>([
				['config', ['get']],
				['deploy', ['staging']]
			])

			applySubcommands(commands, subcommandMap)

			expect(commands.config.subcommands).toEqual(['get'])
			expect(commands.deploy.subcommands).toEqual(['staging'])
		})
	})
})

describe('Option Validation (via parseCliOptions behavior)', () => {
	// These tests verify the internal validateOptions logic by observing parseCliOptions behavior
	// since validateOptions is not exported directly

	describe('Valid Options', () => {
		it('should accept valid short alias format (-x)', () => {
			const options = [{ alias: '-v', name: '--verbose', description: 'Verbose' }]
			const result = parseCliOptions(['-v'], options)
			expect(result.parsedOptions.verbose).toBe(true)
		})

		it('should accept valid multi-char short alias (-abc)', () => {
			const options = [{ alias: '-vv', name: '--very-verbose', description: 'Very verbose' }]
			const result = parseCliOptions(['-vv'], options)
			expect(result.parsedOptions['very-verbose']).toBe(true)
		})

		it('should accept valid long name format (--name)', () => {
			const options = [{ alias: '-n', name: '--name', description: 'Name' }]
			const result = parseCliOptions(['--name', 'test'], options)
			expect(result.parsedOptions.name).toBe('test')
		})

		it('should accept long name with hyphens (--dry-run)', () => {
			const options = [{ alias: '-d', name: '--dry-run', description: 'Dry run' }]
			const result = parseCliOptions(['--dry-run'], options)
			expect(result.parsedOptions['dry-run']).toBe(true)
		})
	})
})
