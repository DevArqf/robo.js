/**
 * Unit tests for Test Runner Selection
 */

import { jest, describe, it, expect } from '@jest/globals'
import {
	detectTestRunnerFromPackage,
	detectTestRunnerFromConfig,
	buildRunnerConfig,
	detectTestRunner,
	type PackageJsonInfo,
	type TestRunnerConfig
} from '../../src/verification/runner-selection.js'
import type { ExecutionProvider } from '../../src/types/execution.js'
import type { DirEntry, FileStat } from '../../src/types/terminal.js'

/**
 * Create a mock provider for testing
 */
function createMockProvider(files: Record<string, string> = {}): ExecutionProvider {
	const mockProvider: ExecutionProvider = {
		readFile: jest.fn(async (path: string) => {
			if (files[path]) return files[path]
			throw new Error(`File not found: ${path}`)
		}),
		writeFile: jest.fn(async () => {}),
		deletePath: jest.fn(async () => {}),
		exists: jest.fn(async (path: string) => {
			return path in files
		}),
		readdir: jest.fn(async (): Promise<DirEntry[]> => []),
		mkdir: jest.fn(async () => {}),
		stat: jest.fn(async (path: string): Promise<FileStat> => {
			if (files[path]) {
				return { size: files[path].length, isDirectory: false }
			}
			throw new Error(`Not found: ${path}`)
		}),
		search: jest.fn(async () => []),
		snapshot: jest.fn(async () => ({})),
		run: jest.fn(async () => ({ exitCode: 0, output: '' })),
		runStream: jest.fn(async function* () {}),
		startSession: jest.fn(async () => ({ id: 'test' })),
		stopSession: jest.fn(async () => {}),
		streamSession: jest.fn(async function* () {})
	}

	return mockProvider
}

describe('detectTestRunnerFromPackage', () => {
	it('should detect vitest from test script', () => {
		const pkg: PackageJsonInfo = {
			scripts: { test: 'vitest run' }
		}

		const result = detectTestRunnerFromPackage(pkg)
		expect(result).not.toBeNull()
		expect(result?.type).toBe('vitest')
		expect(result?.cmd).toBe('npm')
		expect(result?.args).toEqual(['run', 'test'])
	})

	it('should detect jest from test script', () => {
		const pkg: PackageJsonInfo = {
			scripts: { test: 'jest' }
		}

		const result = detectTestRunnerFromPackage(pkg)
		expect(result).not.toBeNull()
		expect(result?.type).toBe('jest')
	})

	it('should detect mocha from test script', () => {
		const pkg: PackageJsonInfo = {
			scripts: { test: 'mocha tests/**/*.js' }
		}

		const result = detectTestRunnerFromPackage(pkg)
		expect(result).not.toBeNull()
		expect(result?.type).toBe('mocha')
	})

	it('should detect node --test from test script', () => {
		const pkg: PackageJsonInfo = {
			scripts: { test: 'node --test' }
		}

		const result = detectTestRunnerFromPackage(pkg)
		expect(result).not.toBeNull()
		expect(result?.type).toBe('node-test')
	})

	it('should fallback to npm-script for unknown runners', () => {
		const pkg: PackageJsonInfo = {
			scripts: { test: 'tap' }
		}

		const result = detectTestRunnerFromPackage(pkg)
		expect(result).not.toBeNull()
		expect(result?.type).toBe('npm-script')
	})

	it('should return null when no scripts', () => {
		const pkg: PackageJsonInfo = {}

		const result = detectTestRunnerFromPackage(pkg)
		expect(result).toBeNull()
	})

	it('should return null when no test script', () => {
		const pkg: PackageJsonInfo = {
			scripts: { build: 'tsc' }
		}

		const result = detectTestRunnerFromPackage(pkg)
		expect(result).toBeNull()
	})

	it('should prioritize test over test:unit', () => {
		const pkg: PackageJsonInfo = {
			scripts: {
				test: 'jest',
				'test:unit': 'vitest'
			}
		}

		const result = detectTestRunnerFromPackage(pkg)
		expect(result?.type).toBe('jest')
		expect(result?.args).toEqual(['run', 'test'])
	})

	it('should use test:unit when test is missing', () => {
		const pkg: PackageJsonInfo = {
			scripts: {
				'test:unit': 'vitest run'
			}
		}

		const result = detectTestRunnerFromPackage(pkg)
		expect(result?.type).toBe('vitest')
		expect(result?.args).toEqual(['run', 'test:unit'])
	})
})

