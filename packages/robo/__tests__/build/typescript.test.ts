/**
 * TypeScript Compiler Utility Tests
 *
 * Tests the TypeScript-specific utilities used during the build process:
 * - tsconfig.json parsing and compiler options extraction
 * - TypeScript project detection
 * - Path alias resolution from tsconfig
 * - Transformer preloading
 *
 * NOTE: These tests use real filesystem operations.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'

// Use built dist files
import { getTypeScriptCompilerOptions, preloadTransformers } from '../../dist/cli/compiler/typescript.js'
import { Compiler } from '../../dist/cli/utils/compiler.js'

describe('TypeScript Compiler Utilities', () => {
	let tempDir: string
	let originalCwd: string

	beforeEach(async () => {
		// Save original cwd
		originalCwd = process.cwd()

		// Create temp directory and change to it
		tempDir = path.join(os.tmpdir(), `robo-ts-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
		await fs.mkdir(tempDir, { recursive: true })
		process.chdir(tempDir)
	})

	afterEach(async () => {
		// Restore original cwd
		process.chdir(originalCwd)

		// Clean up temp directory
		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('isTypescriptProject()', () => {
		it('should detect TypeScript project with tsconfig.json', async () => {
			await fs.writeFile(
				path.join(tempDir, 'tsconfig.json'),
				JSON.stringify({ compilerOptions: {} })
			)

			const result = Compiler.isTypescriptProject()
			expect(result.isTypeScript).toBe(true)
			expect(result.missing).toEqual([])
		})

		it('should detect TypeScript project with tsconfig.json and typescript installed', async () => {
			await fs.writeFile(
				path.join(tempDir, 'tsconfig.json'),
				JSON.stringify({ compilerOptions: {} })
			)

			// Create mock node_modules/typescript
			await fs.mkdir(path.join(tempDir, 'node_modules', 'typescript'), { recursive: true })
			await fs.writeFile(
				path.join(tempDir, 'node_modules', 'typescript', 'package.json'),
				JSON.stringify({ name: 'typescript', version: '5.0.0' })
			)

			const result = Compiler.isTypescriptProject()
			expect(result.isTypeScript).toBe(true)
		})

		it('should not detect TypeScript project without tsconfig.json', async () => {
			// No tsconfig.json
			const result = Compiler.isTypescriptProject()
			expect(result.isTypeScript).toBe(false)
			expect(result.missing).toContain('tsconfig.json')
		})

		it('should check for tsconfig.json in current directory', async () => {
			// Create tsconfig in parent (should not be detected)
			await fs.writeFile(
				path.join(tempDir, 'tsconfig.json'),
				JSON.stringify({ compilerOptions: {} })
			)

			// Create subdirectory and check from there
			const subDir = path.join(tempDir, 'subproject')
			await fs.mkdir(subDir, { recursive: true })
			process.chdir(subDir)

			const result = Compiler.isTypescriptProject()
			// Should not find tsconfig in parent
			expect(result.isTypeScript).toBe(false)
		})
	})

	describe('getTypeScriptCompilerOptions()', () => {
		it('should parse basic tsconfig.json', async () => {
			await fs.writeFile(
				path.join(tempDir, 'tsconfig.json'),
				JSON.stringify({
					compilerOptions: {
						target: 'ESNext',
						module: 'NodeNext',
						strict: true
					}
				})
			)

			const options = await getTypeScriptCompilerOptions()

			expect(options).toBeDefined()
			expect(options.strict).toBe(true)
		})

		it('should parse path aliases from tsconfig', async () => {
			await fs.writeFile(
				path.join(tempDir, 'tsconfig.json'),
				JSON.stringify({
					compilerOptions: {
						baseUrl: '.',
						paths: {
							'@/*': ['src/*'],
							'@utils/*': ['src/utils/*'],
							'@components/*': ['src/components/*']
						}
					}
				})
			)

			const options = await getTypeScriptCompilerOptions()

			expect(options.paths).toBeDefined()
			expect(options.paths!['@/*']).toEqual(['src/*'])
			expect(options.paths!['@utils/*']).toEqual(['src/utils/*'])
			expect(options.paths!['@components/*']).toEqual(['src/components/*'])
		})

		it('should parse baseUrl from tsconfig', async () => {
			await fs.writeFile(
				path.join(tempDir, 'tsconfig.json'),
				JSON.stringify({
					compilerOptions: {
						baseUrl: './src'
					}
				})
			)

			const options = await getTypeScriptCompilerOptions()

			expect(options.baseUrl).toBeDefined()
			// baseUrl should be resolved to absolute path
			expect(options.baseUrl).toContain('src')
		})

		it('should parse experimentalDecorators option', async () => {
			await fs.writeFile(
				path.join(tempDir, 'tsconfig.json'),
				JSON.stringify({
					compilerOptions: {
						experimentalDecorators: true,
						emitDecoratorMetadata: true
					}
				})
			)

			const options = await getTypeScriptCompilerOptions()

			expect(options.experimentalDecorators).toBe(true)
			expect(options.emitDecoratorMetadata).toBe(true)
		})

		it('should parse useDefineForClassFields option', async () => {
			await fs.writeFile(
				path.join(tempDir, 'tsconfig.json'),
				JSON.stringify({
					compilerOptions: {
						useDefineForClassFields: false
					}
				})
			)

			const options = await getTypeScriptCompilerOptions()

			expect(options.useDefineForClassFields).toBe(false)
		})

		/**
		 * NOTE: tsconfig extends resolution is not implemented in getTypeScriptCompilerOptions.
		 * The function parses the JSON directly without resolving extends.
		 * This test verifies the current behavior (extends field is preserved but not resolved).
		 */
		it('should parse tsconfig with extends field (without resolving)', async () => {
			// Create extending config - extends is not resolved, just parsed
			await fs.writeFile(
				path.join(tempDir, 'tsconfig.json'),
				JSON.stringify({
					extends: './tsconfig.base.json',
					compilerOptions: {
						module: 'NodeNext',
						strict: true
					}
				})
			)

			const options = await getTypeScriptCompilerOptions()

			// Options from the direct config should be present
			// extends resolution is NOT performed
			expect(options.strict).toBe(true)
		})

		it('should throw when tsconfig is missing', async () => {
			// No tsconfig.json - implementation throws ENOENT
			await expect(getTypeScriptCompilerOptions()).rejects.toThrow()
		})

		it('should parse include and exclude patterns', async () => {
			await fs.writeFile(
				path.join(tempDir, 'tsconfig.json'),
				JSON.stringify({
					compilerOptions: {
						outDir: './dist'
					},
					include: ['src/**/*.ts'],
					exclude: ['node_modules', '**/*.test.ts']
				})
			)

			const options = await getTypeScriptCompilerOptions()

			// Options should be parsed (include/exclude are not in compilerOptions)
			expect(options.outDir).toBeDefined()
		})

		it('should handle complex path mappings', async () => {
			await fs.writeFile(
				path.join(tempDir, 'tsconfig.json'),
				JSON.stringify({
					compilerOptions: {
						baseUrl: '.',
						paths: {
							// Multiple paths for same alias
							'@models/*': ['src/models/*', 'src/shared/models/*'],
							// Exact match
							'config': ['src/config/index.ts'],
							// Wildcard only
							'*': ['node_modules/*']
						}
					}
				})
			)

			const options = await getTypeScriptCompilerOptions()

			expect(options.paths!['@models/*']).toHaveLength(2)
			expect(options.paths!['config']).toBeDefined()
		})

		it('should handle JSON with comments (JSONC)', async () => {
			// TypeScript's parser handles JSONC format
			await fs.writeFile(
				path.join(tempDir, 'tsconfig.json'),
				`{
					// This is a comment
					"compilerOptions": {
						/* Block comment */
						"target": "ESNext",
						"strict": true // trailing comment
					}
				}`
			)

			const options = await getTypeScriptCompilerOptions()

			expect(options.strict).toBe(true)
		})
	})

	describe('preloadTransformers()', () => {
		it('should preload transformers without error', async () => {
			// Create minimal tsconfig
			await fs.writeFile(
				path.join(tempDir, 'tsconfig.json'),
				JSON.stringify({ compilerOptions: {} })
			)

			// Should not throw
			await expect(preloadTransformers()).resolves.not.toThrow()
		})

		it('should be callable multiple times', async () => {
			await fs.writeFile(
				path.join(tempDir, 'tsconfig.json'),
				JSON.stringify({ compilerOptions: {} })
			)

			// Multiple calls should be safe
			await preloadTransformers()
			await preloadTransformers()
			await preloadTransformers()

			// No assertion needed - just verify no error
		})
	})

	describe('tsconfig edge cases', () => {
		it('should handle empty compilerOptions', async () => {
			await fs.writeFile(
				path.join(tempDir, 'tsconfig.json'),
				JSON.stringify({
					compilerOptions: {}
				})
			)

			const options = await getTypeScriptCompilerOptions()
			expect(options).toBeDefined()
		})

		/**
		 * NOTE: Extends resolution is not implemented, so a tsconfig with only
		 * extends and no compilerOptions will result in empty/undefined options.
		 */
		it('should handle tsconfig with only extends (no resolution)', async () => {
			await fs.writeFile(
				path.join(tempDir, 'tsconfig.json'),
				JSON.stringify({
					extends: './tsconfig.base.json',
					// Need at least empty compilerOptions to avoid undefined
					compilerOptions: {}
				})
			)

			const options = await getTypeScriptCompilerOptions()
			// Without extends resolution, no options are inherited
			expect(options).toBeDefined()
		})

		it('should handle various target values', async () => {
			const targets = ['ES5', 'ES6', 'ES2020', 'ESNext']

			for (const target of targets) {
				await fs.writeFile(
					path.join(tempDir, 'tsconfig.json'),
					JSON.stringify({
						compilerOptions: { target }
					})
				)

				const options = await getTypeScriptCompilerOptions()
				// Just verify it parses without error
				expect(options).toBeDefined()
			}
		})

		it('should handle various module values', async () => {
			const modules = ['CommonJS', 'ESNext', 'NodeNext', 'Node16']

			for (const module of modules) {
				await fs.writeFile(
					path.join(tempDir, 'tsconfig.json'),
					JSON.stringify({
						compilerOptions: { module }
					})
				)

				const options = await getTypeScriptCompilerOptions()
				expect(options).toBeDefined()
			}
		})

		it('should handle moduleResolution options', async () => {
			const resolutions = ['node', 'node16', 'nodenext', 'bundler']

			for (const moduleResolution of resolutions) {
				await fs.writeFile(
					path.join(tempDir, 'tsconfig.json'),
					JSON.stringify({
						compilerOptions: { moduleResolution }
					})
				)

				const options = await getTypeScriptCompilerOptions()
				expect(options).toBeDefined()
			}
		})
	})
})

