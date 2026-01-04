/**
 * HMR Dependency Graph Tests
 *
 * Tests for the dependency graph building and traversal functionality.
 * Uses temporary directories to create fake build output structures.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
	createGraph,
	parseModule,
	resolveSpecifier,
	buildInitialGraph,
	updateGraphForFiles,
	getImpactedHandlers,
	hasAffectedDynamicImports,
	getGraphStats,
	removeModule
} from '../../src/cli/utils/hmr-graph.js'

// RouteDefinitions type is defined inline to avoid TypeScript-specific import syntax
// that Jest's Babel parser doesn't handle well

// Helper to create test files
function createTestFile(dir: string, relativePath: string, content: string): string {
	const fullPath = path.join(dir, relativePath)
	fs.mkdirSync(path.dirname(fullPath), { recursive: true })
	fs.writeFileSync(fullPath, content)
	return relativePath
}

// Standard route definitions for testing
const STANDARD_ROUTES = {
	discordjs: {
		plugin: 'project',
		namespace: 'discordjs',
		routes: {
			commands: {
				directory: 'commands',
				key: { style: 'filepath' as const, separator: ' ' }
			},
			events: {
				directory: 'events',
				key: { style: 'parentOrFilename' as const },
				multiple: true
			}
		}
	}
}

describe('HMR Dependency Graph', () => {
	let tempDir: string

	beforeEach(() => {
		// Create a temporary directory for test files
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hmr-graph-test-'))
	})

	afterEach(() => {
		// Clean up temp directory
		fs.rmSync(tempDir, { recursive: true, force: true })
	})

	describe('resolveSpecifier', () => {
		it('resolves ./ imports', () => {
			createTestFile(tempDir, 'utils/format.js', 'export const format = () => {}')

			const resolved = resolveSpecifier('./format.js', 'utils', tempDir)
			expect(resolved).toBe('utils/format.js')
		})

		it('resolves ../ imports', () => {
			createTestFile(tempDir, 'utils/format.js', 'export const format = () => {}')

			const resolved = resolveSpecifier('../utils/format.js', 'commands', tempDir)
			expect(resolved).toBe('utils/format.js')
		})

		it('adds .js extension when missing', () => {
			createTestFile(tempDir, 'utils/helper.js', 'export const helper = () => {}')

			const resolved = resolveSpecifier('./helper', 'utils', tempDir)
			expect(resolved).toBe('utils/helper.js')
		})

		it('resolves index.js for directory imports', () => {
			createTestFile(tempDir, 'utils/index.js', 'export * from "./helpers.js"')

			const resolved = resolveSpecifier('./utils', '', tempDir)
			expect(resolved).toBe('utils/index.js')
		})

		it('returns null for non-relative imports', () => {
			expect(resolveSpecifier('discord.js', 'commands', tempDir)).toBeNull()
			expect(resolveSpecifier('node:fs', 'commands', tempDir)).toBeNull()
		})

		it('returns null for non-existent files', () => {
			const resolved = resolveSpecifier('./nonexistent.js', 'commands', tempDir)
			expect(resolved).toBeNull()
		})

		it('normalizes paths with multiple ../', () => {
			createTestFile(tempDir, 'lib/core.js', 'export const core = () => {}')

			const resolved = resolveSpecifier('../../lib/core.js', 'commands/admin', tempDir)
			expect(resolved).toBe('lib/core.js')
		})

		it('strips query strings from specifiers', () => {
			createTestFile(tempDir, 'utils/format.js', 'export const format = () => {}')

			const resolved = resolveSpecifier('./format.js?v=123', 'utils', tempDir)
			expect(resolved).toBe('utils/format.js')
		})

		it('strips hash from specifiers', () => {
			createTestFile(tempDir, 'utils/format.js', 'export const format = () => {}')

			const resolved = resolveSpecifier('./format.js#section', 'utils', tempDir)
			expect(resolved).toBe('utils/format.js')
		})

		it('strips both query and hash from specifiers', () => {
			createTestFile(tempDir, 'utils/format.js', 'export const format = () => {}')

			const resolved = resolveSpecifier('./format.js?v=123#section', 'utils', tempDir)
			expect(resolved).toBe('utils/format.js')
		})

		it('resolves .json files', () => {
			createTestFile(tempDir, 'config/settings.json', '{"key": "value"}')

			const resolved = resolveSpecifier('./settings', 'config', tempDir)
			expect(resolved).toBe('config/settings.json')
		})
	})

	describe('createGraph', () => {
		it('creates an empty graph', () => {
			const graph = createGraph(tempDir)

			expect(graph.deps.size).toBe(0)
			expect(graph.revDeps.size).toBe(0)
			expect(graph.mtimes.size).toBe(0)
			expect(graph.hasUnresolvedDynamic.size).toBe(0)
			expect(graph.buildRoot).toBe(tempDir)
		})
	})

	describe('parseModule', () => {
		it('parses a module and extracts dependencies', () => {
			createTestFile(tempDir, 'utils/format.js', 'export const format = () => {}')
			createTestFile(
				tempDir,
				'commands/ping.js',
				`
				import { format } from '../utils/format.js'
				export default () => format('pong')
			`
			)

			const graph = createGraph(tempDir)
			parseModule('commands/ping.js', graph)

			expect(graph.deps.has('commands/ping.js')).toBe(true)
			expect(graph.deps.get('commands/ping.js')?.has('utils/format.js')).toBe(true)

			// Reverse dependency should be set
			expect(graph.revDeps.get('utils/format.js')?.has('commands/ping.js')).toBe(true)
		})

		it('tracks mtime for caching', () => {
			createTestFile(tempDir, 'commands/ping.js', 'export default () => "pong"')

			const graph = createGraph(tempDir)
			parseModule('commands/ping.js', graph)

			expect(graph.mtimes.has('commands/ping.js')).toBe(true)
			const mtime = graph.mtimes.get('commands/ping.js')
			expect(mtime).toBeGreaterThan(0)
		})

		it('skips unchanged files (mtime caching)', () => {
			createTestFile(tempDir, 'commands/ping.js', 'export default () => "pong"')

			const graph = createGraph(tempDir)

			// First parse
			const parsed1 = parseModule('commands/ping.js', graph)
			expect(parsed1).toBe(true)

			// Second parse should skip (file unchanged)
			const parsed2 = parseModule('commands/ping.js', graph)
			expect(parsed2).toBe(false)
		})

		it('flags modules with unresolved dynamic imports', () => {
			createTestFile(
				tempDir,
				'commands/dynamic.js',
				`
				const modulePath = './lazy.js'
				export default async () => {
					const mod = await import(modulePath)
					return mod.default()
				}
			`
			)

			const graph = createGraph(tempDir)
			parseModule('commands/dynamic.js', graph)

			expect(graph.hasUnresolvedDynamic.has('commands/dynamic.js')).toBe(true)
		})

		it('handles dynamic imports with literal strings', () => {
			createTestFile(tempDir, 'commands/lazy.js', 'export default () => "lazy"')
			createTestFile(
				tempDir,
				'commands/loader.js',
				`
				export default async () => {
					const mod = await import('./lazy.js')
					return mod.default()
				}
			`
			)

			const graph = createGraph(tempDir)
			parseModule('commands/loader.js', graph)

			expect(graph.deps.get('commands/loader.js')?.has('commands/lazy.js')).toBe(true)
			expect(graph.hasUnresolvedDynamic.has('commands/loader.js')).toBe(false)
		})

		it('handles non-existent modules gracefully', () => {
			const graph = createGraph(tempDir)
			const parsed = parseModule('nonexistent.js', graph)

			expect(parsed).toBe(false)
			expect(graph.deps.has('nonexistent.js')).toBe(false)
		})

		it('updates reverse deps when dependencies change', () => {
			createTestFile(tempDir, 'utils/a.js', 'export const a = 1')
			createTestFile(tempDir, 'utils/b.js', 'export const b = 2')
			createTestFile(tempDir, 'commands/ping.js', `import { a } from '../utils/a.js'`)

			const graph = createGraph(tempDir)
			parseModule('commands/ping.js', graph)

			expect(graph.revDeps.get('utils/a.js')?.has('commands/ping.js')).toBe(true)
			expect(graph.revDeps.has('utils/b.js')).toBe(false)

			// Change ping to import b instead of a
			createTestFile(tempDir, 'commands/ping.js', `import { b } from '../utils/b.js'`)
			// Force mtime update
			graph.mtimes.delete('commands/ping.js')
			parseModule('commands/ping.js', graph)

			// Old reverse dep should be gone
			expect(graph.revDeps.get('utils/a.js')?.has('commands/ping.js')).toBeFalsy()
			// New reverse dep should exist
			expect(graph.revDeps.get('utils/b.js')?.has('commands/ping.js')).toBe(true)
		})
	})

	describe('removeModule', () => {
		it('removes module and cleans up reverse deps', () => {
			createTestFile(tempDir, 'utils/format.js', 'export const format = () => {}')
			createTestFile(tempDir, 'commands/ping.js', `import { format } from '../utils/format.js'`)

			const graph = createGraph(tempDir)
			parseModule('commands/ping.js', graph)

			// Verify initial state
			expect(graph.deps.has('commands/ping.js')).toBe(true)
			expect(graph.revDeps.get('utils/format.js')?.has('commands/ping.js')).toBe(true)

			// Remove the module
			removeModule('commands/ping.js', graph)

			// Should be cleaned up
			expect(graph.deps.has('commands/ping.js')).toBe(false)
			expect(graph.revDeps.get('utils/format.js')?.has('commands/ping.js')).toBeFalsy()
			expect(graph.mtimes.has('commands/ping.js')).toBe(false)
		})
	})

	describe('buildInitialGraph', () => {
		it('builds graph from handler directories', () => {
			// Mock the build structure
			const buildRoot = path.join(tempDir, '.robo', 'build', 'development')
			fs.mkdirSync(buildRoot, { recursive: true })

			createTestFile(buildRoot, 'utils/format.js', 'export const format = () => {}')
			createTestFile(buildRoot, 'commands/ping.js', `import { format } from '../utils/format.js'\nexport default () => format('pong')`)
			createTestFile(buildRoot, 'events/ready.js', 'export default () => console.log("ready")')

			// Mock process.cwd to return tempDir
			const originalCwd = process.cwd
			process.cwd = () => tempDir

			try {
				const graph = buildInitialGraph('development', STANDARD_ROUTES)

				// Should have parsed handlers
				expect(graph.deps.has('commands/ping.js')).toBe(true)
				expect(graph.deps.has('events/ready.js')).toBe(true)

				// Should have parsed utility deps
				expect(graph.deps.get('commands/ping.js')?.has('utils/format.js')).toBe(true)

				// Should have reverse deps
				expect(graph.revDeps.get('utils/format.js')?.has('commands/ping.js')).toBe(true)
			} finally {
				process.cwd = originalCwd
			}
		})

		it('handles non-existent build directory', () => {
			const originalCwd = process.cwd
			process.cwd = () => tempDir

			try {
				const graph = buildInitialGraph('development', STANDARD_ROUTES)

				// Should return empty graph
				expect(graph.deps.size).toBe(0)
			} finally {
				process.cwd = originalCwd
			}
		})
	})

	describe('getImpactedHandlers', () => {
		it('finds handlers that depend on changed utility', () => {
			createTestFile(tempDir, 'utils/format.js', 'export const format = () => {}')
			createTestFile(tempDir, 'commands/ping.js', `import { format } from '../utils/format.js'`)
			createTestFile(tempDir, 'commands/help.js', 'export default () => "help"')

			const graph = createGraph(tempDir)
			parseModule('commands/ping.js', graph)
			parseModule('commands/help.js', graph)

			const impacted = getImpactedHandlers(graph, ['utils/format.js'], STANDARD_ROUTES).impacted

			expect(impacted).toContain('commands/ping.js')
			expect(impacted).not.toContain('commands/help.js')
		})

		it('finds handlers through deep dependency chains', () => {
			createTestFile(tempDir, 'lib/deep.js', 'export const deep = () => {}')
			createTestFile(tempDir, 'utils/format.js', `import { deep } from '../lib/deep.js'\nexport const format = () => deep()`)
			createTestFile(tempDir, 'commands/ping.js', `import { format } from '../utils/format.js'`)

			const graph = createGraph(tempDir)
			parseModule('commands/ping.js', graph)
			parseModule('utils/format.js', graph)

			// Change the deep utility
			const impacted = getImpactedHandlers(graph, ['lib/deep.js'], STANDARD_ROUTES).impacted

			// Should find ping through the chain: lib/deep.js -> utils/format.js -> commands/ping.js
			expect(impacted).toContain('commands/ping.js')
		})

		it('handles circular dependencies', () => {
			// Create circular dependency: a -> b -> a
			createTestFile(tempDir, 'utils/a.js', `import { b } from './b.js'\nexport const a = () => b()`)
			createTestFile(tempDir, 'utils/b.js', `import { a } from './a.js'\nexport const b = () => a()`)
			createTestFile(tempDir, 'commands/ping.js', `import { a } from '../utils/a.js'`)

			const graph = createGraph(tempDir)
			parseModule('commands/ping.js', graph)
			parseModule('utils/a.js', graph)
			parseModule('utils/b.js', graph)

			// Should not hang on circular deps
			const impacted = getImpactedHandlers(graph, ['utils/b.js'], STANDARD_ROUTES).impacted

			expect(impacted).toContain('commands/ping.js')
		})

		it('returns empty for unrelated utility changes', () => {
			createTestFile(tempDir, 'utils/unrelated.js', 'export const unrelated = () => {}')
			createTestFile(tempDir, 'commands/ping.js', 'export default () => "pong"')

			const graph = createGraph(tempDir)
			parseModule('commands/ping.js', graph)
			// Note: unrelated.js is not in the graph since no handler imports it

			const impacted = getImpactedHandlers(graph, ['utils/unrelated.js'], STANDARD_ROUTES).impacted

			expect(impacted).toHaveLength(0)
		})

		it('finds multiple impacted handlers', () => {
			createTestFile(tempDir, 'utils/shared.js', 'export const shared = () => {}')
			createTestFile(tempDir, 'commands/ping.js', `import { shared } from '../utils/shared.js'`)
			createTestFile(tempDir, 'commands/pong.js', `import { shared } from '../utils/shared.js'`)

			const graph = createGraph(tempDir)
			parseModule('commands/ping.js', graph)
			parseModule('commands/pong.js', graph)

			const impacted = getImpactedHandlers(graph, ['utils/shared.js'], STANDARD_ROUTES).impacted

			expect(impacted).toContain('commands/ping.js')
			expect(impacted).toContain('commands/pong.js')
		})

		it('keeps reverse edges for deleted modules so impacted handlers can be found', () => {
			createTestFile(tempDir, 'utils/format.js', 'export const format = () => {}')
			createTestFile(tempDir, 'commands/ping.js', `import { format } from '../utils/format.js'`)

			const graph = createGraph(tempDir)
			parseModule('commands/ping.js', graph)

			// Delete the dependency file on disk
			fs.rmSync(path.join(tempDir, 'utils/format.js'), { force: true })

			// Re-parse missing module (should remove forward deps but preserve reverse edges)
			parseModule('utils/format.js', graph)

			const impact = getImpactedHandlers(graph, ['utils/format.js'], STANDARD_ROUTES)
			expect(impact.exceededLimit).toBe(false)
			expect(impact.impacted).toContain('commands/ping.js')
		})
	})

	describe('updateGraphForFiles', () => {
		it('updates graph when files change', () => {
			createTestFile(tempDir, 'utils/a.js', 'export const a = 1')
			createTestFile(tempDir, 'commands/ping.js', `import { a } from '../utils/a.js'`)

			const graph = createGraph(tempDir)
			parseModule('commands/ping.js', graph)

			// Modify ping to add another import
			createTestFile(tempDir, 'utils/b.js', 'export const b = 2')
			createTestFile(
				tempDir,
				'commands/ping.js',
				`
				import { a } from '../utils/a.js'
				import { b } from '../utils/b.js'
			`
			)

			// Force mtime invalidation
			graph.mtimes.delete('commands/ping.js')
			updateGraphForFiles(graph, ['commands/ping.js'])

			// Should now have both dependencies
			expect(graph.deps.get('commands/ping.js')?.has('utils/a.js')).toBe(true)
			expect(graph.deps.get('commands/ping.js')?.has('utils/b.js')).toBe(true)
		})
	})

	describe('hasAffectedDynamicImports', () => {
		it('returns true when changed file has unresolved dynamic imports', () => {
			createTestFile(
				tempDir,
				'commands/dynamic.js',
				`
				const modulePath = './lazy.js'
				export default async () => {
					const mod = await import(modulePath)
				}
			`
			)

			const graph = createGraph(tempDir)
			parseModule('commands/dynamic.js', graph)

			const affected = hasAffectedDynamicImports(graph, ['commands/dynamic.js'])
			expect(affected).toBe(true)
		})

		it('returns false when no unresolved dynamic imports', () => {
			createTestFile(tempDir, 'commands/ping.js', 'export default () => "pong"')

			const graph = createGraph(tempDir)
			parseModule('commands/ping.js', graph)

			const affected = hasAffectedDynamicImports(graph, ['commands/ping.js'])
			expect(affected).toBe(false)
		})
	})

	describe('getGraphStats', () => {
		it('returns correct statistics', () => {
			createTestFile(tempDir, 'utils/a.js', 'export const a = 1')
			createTestFile(tempDir, 'utils/b.js', 'export const b = 2')
			createTestFile(
				tempDir,
				'commands/ping.js',
				`
				import { a } from '../utils/a.js'
				import { b } from '../utils/b.js'
			`
			)

			const graph = createGraph(tempDir)
			parseModule('commands/ping.js', graph)

			const stats = getGraphStats(graph)

			expect(stats.moduleCount).toBe(1) // Only ping.js is in deps (utils aren't parsed as roots)
			expect(stats.edgeCount).toBe(2) // Two imports
			expect(stats.unresolvedDynamicCount).toBe(0)
		})
	})
})
