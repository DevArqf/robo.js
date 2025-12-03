/**
 * RoboPaths Utility Tests
 *
 * Tests the centralized path resolution utility that provides mode-aware
 * path management for the Robo.js build system.
 *
 * Key features tested:
 * - Mode-specific build directory resolution
 * - Custom build directory support (string and function)
 * - Plugin path resolution (non-mode-specific)
 * - Hook and build hook path resolution
 * - Manifest path resolution
 * - Configuration and reset functionality
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'

// Use built dist files, not source
import { RoboPaths } from '../../dist/core/paths.js'
import type { BuildDirectoryContext } from '../../dist/core/paths.js'

describe('RoboPaths', () => {
	let tempDir: string

	beforeEach(async () => {
		// Create a temp directory for isolation
		tempDir = path.join(os.tmpdir(), `robo-paths-test-${Date.now()}`)
		await fs.mkdir(tempDir, { recursive: true })

		// Reset RoboPaths to clean state before each test
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

	describe('robo()', () => {
		it('should return the .robo directory path', () => {
			const result = RoboPaths.robo()
			expect(result).toBe(path.join(tempDir, '.robo'))
		})
	})

	describe('build()', () => {
		describe('default behavior (no custom build directory)', () => {
			it('should return mode-specific build directory when mode is provided', () => {
				const result = RoboPaths.build('production')
				expect(result).toBe(path.join(tempDir, '.robo', 'build', 'production'))
			})

			it('should return development mode build directory', () => {
				const result = RoboPaths.build('development')
				expect(result).toBe(path.join(tempDir, '.robo', 'build', 'development'))
			})

			it('should return custom mode build directory (beta)', () => {
				const result = RoboPaths.build('beta')
				expect(result).toBe(path.join(tempDir, '.robo', 'build', 'beta'))
			})

			it('should return custom mode build directory (staging)', () => {
				const result = RoboPaths.build('staging')
				expect(result).toBe(path.join(tempDir, '.robo', 'build', 'staging'))
			})

			it('should return non-mode-specific build directory when mode is undefined', () => {
				const result = RoboPaths.build()
				expect(result).toBe(path.join(tempDir, '.robo', 'build'))
			})

			it('should return non-mode-specific build directory when mode is empty string', () => {
				const result = RoboPaths.build('')
				expect(result).toBe(path.join(tempDir, '.robo', 'build'))
			})
		})

		describe('with static custom build directory (string)', () => {
			it('should return custom directory path when string is provided', () => {
				RoboPaths.configure({ customBuildDir: 'dist' })
				const result = RoboPaths.build('production')
				expect(result).toBe(path.join(tempDir, 'dist'))
			})

			it('should ignore mode when static string is configured', () => {
				RoboPaths.configure({ customBuildDir: 'dist' })
				const prodResult = RoboPaths.build('production')
				const devResult = RoboPaths.build('development')
				expect(prodResult).toBe(devResult)
				expect(prodResult).toBe(path.join(tempDir, 'dist'))
			})

			it('should handle nested custom directory path', () => {
				RoboPaths.configure({ customBuildDir: 'custom/output/build' })
				const result = RoboPaths.build('production')
				expect(result).toBe(path.join(tempDir, 'custom/output/build'))
			})

			it('should handle custom directory with .robo prefix', () => {
				RoboPaths.configure({ customBuildDir: '.robo/custom' })
				const result = RoboPaths.build('production')
				expect(result).toBe(path.join(tempDir, '.robo/custom'))
			})
		})

		describe('with dynamic custom build directory (function)', () => {
			it('should call function with context and use returned path', () => {
				const customFn = (ctx: BuildDirectoryContext) => `dist/${ctx.mode}`
				RoboPaths.configure({ customBuildDir: customFn })

				const result = RoboPaths.build('production')
				expect(result).toBe(path.join(tempDir, 'dist/production'))
			})

			it('should pass correct mode to function', () => {
				let receivedMode: string | undefined
				const customFn = (ctx: BuildDirectoryContext) => {
					receivedMode = ctx.mode
					return `out/${ctx.mode}`
				}
				RoboPaths.configure({ customBuildDir: customFn })

				RoboPaths.build('staging')
				expect(receivedMode).toBe('staging')
			})

			it('should pass correct baseDir to function', () => {
				let receivedBaseDir: string | undefined
				const customFn = (ctx: BuildDirectoryContext) => {
					receivedBaseDir = ctx.baseDir
					return 'out'
				}
				RoboPaths.configure({ customBuildDir: customFn })

				RoboPaths.build('production')
				expect(receivedBaseDir).toBe(tempDir)
			})

			it('should default to production mode when mode is undefined', () => {
				let receivedMode: string | undefined
				const customFn = (ctx: BuildDirectoryContext) => {
					receivedMode = ctx.mode
					return `out/${ctx.mode}`
				}
				RoboPaths.configure({ customBuildDir: customFn })

				RoboPaths.build()
				expect(receivedMode).toBe('production')
			})

			it('should support complex conditional logic in function', () => {
				const customFn = (ctx: BuildDirectoryContext) => {
					if (ctx.mode === 'production') {
						return 'dist/prod'
					} else if (ctx.mode === 'development') {
						return 'dist/dev'
					}
					return `dist/${ctx.mode}`
				}
				RoboPaths.configure({ customBuildDir: customFn })

				expect(RoboPaths.build('production')).toBe(path.join(tempDir, 'dist/prod'))
				expect(RoboPaths.build('development')).toBe(path.join(tempDir, 'dist/dev'))
				expect(RoboPaths.build('beta')).toBe(path.join(tempDir, 'dist/beta'))
			})
		})
	})

	describe('manifest()', () => {
		it('should return mode-specific manifest directory', () => {
			const result = RoboPaths.manifest('production')
			expect(result).toBe(path.join(tempDir, '.robo', 'manifest', 'production'))
		})

		it('should return development manifest directory', () => {
			const result = RoboPaths.manifest('development')
			expect(result).toBe(path.join(tempDir, '.robo', 'manifest', 'development'))
		})

		it('should return custom mode manifest directory', () => {
			const result = RoboPaths.manifest('beta')
			expect(result).toBe(path.join(tempDir, '.robo', 'manifest', 'beta'))
		})

		it('should not be affected by custom build directory', () => {
			RoboPaths.configure({ customBuildDir: 'custom/dist' })
			const result = RoboPaths.manifest('production')
			// Manifest always goes to .robo/manifest regardless of custom build directory
			expect(result).toBe(path.join(tempDir, '.robo', 'manifest', 'production'))
		})
	})

	describe('types()', () => {
		it('should return the types directory (non-mode-specific)', () => {
			const result = RoboPaths.types()
			expect(result).toBe(path.join(tempDir, '.robo', 'types'))
		})

		it('should not be affected by mode or custom build directory', () => {
			RoboPaths.configure({ customBuildDir: 'custom/dist' })
			const result = RoboPaths.types()
			expect(result).toBe(path.join(tempDir, '.robo', 'types'))
		})
	})

	describe('hook()', () => {
		it('should return mode-specific hook path for init hook', () => {
			const result = RoboPaths.hook('production', 'init')
			expect(result).toBe(path.join(tempDir, '.robo', 'build', 'production', 'robo', 'init.js'))
		})

		it('should return mode-specific hook path for start hook', () => {
			const result = RoboPaths.hook('production', 'start')
			expect(result).toBe(path.join(tempDir, '.robo', 'build', 'production', 'robo', 'start.js'))
		})

		it('should return mode-specific hook path for stop hook', () => {
			const result = RoboPaths.hook('development', 'stop')
			expect(result).toBe(path.join(tempDir, '.robo', 'build', 'development', 'robo', 'stop.js'))
		})

		it('should use custom build directory when configured', () => {
			RoboPaths.configure({ customBuildDir: 'dist' })
			const result = RoboPaths.hook('production', 'start')
			expect(result).toBe(path.join(tempDir, 'dist', 'robo', 'start.js'))
		})

		it('should use dynamic custom build directory', () => {
			RoboPaths.configure({ customBuildDir: (ctx) => `out/${ctx.mode}` })
			const result = RoboPaths.hook('staging', 'init')
			expect(result).toBe(path.join(tempDir, 'out/staging', 'robo', 'init.js'))
		})
	})

	describe('buildHook()', () => {
		it('should return mode-specific build hook path for start', () => {
			const result = RoboPaths.buildHook('production', 'start')
			expect(result).toBe(path.join(tempDir, '.robo', 'build', 'production', 'robo', 'build', 'start.js'))
		})

		it('should return mode-specific build hook path for transform', () => {
			const result = RoboPaths.buildHook('production', 'transform')
			expect(result).toBe(path.join(tempDir, '.robo', 'build', 'production', 'robo', 'build', 'transform.js'))
		})

		it('should return mode-specific build hook path for complete', () => {
			const result = RoboPaths.buildHook('development', 'complete')
			expect(result).toBe(path.join(tempDir, '.robo', 'build', 'development', 'robo', 'build', 'complete.js'))
		})

		it('should use custom build directory when configured', () => {
			RoboPaths.configure({ customBuildDir: 'dist' })
			const result = RoboPaths.buildHook('production', 'complete')
			expect(result).toBe(path.join(tempDir, 'dist', 'robo', 'build', 'complete.js'))
		})
	})

	describe('routesDir()', () => {
		it('should return mode-specific routes directory', () => {
			const result = RoboPaths.routesDir('production')
			expect(result).toBe(path.join(tempDir, '.robo', 'build', 'production', 'robo', 'routes'))
		})

		it('should return development routes directory', () => {
			const result = RoboPaths.routesDir('development')
			expect(result).toBe(path.join(tempDir, '.robo', 'build', 'development', 'robo', 'routes'))
		})

		it('should use custom build directory when configured', () => {
			RoboPaths.configure({ customBuildDir: 'dist' })
			const result = RoboPaths.routesDir('production')
			expect(result).toBe(path.join(tempDir, 'dist', 'robo', 'routes'))
		})
	})

	describe('plugin paths (non-mode-specific)', () => {
		const pluginName = '@robojs/test-plugin'

		describe('pluginBuild()', () => {
			it('should return plugin build directory (non-mode-specific)', () => {
				const result = RoboPaths.pluginBuild(pluginName)
				expect(result).toBe(path.join(tempDir, 'node_modules', pluginName, '.robo', 'build'))
			})

			it('should not include mode in plugin path', () => {
				const result = RoboPaths.pluginBuild(pluginName)
				expect(result).not.toContain('production')
				expect(result).not.toContain('development')
			})

			it('should not be affected by custom build directory', () => {
				RoboPaths.configure({ customBuildDir: 'dist' })
				const result = RoboPaths.pluginBuild(pluginName)
				expect(result).toBe(path.join(tempDir, 'node_modules', pluginName, '.robo', 'build'))
			})
		})

		describe('pluginManifest()', () => {
			it('should return plugin manifest directory for mode', () => {
				const result = RoboPaths.pluginManifest(pluginName, 'production')
				expect(result).toBe(path.join(tempDir, 'node_modules', pluginName, '.robo', 'manifest', 'production'))
			})

			it('should include mode in plugin manifest path', () => {
				const result = RoboPaths.pluginManifest(pluginName, 'staging')
				expect(result).toContain('staging')
			})
		})

		describe('pluginRoutesDir()', () => {
			it('should return plugin routes directory', () => {
				const result = RoboPaths.pluginRoutesDir(pluginName)
				expect(result).toBe(path.join(tempDir, 'node_modules', pluginName, '.robo', 'build', 'robo', 'routes'))
			})
		})

		describe('pluginHook()', () => {
			it('should return plugin hook path for init', () => {
				const result = RoboPaths.pluginHook(pluginName, 'init')
				expect(result).toBe(path.join(tempDir, 'node_modules', pluginName, '.robo', 'build', 'robo', 'init.js'))
			})

			it('should return plugin hook path for start', () => {
				const result = RoboPaths.pluginHook(pluginName, 'start')
				expect(result).toBe(path.join(tempDir, 'node_modules', pluginName, '.robo', 'build', 'robo', 'start.js'))
			})

			it('should return plugin hook path for stop', () => {
				const result = RoboPaths.pluginHook(pluginName, 'stop')
				expect(result).toBe(path.join(tempDir, 'node_modules', pluginName, '.robo', 'build', 'robo', 'stop.js'))
			})

			it('should return plugin hook path for setup', () => {
				const result = RoboPaths.pluginHook(pluginName, 'setup')
				expect(result).toBe(path.join(tempDir, 'node_modules', pluginName, '.robo', 'build', 'robo', 'setup.js'))
			})
		})

		describe('pluginBuildHook()', () => {
			it('should return plugin build hook path for start', () => {
				const result = RoboPaths.pluginBuildHook(pluginName, 'start')
				expect(result).toBe(path.join(tempDir, 'node_modules', pluginName, '.robo', 'build', 'robo', 'build', 'start.js'))
			})

			it('should return plugin build hook path for transform', () => {
				const result = RoboPaths.pluginBuildHook(pluginName, 'transform')
				expect(result).toBe(path.join(tempDir, 'node_modules', pluginName, '.robo', 'build', 'robo', 'build', 'transform.js'))
			})

			it('should return plugin build hook path for complete', () => {
				const result = RoboPaths.pluginBuildHook(pluginName, 'complete')
				expect(result).toBe(path.join(tempDir, 'node_modules', pluginName, '.robo', 'build', 'robo', 'build', 'complete.js'))
			})
		})
	})

	describe('configure()', () => {
		it('should update baseDir when provided', () => {
			const newBaseDir = path.join(tempDir, 'new-base')
			RoboPaths.configure({ baseDir: newBaseDir })
			expect(RoboPaths.robo()).toBe(path.join(newBaseDir, '.robo'))
		})

		it('should update customBuildDir when provided', () => {
			RoboPaths.configure({ customBuildDir: 'custom-dist' })
			expect(RoboPaths.build('production')).toBe(path.join(tempDir, 'custom-dist'))
		})

		it('should preserve previous config when partial update', () => {
			const customDir = path.join(tempDir, 'custom')
			RoboPaths.configure({ baseDir: customDir })
			RoboPaths.configure({ customBuildDir: 'dist' })

			// baseDir should be preserved
			expect(RoboPaths.build('production')).toBe(path.join(customDir, 'dist'))
		})

		it('should clear customBuildDir when set to undefined', () => {
			RoboPaths.configure({ customBuildDir: 'dist' })
			RoboPaths.configure({ customBuildDir: undefined })
			expect(RoboPaths.build('production')).toBe(path.join(tempDir, '.robo', 'build', 'production'))
		})

		it('should allow chaining multiple configurations', () => {
			RoboPaths.configure({ customBuildDir: 'step1' })
			expect(RoboPaths.build('production')).toBe(path.join(tempDir, 'step1'))

			RoboPaths.configure({ customBuildDir: 'step2' })
			expect(RoboPaths.build('production')).toBe(path.join(tempDir, 'step2'))

			RoboPaths.configure({ customBuildDir: undefined })
			expect(RoboPaths.build('production')).toBe(path.join(tempDir, '.robo', 'build', 'production'))
		})
	})

	describe('edge cases', () => {
		it('should handle plugin names with scoped packages', () => {
			const scopedPlugin = '@robojs/my-plugin'
			const result = RoboPaths.pluginBuild(scopedPlugin)
			expect(result).toBe(path.join(tempDir, 'node_modules', '@robojs/my-plugin', '.robo', 'build'))
		})

		it('should handle plugin names without scope', () => {
			const plugin = 'robo-plugin-test'
			const result = RoboPaths.pluginBuild(plugin)
			expect(result).toBe(path.join(tempDir, 'node_modules', 'robo-plugin-test', '.robo', 'build'))
		})

		it('should handle modes with special characters', () => {
			const result = RoboPaths.build('test-mode-123')
			expect(result).toBe(path.join(tempDir, '.robo', 'build', 'test-mode-123'))
		})

		it('should handle empty mode gracefully', () => {
			const result = RoboPaths.build('')
			expect(result).toBe(path.join(tempDir, '.robo', 'build'))
		})

		it('should handle function that returns absolute path', () => {
			const absolutePath = '/absolute/custom/path'
			RoboPaths.configure({ customBuildDir: () => absolutePath })
			const result = RoboPaths.build('production')
			// Function return should be joined with baseDir
			expect(result).toBe(path.join(tempDir, absolutePath))
		})
	})

	describe('parallel mode builds', () => {
		it('should generate unique paths for different modes', () => {
			const modes = ['production', 'development', 'beta', 'staging', 'test']
			const paths = modes.map((mode) => RoboPaths.build(mode))

			// All paths should be unique
			const uniquePaths = new Set(paths)
			expect(uniquePaths.size).toBe(modes.length)

			// Each path should contain its mode
			modes.forEach((mode, i) => {
				expect(paths[i]).toContain(mode)
			})
		})

		it('should not conflict when using dynamic build directory', () => {
			RoboPaths.configure({ customBuildDir: (ctx) => `out/${ctx.mode}` })

			const prodPath = RoboPaths.build('production')
			const devPath = RoboPaths.build('development')

			expect(prodPath).not.toBe(devPath)
			expect(prodPath).toContain('production')
			expect(devPath).toContain('development')
		})
	})
})
