// @ts-nocheck
/**
 * Tests for CLI Loader Functions
 *
 * Tests the CLI loader utilities that can be tested without mocking Robo internals.
 * Functions that require filesystem or Robo API mocking are documented separately.
 */

import { findCommand, getExtensions, mergeOptions } from '../../dist/cli/utils/cli-loader.js'
import { DEFAULT_HELP_OPTION, parseCliOptions } from '../../dist/cli/utils/cli-shared.js'

describe('CLI Loader Functions', () => {
	describe('findCommand', () => {
		const createManifest = (commands: Record<string, CliCommandEntry>): CliManifest => ({
			commands,
			extensions: {}
		})

		it('should find existing command by exact path', () => {
			const manifest = createManifest({
				dev: { path: '/dev.js', plugin: null, description: 'Dev mode', priority: 0 },
				build: { path: '/build.js', plugin: null, description: 'Build', priority: 0 }
			})

			const result = findCommand(manifest, 'dev')
			expect(result).not.toBeNull()
			expect(result!.description).toBe('Dev mode')
		})

		it('should return null for non-existing command', () => {
			const manifest = createManifest({
				dev: { path: '/dev.js', plugin: null, description: 'Dev mode', priority: 0 }
			})

			const result = findCommand(manifest, 'nonexistent')
			expect(result).toBeNull()
		})

		it('should find nested command by full path', () => {
			const manifest = createManifest({
				config: { path: '/config.js', plugin: null, description: 'Config', priority: 0 },
				'config get': { path: '/config/get.js', plugin: null, description: 'Get config', priority: 0 }
			})

			const result = findCommand(manifest, 'config get')
			expect(result).not.toBeNull()
			expect(result!.description).toBe('Get config')
		})

		it('should handle empty manifest', () => {
			const manifest = createManifest({})
			const result = findCommand(manifest, 'anything')
			expect(result).toBeNull()
		})

		it('should return command entry with all properties', () => {
			const manifest = createManifest({
				test: {
					path: '/test.js',
					plugin: 'test-plugin',
					description: 'Test command',
					priority: 50,
					options: [{ alias: '-v', name: '--verbose', description: 'Verbose' }],
					positionalArgs: true,
					subcommands: ['sub1', 'sub2']
				}
			})

			const result = findCommand(manifest, 'test')
			expect(result).toEqual({
				path: '/test.js',
				plugin: 'test-plugin',
				description: 'Test command',
				priority: 50,
				options: [{ alias: '-v', name: '--verbose', description: 'Verbose' }],
				positionalArgs: true,
				subcommands: ['sub1', 'sub2']
			})
		})
	})

	describe('getExtensions', () => {
		const createManifest = (extensions: Record<string, CliExtensionEntry[]>): CliManifest => ({
			commands: {},
			extensions
		})

		it('should return empty array when no extensions exist', () => {
			const manifest = createManifest({})
			const result = getExtensions(manifest, 'dev')
			expect(result).toEqual([])
		})

		it('should return extensions for exact command path', () => {
			const manifest = createManifest({
				dev: [
					{ path: '/ext1.js', plugin: 'plugin-a', priority: 0 },
					{ path: '/ext2.js', plugin: 'plugin-b', priority: 0 }
				]
			})

			const result = getExtensions(manifest, 'dev')
			expect(result).toHaveLength(2)
		})

		it('should return extensions for parent command', () => {
			const manifest = createManifest({
				config: [
					{ path: '/config-ext.js', plugin: 'plugin', priority: 0 }
				]
			})

			// When asking for 'config get', should also get extensions for 'config'
			const result = getExtensions(manifest, 'config get')
			expect(result).toHaveLength(1)
			expect(result[0].path).toBe('/config-ext.js')
		})

		it('should return extensions for both exact and parent paths', () => {
			const manifest = createManifest({
				config: [
					{ path: '/parent-ext.js', plugin: 'plugin-parent', priority: 0 }
				],
				'config get': [
					{ path: '/child-ext.js', plugin: 'plugin-child', priority: 0 }
				]
			})

			const result = getExtensions(manifest, 'config get')
			expect(result).toHaveLength(2)
		})

		it('should deduplicate extensions by path', () => {
			const manifest = createManifest({
				config: [
					{ path: '/same-ext.js', plugin: 'plugin', priority: 0 }
				],
				'config get': [
					{ path: '/same-ext.js', plugin: 'plugin', priority: 0 }
				]
			})

			const result = getExtensions(manifest, 'config get')
			expect(result).toHaveLength(1)
		})

		it('should sort extensions by priority (highest first)', () => {
			const manifest = createManifest({
				dev: [
					{ path: '/low.js', plugin: 'plugin-low', priority: 10 },
					{ path: '/high.js', plugin: 'plugin-high', priority: 100 },
					{ path: '/medium.js', plugin: 'plugin-medium', priority: 50 }
				]
			})

			const result = getExtensions(manifest, 'dev')
			expect(result[0].priority).toBe(100)
			expect(result[1].priority).toBe(50)
			expect(result[2].priority).toBe(10)
		})

		it('should handle deeply nested command paths', () => {
			const manifest = createManifest({
				service: [
					{ path: '/service-ext.js', plugin: 'p1', priority: 0 }
				],
				'service db': [
					{ path: '/service-db-ext.js', plugin: 'p2', priority: 0 }
				],
				'service db connect': [
					{ path: '/service-db-connect-ext.js', plugin: 'p3', priority: 0 }
				]
			})

			const result = getExtensions(manifest, 'service db connect')
			expect(result).toHaveLength(3)
		})
	})

	describe('mergeOptions', () => {
		it('should return empty array when no options', () => {
			const result = mergeOptions([], [])
			// Should still have default help option
			expect(result).toHaveLength(1)
			expect(result[0].name).toBe('--help')
		})

		it('should add default help option if not present', () => {
			const coreOptions: CliOptionConfig[] = [
				{ alias: '-v', name: '--verbose', description: 'Verbose' }
			]

			const result = mergeOptions(coreOptions, [])

			// Should have verbose + help
			expect(result).toHaveLength(2)
			expect(result.some((o) => o.name === '--help')).toBe(true)
		})

		it('should not duplicate help option if already defined', () => {
			const coreOptions: CliOptionConfig[] = [
				{ alias: '-h', name: '--help', description: 'Show help' }
			]

			const result = mergeOptions(coreOptions, [])

			const helpOptions = result.filter((o) => o.name === '--help')
			expect(helpOptions).toHaveLength(1)
		})

		it('should merge extension options', () => {
			const coreOptions: CliOptionConfig[] = [
				{ alias: '-v', name: '--verbose', description: 'Verbose' }
			]
			const extensions: CliExtensionEntry[] = [
				{
					path: '/ext.js',
					plugin: 'plugin',
					priority: 0,
					options: [
						{ alias: '-d', name: '--debug', description: 'Debug from plugin' }
					]
				}
			]

			const result = mergeOptions(coreOptions, extensions)

			expect(result.some((o) => o.name === '--verbose')).toBe(true)
			expect(result.some((o) => o.name === '--debug')).toBe(true)
		})

		it('should not add conflicting option alias', () => {
			const coreOptions: CliOptionConfig[] = [
				{ alias: '-v', name: '--verbose', description: 'Verbose' }
			]
			const extensions: CliExtensionEntry[] = [
				{
					path: '/ext.js',
					plugin: 'plugin',
					priority: 0,
					options: [
						{ alias: '-v', name: '--version', description: 'Version (conflicts)' }
					]
				}
			]

			const result = mergeOptions(coreOptions, extensions)

			// Should not add --version because -v conflicts
			expect(result.some((o) => o.name === '--version')).toBe(false)
		})

		it('should not add conflicting option name', () => {
			const coreOptions: CliOptionConfig[] = [
				{ alias: '-v', name: '--verbose', description: 'Verbose' }
			]
			const extensions: CliExtensionEntry[] = [
				{
					path: '/ext.js',
					plugin: 'plugin',
					priority: 0,
					options: [
						{ alias: '-V', name: '--verbose', description: 'Verbose (duplicate name)' }
					]
				}
			]

			const result = mergeOptions(coreOptions, extensions)

			// Should only have one --verbose
			const verboseOptions = result.filter((o) => o.name === '--verbose')
			expect(verboseOptions).toHaveLength(1)
		})

		it('should preserve option type and default from extensions', () => {
			const coreOptions: CliOptionConfig[] = []
			const extensions: CliExtensionEntry[] = [
				{
					path: '/ext.js',
					plugin: 'plugin',
					priority: 0,
					options: [
						{
							alias: '-p',
							name: '--port',
							description: 'Port',
							type: 'number',
							default: 3000
						}
					]
				}
			]

			const result = mergeOptions(coreOptions, extensions)
			const portOption = result.find((o) => o.name === '--port')

			expect(portOption).toBeDefined()
			expect(portOption!.type).toBe('number')
			expect(portOption!.default).toBe(3000)
		})

		it('should merge options from multiple extensions', () => {
			const coreOptions: CliOptionConfig[] = []
			const extensions: CliExtensionEntry[] = [
				{
					path: '/ext1.js',
					plugin: 'plugin-1',
					priority: 0,
					options: [
						{ alias: '-a', name: '--alpha', description: 'Alpha' }
					]
				},
				{
					path: '/ext2.js',
					plugin: 'plugin-2',
					priority: 0,
					options: [
						{ alias: '-b', name: '--beta', description: 'Beta' }
					]
				},
				{
					path: '/ext3.js',
					plugin: 'plugin-3',
					priority: 0,
					options: [
						{ alias: '-g', name: '--gamma', description: 'Gamma' }
					]
				}
			]

			const result = mergeOptions(coreOptions, extensions)

			expect(result.some((o) => o.name === '--alpha')).toBe(true)
			expect(result.some((o) => o.name === '--beta')).toBe(true)
			expect(result.some((o) => o.name === '--gamma')).toBe(true)
		})

		it('should handle extensions with no options', () => {
			const coreOptions: CliOptionConfig[] = [
				{ alias: '-v', name: '--verbose', description: 'Verbose' }
			]
			const extensions: CliExtensionEntry[] = [
				{ path: '/ext1.js', plugin: 'plugin-1', priority: 0 },
				{ path: '/ext2.js', plugin: 'plugin-2', priority: 0, options: undefined }
			]

			const result = mergeOptions(coreOptions, extensions)

			// Should just have core options + help
			expect(result).toHaveLength(2)
		})
	})
})

describe('DEFAULT_HELP_OPTION Integration', () => {
	it('should be correctly structured for mergeOptions', () => {
		expect(DEFAULT_HELP_OPTION.alias).toBe('-h')
		expect(DEFAULT_HELP_OPTION.name).toBe('--help')
		expect(DEFAULT_HELP_OPTION.type).toBe('boolean')
	})

	it('should work as a parseable option', () => {
		const result = parseCliOptions(['--help'], [DEFAULT_HELP_OPTION])
		expect(result.parsedOptions.help).toBe(true)
	})
})