describe('detectTestRunnerFromConfig', () => {
	it('should detect vitest from vitest.config.ts', async () => {
		const provider = createMockProvider({
			'/vitest.config.ts': 'export default {}'
		})

		const result = await detectTestRunnerFromConfig(provider)
		expect(result).toBe('vitest')
	})

	it('should detect vitest from vitest.config.js', async () => {
		const provider = createMockProvider({
			'/vitest.config.js': 'module.exports = {}'
		})

		const result = await detectTestRunnerFromConfig(provider)
		expect(result).toBe('vitest')
	})

	it('should detect jest from jest.config.ts', async () => {
		const provider = createMockProvider({
			'/jest.config.ts': 'export default {}'
		})

		const result = await detectTestRunnerFromConfig(provider)
		expect(result).toBe('jest')
	})

	it('should detect jest from jest.config.json', async () => {
		const provider = createMockProvider({
			'/jest.config.json': '{}'
		})

		const result = await detectTestRunnerFromConfig(provider)
		expect(result).toBe('jest')
	})

	it('should detect mocha from .mocharc.json', async () => {
		const provider = createMockProvider({
			'/.mocharc.json': '{}'
		})

		const result = await detectTestRunnerFromConfig(provider)
		expect(result).toBe('mocha')
	})

	it('should detect mocha from .mocharc.yaml', async () => {
		const provider = createMockProvider({
			'/.mocharc.yaml': 'spec: test'
		})

		const result = await detectTestRunnerFromConfig(provider)
		expect(result).toBe('mocha')
	})

	it('should prioritize vitest over jest', async () => {
		const provider = createMockProvider({
			'/vitest.config.ts': 'export default {}',
			'/jest.config.ts': 'export default {}'
		})

		const result = await detectTestRunnerFromConfig(provider)
		expect(result).toBe('vitest')
	})

	it('should return null when no config files', async () => {
		const provider = createMockProvider({})

		const result = await detectTestRunnerFromConfig(provider)
		expect(result).toBeNull()
	})
})

describe('buildRunnerConfig', () => {
	it('should build vitest config', () => {
		const config = buildRunnerConfig('vitest')
		expect(config.cmd).toBe('npx')
		expect(config.args).toEqual(['vitest', 'run'])
		expect(config.type).toBe('vitest')
	})

	it('should build vitest config with pattern', () => {
		const config = buildRunnerConfig('vitest', '**/*.test.ts')
		expect(config.args).toEqual(['vitest', 'run', '--testPathPattern', '**/*.test.ts'])
		expect(config.pattern).toBe('**/*.test.ts')
	})

	it('should build jest config', () => {
		const config = buildRunnerConfig('jest')
		expect(config.cmd).toBe('npx')
		expect(config.args).toEqual(['jest'])
		expect(config.type).toBe('jest')
	})

	it('should build jest config with pattern', () => {
		const config = buildRunnerConfig('jest', 'unit/')
		expect(config.args).toEqual(['jest', '--testPathPattern', 'unit/'])
		expect(config.pattern).toBe('unit/')
	})

	it('should build mocha config', () => {
		const config = buildRunnerConfig('mocha')
		expect(config.cmd).toBe('npx')
		expect(config.args).toEqual(['mocha'])
		expect(config.type).toBe('mocha')
	})

	it('should build mocha config with pattern', () => {
		const config = buildRunnerConfig('mocha', 'test/**/*.spec.js')
		expect(config.args).toEqual(['mocha', 'test/**/*.spec.js'])
		expect(config.pattern).toBe('test/**/*.spec.js')
	})

	it('should build node-test config', () => {
		const config = buildRunnerConfig('node-test')
		expect(config.cmd).toBe('node')
		expect(config.args).toEqual(['--test'])
		expect(config.type).toBe('node-test')
	})

	it('should build node-test config with pattern', () => {
		const config = buildRunnerConfig('node-test', 'test/*.js')
		expect(config.args).toEqual(['--test', 'test/*.js'])
		expect(config.pattern).toBe('test/*.js')
	})
})

describe('detectTestRunner', () => {
	it('should prioritize npm script over config file', async () => {
		const provider = createMockProvider({
			'/vitest.config.ts': 'export default {}'
		})

		const pkg: PackageJsonInfo = {
			scripts: { test: 'jest' }
		}

		const result = await detectTestRunner(provider, pkg)
		expect(result?.type).toBe('jest')
		expect(result?.cmd).toBe('npm')
		expect(result?.args).toEqual(['run', 'test'])
	})

	it('should use config file when no test script', async () => {
		const provider = createMockProvider({
			'/vitest.config.ts': 'export default {}'
		})

		const pkg: PackageJsonInfo = {
			scripts: { build: 'tsc' }
		}

		const result = await detectTestRunner(provider, pkg)
		expect(result?.type).toBe('vitest')
		expect(result?.cmd).toBe('npx')
	})

	it('should detect from dependencies when no scripts or config', async () => {
		const provider = createMockProvider({})

		const pkg: PackageJsonInfo = {
			devDependencies: { jest: '^29.0.0' }
		}

		const result = await detectTestRunner(provider, pkg)
		expect(result?.type).toBe('jest')
	})

	it('should prioritize vitest in dependencies over jest', async () => {
		const provider = createMockProvider({})

		const pkg: PackageJsonInfo = {
			devDependencies: {
				vitest: '^1.0.0',
				jest: '^29.0.0'
			}
		}

		const result = await detectTestRunner(provider, pkg)
		expect(result?.type).toBe('vitest')
	})

	it('should return null when nothing is detected', async () => {
		const provider = createMockProvider({})

		const pkg: PackageJsonInfo = {
			dependencies: { express: '^4.0.0' }
		}

		const result = await detectTestRunner(provider, pkg)
		expect(result).toBeNull()
	})

	it('should handle empty package.json', async () => {
		const provider = createMockProvider({})

		const pkg: PackageJsonInfo = {}

		const result = await detectTestRunner(provider, pkg)
		expect(result).toBeNull()
	})
})
