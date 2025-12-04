// @ts-nocheck
/**
 * Tests for Script Runner Utilities
 *
 * Unit tests for the script-runner.ts functions:
 * - isScriptFile() - file extension detection
 * - parseScriptArgs() - argument parsing
 * - getTypeScriptSupport() - Node version detection
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { isScriptFile, parseScriptArgs, getTypeScriptSupport } from '../../dist/cli/utils/script-runner.js'

describe('isScriptFile', () => {
	describe('TypeScript files', () => {
		it('returns true for .ts files', () => {
			expect(isScriptFile('script.ts')).toBe(true)
			expect(isScriptFile('./path/to/script.ts')).toBe(true)
			expect(isScriptFile('/absolute/path/script.ts')).toBe(true)
		})

		it('returns true for .tsx files', () => {
			expect(isScriptFile('component.tsx')).toBe(true)
			expect(isScriptFile('./src/Component.tsx')).toBe(true)
		})
	})

	describe('JavaScript files', () => {
		it('returns true for .js files', () => {
			expect(isScriptFile('script.js')).toBe(true)
			expect(isScriptFile('./path/to/script.js')).toBe(true)
		})

		it('returns true for .jsx files', () => {
			expect(isScriptFile('component.jsx')).toBe(true)
		})

		it('returns true for .mjs files', () => {
			expect(isScriptFile('module.mjs')).toBe(true)
		})

		it('returns true for .cjs files', () => {
			expect(isScriptFile('common.cjs')).toBe(true)
		})
	})

	describe('non-script files', () => {
		it('returns false for commands without extensions', () => {
			expect(isScriptFile('build')).toBe(false)
			expect(isScriptFile('dev')).toBe(false)
			expect(isScriptFile('start')).toBe(false)
		})

		it('returns false for other file types', () => {
			expect(isScriptFile('file.txt')).toBe(false)
			expect(isScriptFile('package.json')).toBe(false)
			expect(isScriptFile('config.yaml')).toBe(false)
			expect(isScriptFile('README.md')).toBe(false)
		})

		it('returns false for directories that look like scripts', () => {
			expect(isScriptFile('scripts')).toBe(false)
			expect(isScriptFile('typescript')).toBe(false)
		})
	})
})

describe('parseScriptArgs', () => {
	// Helper to simulate process.argv
	const mockArgv = (args: string[]) => ['node', 'robox', ...args]

	describe('script mode', () => {
		it('detects script files by extension', () => {
			const result = parseScriptArgs(mockArgv(['script.ts']))
			expect(result.mode).toBe('script')
			expect(result.scriptPath).toBe('script.ts')
			expect(result.scriptArgs).toEqual([])
		})

		it('passes remaining args to script', () => {
			const result = parseScriptArgs(mockArgv(['script.ts', '--dry-run', '--foo', 'bar']))
			expect(result.mode).toBe('script')
			expect(result.scriptPath).toBe('script.ts')
			expect(result.scriptArgs).toEqual(['--dry-run', '--foo', 'bar'])
		})

		it('handles relative paths', () => {
			const result = parseScriptArgs(mockArgv(['./src/seed.ts']))
			expect(result.mode).toBe('script')
			expect(result.scriptPath).toBe('./src/seed.ts')
		})

		it('handles absolute paths', () => {
			const result = parseScriptArgs(mockArgv(['/home/user/script.js']))
			expect(result.mode).toBe('script')
			expect(result.scriptPath).toBe('/home/user/script.js')
		})

		it('works with all supported extensions', () => {
			for (const ext of ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs']) {
				const result = parseScriptArgs(mockArgv([`script.${ext}`]))
				expect(result.mode).toBe('script')
				expect(result.scriptPath).toBe(`script.${ext}`)
			}
		})
	})

	describe('robo mode', () => {
		it('passes non-file args to robo', () => {
			const result = parseScriptArgs(mockArgv(['build']))
			expect(result.mode).toBe('robo')
			expect(result.command).toEqual(['build'])
		})

		it('passes robo command with options', () => {
			const result = parseScriptArgs(mockArgv(['dev', '--verbose']))
			expect(result.mode).toBe('robo')
			expect(result.command).toEqual(['dev', '--verbose'])
		})

		it('passes multiple robo args', () => {
			const result = parseScriptArgs(mockArgv(['cloud', 'status', '--pod', 'main']))
			expect(result.mode).toBe('robo')
			expect(result.command).toEqual(['cloud', 'status', '--pod', 'main'])
		})

		it('defaults to robo mode with no args', () => {
			const result = parseScriptArgs(mockArgv([]))
			expect(result.mode).toBe('robo')
			expect(result.command).toEqual([])
		})
	})

	describe('command mode', () => {
		it('handles explicit command with --', () => {
			const result = parseScriptArgs(mockArgv(['--', 'npm', 'test']))
			expect(result.mode).toBe('command')
			expect(result.command).toEqual(['npm', 'test'])
		})

		it('handles -- with complex command', () => {
			const result = parseScriptArgs(mockArgv(['--', 'echo', '$NODE_ENV']))
			expect(result.mode).toBe('command')
			expect(result.command).toEqual(['echo', '$NODE_ENV'])
		})

		it('handles -- with flags after it', () => {
			const result = parseScriptArgs(mockArgv(['--', 'npm', 'run', 'test', '--', '--coverage']))
			expect(result.mode).toBe('command')
			expect(result.command).toEqual(['npm', 'run', 'test', '--', '--coverage'])
		})

		it('handles -- with no args after it', () => {
			const result = parseScriptArgs(mockArgv(['--']))
			expect(result.mode).toBe('command')
			expect(result.command).toEqual([])
		})
	})

	describe('eval mode', () => {
		it('handles -e flag with code', () => {
			const result = parseScriptArgs(mockArgv(['-e', 'console.log("hello")']))
			expect(result.mode).toBe('eval')
			expect(result.code).toBe('console.log("hello")')
		})

		it('handles -e with complex code', () => {
			const result = parseScriptArgs(mockArgv(['-e', 'console.log(process.env.NODE_ENV)']))
			expect(result.mode).toBe('eval')
			expect(result.code).toBe('console.log(process.env.NODE_ENV)')
		})
	})

	describe('watch flag', () => {
		it('parses -w flag', () => {
			const result = parseScriptArgs(mockArgv(['-w', 'script.ts']))
			expect(result.watch).toBe(true)
			expect(result.mode).toBe('script')
			expect(result.scriptPath).toBe('script.ts')
		})

		it('parses --watch flag', () => {
			const result = parseScriptArgs(mockArgv(['--watch', 'script.ts']))
			expect(result.watch).toBe(true)
			expect(result.mode).toBe('script')
		})

		it('watch flag without script goes to robo mode', () => {
			const result = parseScriptArgs(mockArgv(['-w']))
			expect(result.watch).toBe(true)
			expect(result.mode).toBe('robo')
		})
	})

	describe('verbose flag', () => {
		it('parses -v flag', () => {
			const result = parseScriptArgs(mockArgv(['-v', 'script.ts']))
			expect(result.verbose).toBe(true)
		})

		it('parses --verbose flag', () => {
			const result = parseScriptArgs(mockArgv(['--verbose', 'script.ts']))
			expect(result.verbose).toBe(true)
		})
	})

	describe('combined flags', () => {
		it('parses -w and -v together', () => {
			const result = parseScriptArgs(mockArgv(['-w', '-v', 'script.ts']))
			expect(result.watch).toBe(true)
			expect(result.verbose).toBe(true)
			expect(result.mode).toBe('script')
		})

		it('parses flags in any order before script', () => {
			const result = parseScriptArgs(mockArgv(['-v', '-w', 'script.ts']))
			expect(result.watch).toBe(true)
			expect(result.verbose).toBe(true)
			expect(result.mode).toBe('script')
		})

		it('preserves flags in command mode', () => {
			const result = parseScriptArgs(mockArgv(['-v', '--', 'npm', 'test']))
			expect(result.verbose).toBe(true)
			expect(result.mode).toBe('command')
		})
	})
})

describe('getTypeScriptSupport', () => {
	// Store the original node version descriptor
	const originalDescriptor = Object.getOwnPropertyDescriptor(process.versions, 'node')

	// Helper to mock node version
	function mockNodeVersion(version: string) {
		Object.defineProperty(process.versions, 'node', {
			value: version,
			writable: true,
			configurable: true
		})
	}

	afterEach(() => {
		// Restore original version
		if (originalDescriptor) {
			Object.defineProperty(process.versions, 'node', originalDescriptor)
		}
	})

	it('returns supported=true with flags for Node 23+', () => {
		mockNodeVersion('23.0.0')

		const result = getTypeScriptSupport()

		expect(result.supported).toBe(true)
		expect(result.flags).toContain('--experimental-strip-types')
		expect(result.flags).toContain('--disable-warning=ExperimentalWarning')
		// Node 23+ doesn't need transform-types flag (it's implicit)
		expect(result.flags).not.toContain('--experimental-transform-types')
	})

	it('returns supported=true with transform-types for Node 22.7+', () => {
		mockNodeVersion('22.7.0')

		const result = getTypeScriptSupport()

		expect(result.supported).toBe(true)
		expect(result.flags).toContain('--experimental-strip-types')
		expect(result.flags).toContain('--experimental-transform-types')
		expect(result.flags).toContain('--disable-warning=ExperimentalWarning')
	})

	it('returns supported=true for Node 22.6 (basic support)', () => {
		mockNodeVersion('22.6.0')

		const result = getTypeScriptSupport()

		expect(result.supported).toBe(true)
		expect(result.flags).toContain('--experimental-strip-types')
		expect(result.flags).not.toContain('--experimental-transform-types')
	})

	it('returns supported=false for Node 22.5 (just below threshold)', () => {
		mockNodeVersion('22.5.0')

		const result = getTypeScriptSupport()

		expect(result.supported).toBe(false)
		expect(result.flags).toEqual([])
	})

	it('returns supported=false for Node 20', () => {
		mockNodeVersion('20.0.0')

		const result = getTypeScriptSupport()

		expect(result.supported).toBe(false)
		expect(result.flags).toEqual([])
	})

	it('returns supported=false for Node 18 (LTS)', () => {
		mockNodeVersion('18.20.0')

		const result = getTypeScriptSupport()

		expect(result.supported).toBe(false)
		expect(result.flags).toEqual([])
	})

	it('handles high minor versions correctly', () => {
		mockNodeVersion('22.10.0')

		const result = getTypeScriptSupport()

		expect(result.supported).toBe(true)
		expect(result.flags).toContain('--experimental-transform-types')
	})

	it('handles patch versions correctly', () => {
		mockNodeVersion('22.6.5')

		const result = getTypeScriptSupport()

		expect(result.supported).toBe(true)
	})
})
