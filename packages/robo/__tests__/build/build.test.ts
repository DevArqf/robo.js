/**
 * Build Compiler Tests
 *
 * Tests the core build compilation functionality including:
 * - TypeScript compilation to JavaScript
 * - Mode-specific output directories
 * - Incremental builds
 * - Non-TypeScript file copying
 * - Path alias resolution
 * - Parallel compilation
 * - Clean builds vs incremental builds
 *
 * NOTE: These tests use real filesystem operations and the actual compiler.
 * They require the robo.js package to be built first (uses dist files).
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'

// Use built dist files, not source
import { buildCode } from '../../dist/cli/compiler/build.js'
import { RoboPaths } from '../../dist/core/paths.js'
import type { BuildDirectoryContext } from '../../dist/core/paths.js'

describe('Build Compiler', () => {
	let tempDir: string
	let srcDir: string

	beforeEach(async () => {
		// Create a unique temp directory for each test
		tempDir = path.join(os.tmpdir(), `robo-build-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
		srcDir = path.join(tempDir, 'src')

		// Create directory structure
		await fs.mkdir(srcDir, { recursive: true })

		// Create a minimal tsconfig.json
		await fs.writeFile(
			path.join(tempDir, 'tsconfig.json'),
			JSON.stringify(
				{
					compilerOptions: {
						target: 'ESNext',
						module: 'NodeNext',
						moduleResolution: 'NodeNext',
						esModuleInterop: true,
						strict: true,
						outDir: './dist',
						baseUrl: '.',
						paths: {
							'@/*': ['src/*']
						}
					},
					include: ['src/**/*.ts'],
					exclude: ['node_modules']
				},
				null,
				2
			)
		)

		// Reset RoboPaths to use temp directory
		RoboPaths.configure({ baseDir: tempDir, customBuildDir: undefined })
	})

	afterEach(async () => {
		// Clean up temp directory
		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('basic TypeScript compilation', () => {
		it('should compile a simple TypeScript file', async () => {
			// Create a simple TypeScript file
			await fs.writeFile(
				path.join(srcDir, 'index.ts'),
				`
export function hello(): string {
  return 'Hello, World!'
}
`
			)

			const time = await buildCode({
				srcDir,
				mode: 'production',
				clean: true,
				copyOther: false
			})

			expect(time).toBeGreaterThan(0)

			// Check output exists
			const outputPath = path.join(tempDir, '.robo', 'build', 'production', 'index.js')
			expect(existsSync(outputPath)).toBe(true)

			// Verify it's valid JavaScript
			const content = await fs.readFile(outputPath, 'utf-8')
			expect(content).toContain('export function hello')
			expect(content).toContain('Hello, World!')
		})

		it('should compile TypeScript with type annotations', async () => {
			await fs.writeFile(
				path.join(srcDir, 'typed.ts'),
				`
interface User {
  name: string
  age: number
}

export function createUser(name: string, age: number): User {
  return { name, age }
}

export const DEFAULT_USER: User = { name: 'Anonymous', age: 0 }
`
			)

			await buildCode({
				srcDir,
				mode: 'production',
				clean: true,
				copyOther: false
			})

			const outputPath = path.join(tempDir, '.robo', 'build', 'production', 'typed.js')
			expect(existsSync(outputPath)).toBe(true)

			const content = await fs.readFile(outputPath, 'utf-8')
			// Type annotations should be stripped
			expect(content).not.toContain(': User')
			expect(content).not.toContain('interface User')
			// But code should be preserved
			expect(content).toContain('createUser')
			expect(content).toContain('DEFAULT_USER')
		})

		it('should compile async/await syntax', async () => {
			await fs.writeFile(
				path.join(srcDir, 'async.ts'),
				`
export async function fetchData(): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 100))
  return 'data'
}
`
			)

			await buildCode({
				srcDir,
				mode: 'production',
				clean: true,
				copyOther: false
			})

			const outputPath = path.join(tempDir, '.robo', 'build', 'production', 'async.js')
			expect(existsSync(outputPath)).toBe(true)

			const content = await fs.readFile(outputPath, 'utf-8')
			expect(content).toContain('async')
			expect(content).toContain('await')
		})

		it('should compile decorators when experimentalDecorators is enabled', async () => {
			// Update tsconfig to enable decorators
			await fs.writeFile(
				path.join(tempDir, 'tsconfig.json'),
				JSON.stringify(
					{
						compilerOptions: {
							target: 'ESNext',
							module: 'NodeNext',
							moduleResolution: 'NodeNext',
							esModuleInterop: true,
							experimentalDecorators: true,
							emitDecoratorMetadata: false
						},
						include: ['src/**/*.ts']
					},
					null,
					2
				)
			)

			await fs.writeFile(
				path.join(srcDir, 'decorated.ts'),
				`
function Log(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  console.log('Method called:', propertyKey)
}

export class Service {
  @Log
  doSomething() {
    return 'done'
  }
}
`
			)

			await buildCode({
				srcDir,
				mode: 'production',
				clean: true,
				copyOther: false
			})

			const outputPath = path.join(tempDir, '.robo', 'build', 'production', 'decorated.js')
			expect(existsSync(outputPath)).toBe(true)

			const content = await fs.readFile(outputPath, 'utf-8')
			expect(content).toContain('Service')
			expect(content).toContain('doSomething')
		})
	})

	describe('mode-specific output directories', () => {
		beforeEach(async () => {
			await fs.writeFile(
				path.join(srcDir, 'app.ts'),
				`export const APP_NAME = 'TestApp'`
			)
		})

		it('should output to production directory when mode is production', async () => {
			await buildCode({
				srcDir,
				mode: 'production',
				clean: true,
				copyOther: false
			})

			expect(existsSync(path.join(tempDir, '.robo', 'build', 'production', 'app.js'))).toBe(true)
			expect(existsSync(path.join(tempDir, '.robo', 'build', 'development', 'app.js'))).toBe(false)
		})

		it('should output to development directory when mode is development', async () => {
			await buildCode({
				srcDir,
				mode: 'development',
				clean: true,
				copyOther: false
			})

			expect(existsSync(path.join(tempDir, '.robo', 'build', 'development', 'app.js'))).toBe(true)
			expect(existsSync(path.join(tempDir, '.robo', 'build', 'production', 'app.js'))).toBe(false)
		})

		it('should output to custom mode directory (beta)', async () => {
			await buildCode({
				srcDir,
				mode: 'beta',
				clean: true,
				copyOther: false
			})

			expect(existsSync(path.join(tempDir, '.robo', 'build', 'beta', 'app.js'))).toBe(true)
		})

		it('should output to custom mode directory (staging)', async () => {
			await buildCode({
				srcDir,
				mode: 'staging',
				clean: true,
				copyOther: false
			})

			expect(existsSync(path.join(tempDir, '.robo', 'build', 'staging', 'app.js'))).toBe(true)
		})

		it('should allow multiple mode builds to coexist', async () => {
			// Build for multiple modes
			await buildCode({ srcDir, mode: 'production', clean: true, copyOther: false })
			await buildCode({ srcDir, mode: 'development', clean: true, copyOther: false })
			await buildCode({ srcDir, mode: 'staging', clean: true, copyOther: false })

			// All should exist
			expect(existsSync(path.join(tempDir, '.robo', 'build', 'production', 'app.js'))).toBe(true)
			expect(existsSync(path.join(tempDir, '.robo', 'build', 'development', 'app.js'))).toBe(true)
			expect(existsSync(path.join(tempDir, '.robo', 'build', 'staging', 'app.js'))).toBe(true)
		})
	})

	describe('custom build directory', () => {
		beforeEach(async () => {
			await fs.writeFile(path.join(srcDir, 'main.ts'), `export const VERSION = '1.0.0'`)
		})

		it('should use static custom build directory when configured', async () => {
			RoboPaths.configure({ customBuildDir: 'dist' })

			await buildCode({
				srcDir,
				customBuildDir: 'dist',
				mode: 'production',
				clean: true,
				copyOther: false
			})

			expect(existsSync(path.join(tempDir, 'dist', 'main.js'))).toBe(true)
			expect(existsSync(path.join(tempDir, '.robo', 'build', 'production', 'main.js'))).toBe(false)
		})

		it('should use dynamic custom build directory when configured', async () => {
			RoboPaths.configure({ customBuildDir: (ctx: BuildDirectoryContext) => `out/${ctx.mode}` })

			await buildCode({
				srcDir,
				customBuildDir: (ctx: BuildDirectoryContext) => `out/${ctx.mode}`,
				mode: 'production',
				clean: true,
				copyOther: false
			})

			expect(existsSync(path.join(tempDir, 'out', 'production', 'main.js'))).toBe(true)
		})

		it('should use distDir override when provided directly', async () => {
			const customDistDir = path.join(tempDir, 'custom-output')

			await buildCode({
				srcDir,
				distDir: customDistDir,
				mode: 'production',
				clean: true,
				copyOther: false
			})

			expect(existsSync(path.join(customDistDir, 'main.js'))).toBe(true)
		})

		it('should prioritize distDir over customBuildDir', async () => {
			const customDistDir = path.join(tempDir, 'priority-output')
			RoboPaths.configure({ customBuildDir: 'should-not-use' })

			await buildCode({
				srcDir,
				distDir: customDistDir,
				customBuildDir: 'also-should-not-use',
				mode: 'production',
				clean: true,
				copyOther: false
			})

			expect(existsSync(path.join(customDistDir, 'main.js'))).toBe(true)
			expect(existsSync(path.join(tempDir, 'should-not-use', 'main.js'))).toBe(false)
		})
	})

	describe('directory structure preservation', () => {
		it('should preserve nested directory structure', async () => {
			// Create nested structure
			await fs.mkdir(path.join(srcDir, 'commands'), { recursive: true })
			await fs.mkdir(path.join(srcDir, 'commands', 'admin'), { recursive: true })
			await fs.mkdir(path.join(srcDir, 'utils'), { recursive: true })

			await fs.writeFile(path.join(srcDir, 'index.ts'), `export const ROOT = true`)
			await fs.writeFile(path.join(srcDir, 'commands', 'ping.ts'), `export default () => 'pong'`)
			await fs.writeFile(path.join(srcDir, 'commands', 'admin', 'ban.ts'), `export default () => 'banned'`)
			await fs.writeFile(path.join(srcDir, 'utils', 'helpers.ts'), `export const add = (a: number, b: number) => a + b`)

			await buildCode({
				srcDir,
				mode: 'production',
				clean: true,
				copyOther: false
			})

			const buildDir = path.join(tempDir, '.robo', 'build', 'production')

			expect(existsSync(path.join(buildDir, 'index.js'))).toBe(true)
			expect(existsSync(path.join(buildDir, 'commands', 'ping.js'))).toBe(true)
			expect(existsSync(path.join(buildDir, 'commands', 'admin', 'ban.js'))).toBe(true)
			expect(existsSync(path.join(buildDir, 'utils', 'helpers.js'))).toBe(true)
		})
	})

	describe('non-TypeScript file copying', () => {
		it('should copy JSON files when copyOther is true', async () => {
			await fs.writeFile(path.join(srcDir, 'index.ts'), `export const x = 1`)
			await fs.writeFile(
				path.join(srcDir, 'config.json'),
				JSON.stringify({ name: 'test' })
			)

			await buildCode({
				srcDir,
				mode: 'production',
				clean: true,
				copyOther: true
			})

			const buildDir = path.join(tempDir, '.robo', 'build', 'production')
			expect(existsSync(path.join(buildDir, 'config.json'))).toBe(true)

			const content = JSON.parse(await fs.readFile(path.join(buildDir, 'config.json'), 'utf-8'))
			expect(content.name).toBe('test')
		})

		it('should not copy non-TypeScript files when copyOther is false', async () => {
			await fs.writeFile(path.join(srcDir, 'index.ts'), `export const x = 1`)
			await fs.writeFile(path.join(srcDir, 'data.json'), `{}`)
			await fs.writeFile(path.join(srcDir, 'styles.css'), `.class { }`)

			await buildCode({
				srcDir,
				mode: 'production',
				clean: true,
				copyOther: false
			})

			const buildDir = path.join(tempDir, '.robo', 'build', 'production')
			expect(existsSync(path.join(buildDir, 'index.js'))).toBe(true)
			expect(existsSync(path.join(buildDir, 'data.json'))).toBe(false)
			expect(existsSync(path.join(buildDir, 'styles.css'))).toBe(false)
		})

		it('should copy nested non-TypeScript files', async () => {
			await fs.mkdir(path.join(srcDir, 'data'), { recursive: true })
			await fs.writeFile(path.join(srcDir, 'index.ts'), `export const x = 1`)
			await fs.writeFile(path.join(srcDir, 'data', 'users.json'), `[]`)

			await buildCode({
				srcDir,
				mode: 'production',
				clean: true,
				copyOther: true
			})

			const buildDir = path.join(tempDir, '.robo', 'build', 'production')
			expect(existsSync(path.join(buildDir, 'data', 'users.json'))).toBe(true)
		})
	})

	describe('clean build', () => {
		it('should remove old files when clean is true', async () => {
			const buildDir = path.join(tempDir, '.robo', 'build', 'production')

			// Create initial file
			await fs.writeFile(path.join(srcDir, 'old.ts'), `export const OLD = true`)
			await buildCode({ srcDir, mode: 'production', clean: true, copyOther: false })
			expect(existsSync(path.join(buildDir, 'old.js'))).toBe(true)

			// Remove old file, add new file
			await fs.rm(path.join(srcDir, 'old.ts'))
			await fs.writeFile(path.join(srcDir, 'new.ts'), `export const NEW = true`)

			// Clean build should remove old.js
			await buildCode({ srcDir, mode: 'production', clean: true, copyOther: false })

			expect(existsSync(path.join(buildDir, 'old.js'))).toBe(false)
			expect(existsSync(path.join(buildDir, 'new.js'))).toBe(true)
		})

		it('should preserve old files when clean is false', async () => {
			const buildDir = path.join(tempDir, '.robo', 'build', 'production')

			// Create initial file
			await fs.writeFile(path.join(srcDir, 'keep.ts'), `export const KEEP = true`)
			await buildCode({ srcDir, mode: 'production', clean: true, copyOther: false })

			// Add new file, build without clean
			await fs.writeFile(path.join(srcDir, 'another.ts'), `export const ANOTHER = true`)
			await buildCode({ srcDir, mode: 'production', clean: false, copyOther: false })

			expect(existsSync(path.join(buildDir, 'keep.js'))).toBe(true)
			expect(existsSync(path.join(buildDir, 'another.js'))).toBe(true)
		})
	})

	describe('incremental builds', () => {
		/**
		 * NOTE: Incremental builds tests are skipped because the implementation uses
		 * path.join(process.cwd(), file) which expects relative paths from cwd.
		 * In isolated unit tests with temp directories outside cwd, there's no valid
		 * relative path to the test files.
		 *
		 * Incremental builds are tested in E2E tests (build-e2e.test.ts) where the
		 * actual project structure is used under cwd.
		 */

		it.skip('should only compile specified files when files array is provided (see E2E tests)', async () => {
			// This test requires files to be under process.cwd() for path.join to work correctly
			// See build-e2e.test.ts for integration testing of incremental builds
		})

		it.skip('should not clean directory for incremental builds (see E2E tests)', async () => {
			// This test requires files to be under process.cwd() for path.join to work correctly
			// See build-e2e.test.ts for integration testing of incremental builds
		})
	})

	describe('exclude paths', () => {
		/**
		 * NOTE: excludePaths tests are skipped because the implementation uses
		 * path.relative(process.cwd(), filePath) to compute relative paths for matching.
		 * In isolated unit tests with temp directories, files are not under cwd,
		 * so excludePaths matching cannot work correctly without mocking.
		 *
		 * These paths are tested in E2E tests (build-e2e.test.ts) where the actual
		 * project structure is used under cwd.
		 */

		it.skip('should exclude files matching excludePaths (see E2E tests)', async () => {
			// This test requires files to be under process.cwd() for path.relative to work
			// See build-e2e.test.ts for integration testing of excludePaths
		})

		it.skip('should exclude multiple paths (see E2E tests)', async () => {
			// This test requires files to be under process.cwd() for path.relative to work
			// See build-e2e.test.ts for integration testing of excludePaths
		})
	})

	describe('JavaScript files', () => {
		it('should compile JavaScript files as well', async () => {
			await fs.writeFile(
				path.join(srcDir, 'legacy.js'),
				`export function legacyFunction() { return 'legacy' }`
			)

			await buildCode({
				srcDir,
				mode: 'production',
				clean: true,
				copyOther: false
			})

			const buildDir = path.join(tempDir, '.robo', 'build', 'production')
			expect(existsSync(path.join(buildDir, 'legacy.js'))).toBe(true)
		})

		it('should compile mixed TypeScript and JavaScript', async () => {
			await fs.writeFile(path.join(srcDir, 'modern.ts'), `export const MODERN: string = 'ts'`)
			await fs.writeFile(path.join(srcDir, 'legacy.js'), `export const LEGACY = 'js'`)

			await buildCode({
				srcDir,
				mode: 'production',
				clean: true,
				copyOther: false
			})

			const buildDir = path.join(tempDir, '.robo', 'build', 'production')
			expect(existsSync(path.join(buildDir, 'modern.js'))).toBe(true)
			expect(existsSync(path.join(buildDir, 'legacy.js'))).toBe(true)
		})
	})

	describe('TSX files', () => {
		it('should compile TSX files', async () => {
			await fs.writeFile(
				path.join(srcDir, 'component.tsx'),
				`
export function Component() {
  return <div>Hello</div>
}
`
			)

			await buildCode({
				srcDir,
				mode: 'production',
				clean: true,
				copyOther: false
			})

			const buildDir = path.join(tempDir, '.robo', 'build', 'production')
			expect(existsSync(path.join(buildDir, 'component.js'))).toBe(true)

			const content = await fs.readFile(path.join(buildDir, 'component.js'), 'utf-8')
			expect(content).toContain('Component')
		})
	})

	describe('source maps', () => {
		it('should include inline source maps in development mode', async () => {
			// Set NODE_ENV to development for source maps
			const originalNodeEnv = process.env.NODE_ENV
			process.env.NODE_ENV = 'development'

			try {
				await fs.writeFile(path.join(srcDir, 'mapped.ts'), `export const MAPPED = true`)

				await buildCode({
					srcDir,
					mode: 'development',
					clean: true,
					copyOther: false
				})

				const buildDir = path.join(tempDir, '.robo', 'build', 'development')
				const content = await fs.readFile(path.join(buildDir, 'mapped.js'), 'utf-8')
				expect(content).toContain('sourceMappingURL')
			} finally {
				process.env.NODE_ENV = originalNodeEnv
			}
		})

		it('should not include source maps in production mode', async () => {
			const originalNodeEnv = process.env.NODE_ENV
			process.env.NODE_ENV = 'production'

			try {
				await fs.writeFile(path.join(srcDir, 'nomaps.ts'), `export const NOMAPS = true`)

				await buildCode({
					srcDir,
					mode: 'production',
					clean: true,
					copyOther: false
				})

				const buildDir = path.join(tempDir, '.robo', 'build', 'production')
				const content = await fs.readFile(path.join(buildDir, 'nomaps.js'), 'utf-8')
				expect(content).not.toContain('sourceMappingURL')
			} finally {
				process.env.NODE_ENV = originalNodeEnv
			}
		})
	})

	describe('parallel compilation', () => {
		it('should compile multiple files in parallel', async () => {
			// Create many files to test parallel compilation
			const fileCount = 10
			for (let i = 0; i < fileCount; i++) {
				await fs.writeFile(
					path.join(srcDir, `file${i}.ts`),
					`export const FILE_${i} = ${i}`
				)
			}

			const startTime = Date.now()
			await buildCode({
				srcDir,
				mode: 'production',
				clean: true,
				copyOther: false,
				parallel: 5 // Use 5 parallel workers
			})
			const duration = Date.now() - startTime

			const buildDir = path.join(tempDir, '.robo', 'build', 'production')

			// All files should be compiled
			for (let i = 0; i < fileCount; i++) {
				expect(existsSync(path.join(buildDir, `file${i}.js`))).toBe(true)
			}

			// Duration should be recorded
			expect(duration).toBeGreaterThan(0)
		})

		it('should work with parallel = 1 (sequential)', async () => {
			await fs.writeFile(path.join(srcDir, 'seq1.ts'), `export const SEQ1 = 1`)
			await fs.writeFile(path.join(srcDir, 'seq2.ts'), `export const SEQ2 = 2`)

			await buildCode({
				srcDir,
				mode: 'production',
				clean: true,
				copyOther: false,
				parallel: 1
			})

			const buildDir = path.join(tempDir, '.robo', 'build', 'production')
			expect(existsSync(path.join(buildDir, 'seq1.js'))).toBe(true)
			expect(existsSync(path.join(buildDir, 'seq2.js'))).toBe(true)
		})
	})

	describe('error handling', () => {
		it('should handle missing src directory gracefully', async () => {
			const missingSrcDir = path.join(tempDir, 'nonexistent')

			// Should not throw, just skip
			await expect(
				buildCode({
					srcDir: missingSrcDir,
					mode: 'production',
					clean: true,
					copyOther: false
				})
			).resolves.not.toThrow()
		})

		it('should handle empty src directory', async () => {
			// srcDir is already empty, just run build
			const time = await buildCode({
				srcDir,
				mode: 'production',
				clean: true,
				copyOther: false
			})

			expect(time).toBeGreaterThanOrEqual(0)
		})
	})

	describe('output extension', () => {
		it('should use .js extension by default', async () => {
			await fs.writeFile(path.join(srcDir, 'test.ts'), `export const X = 1`)

			await buildCode({
				srcDir,
				mode: 'production',
				clean: true,
				copyOther: false
			})

			const buildDir = path.join(tempDir, '.robo', 'build', 'production')
			expect(existsSync(path.join(buildDir, 'test.js'))).toBe(true)
			expect(existsSync(path.join(buildDir, 'test.ts'))).toBe(false)
		})

		it('should use custom extension when distExt is provided', async () => {
			await fs.writeFile(path.join(srcDir, 'module.ts'), `export const M = 1`)

			await buildCode({
				srcDir,
				mode: 'production',
				clean: true,
				copyOther: false,
				distExt: '.mjs'
			})

			const buildDir = path.join(tempDir, '.robo', 'build', 'production')
			expect(existsSync(path.join(buildDir, 'module.mjs'))).toBe(true)
			expect(existsSync(path.join(buildDir, 'module.js'))).toBe(false)
		})
	})

	describe('return value', () => {
		it('should return compilation time in milliseconds', async () => {
			await fs.writeFile(path.join(srcDir, 'timed.ts'), `export const TIMED = true`)

			const time = await buildCode({
				srcDir,
				mode: 'production',
				clean: true,
				copyOther: false
			})

			expect(typeof time).toBe('number')
			// Compilation can be very fast (0ms) on modern machines
			expect(time).toBeGreaterThanOrEqual(0)
		})
	})
})