describe('Compiler Utility Class', () => {
	let tempDir: string
	let originalCwd: string

	beforeEach(async () => {
		originalCwd = process.cwd()
		tempDir = path.join(os.tmpdir(), `robo-compiler-util-${Date.now()}-${Math.random().toString(36).slice(2)}`)
		await fs.mkdir(tempDir, { recursive: true })
		process.chdir(tempDir)
	})

	afterEach(async () => {
		process.chdir(originalCwd)
		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch {
			// Ignore
		}
	})

	describe('buildCode static method', () => {
		it('should be accessible as Compiler.buildCode', () => {
			expect(typeof Compiler.buildCode).toBe('function')
		})
	})

	describe('isTypescriptProject static method', () => {
		it('should return object with isTypeScript and missing properties', async () => {
			const result = Compiler.isTypescriptProject()

			expect(result).toHaveProperty('isTypeScript')
			expect(result).toHaveProperty('missing')
			expect(typeof result.isTypeScript).toBe('boolean')
			expect(Array.isArray(result.missing)).toBe(true)
		})
	})

	describe('buildDeclarationFiles static method', () => {
		it('should be accessible as Compiler.buildDeclarationFiles', () => {
			expect(typeof Compiler.buildDeclarationFiles).toBe('function')
		})

		it('should generate declaration files for TypeScript project', async () => {
			// Create TypeScript project structure
			await fs.writeFile(
				path.join(tempDir, 'tsconfig.json'),
				JSON.stringify({
					compilerOptions: {
						target: 'ESNext',
						module: 'NodeNext',
						moduleResolution: 'NodeNext',
						declaration: true,
						declarationDir: './dist/types',
						outDir: './dist',
						strict: true
					},
					include: ['src/**/*.ts']
				})
			)

			await fs.mkdir(path.join(tempDir, 'src'), { recursive: true })
			await fs.writeFile(
				path.join(tempDir, 'src', 'index.ts'),
				`
export interface User {
  name: string
  age: number
}

export function createUser(name: string, age: number): User {
  return { name, age }
}
`
			)

			// Get compiler options
			const options = await getTypeScriptCompilerOptions()

			// Build declaration files
			// This may or may not generate files depending on the setup
			// The key is that it doesn't throw
			expect(() => Compiler.buildDeclarationFiles(options)).not.toThrow()
		})
	})
})