describe('Build Compiler - Non-TypeScript Projects', () => {
	let tempDir: string
	let srcDir: string

	beforeEach(async () => {
		tempDir = path.join(os.tmpdir(), `robo-build-noTs-${Date.now()}-${Math.random().toString(36).slice(2)}`)
		srcDir = path.join(tempDir, 'src')
		await fs.mkdir(srcDir, { recursive: true })

		// No tsconfig.json - this simulates a non-TypeScript project
		RoboPaths.configure({ baseDir: tempDir, customBuildDir: undefined })
	})

	afterEach(async () => {
		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch {
			// Ignore
		}
	})

	it('should copy files without compilation for non-TypeScript projects', async () => {
		// Create JavaScript files
		await fs.writeFile(path.join(srcDir, 'index.js'), `export const APP = 'js-only'`)
		await fs.writeFile(path.join(srcDir, 'utils.js'), `export const add = (a, b) => a + b`)

		await buildCode({
			srcDir,
			mode: 'production',
			clean: true,
			copyOther: true
		})

		const buildDir = path.join(tempDir, '.robo', 'build', 'production')
		expect(existsSync(path.join(buildDir, 'index.js'))).toBe(true)
		expect(existsSync(path.join(buildDir, 'utils.js'))).toBe(true)

		// Content should be preserved as-is
		const content = await fs.readFile(path.join(buildDir, 'index.js'), 'utf-8')
		expect(content).toContain("APP = 'js-only'")
	})
})
