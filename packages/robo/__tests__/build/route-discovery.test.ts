/**
 * Route Discovery Tests
 *
 * Tests the route discovery system focusing on:
 * - Route validation and conflict detection
 * - Route grouping utilities
 * - Mode-specific path resolution (tested via RoboPaths)
 *
 * NOTE: Tests that require actual route file loading via dynamic imports are skipped
 * because Jest cannot handle ESM dynamic imports from temp directories.
 * Full route discovery with file loading is tested in E2E tests.
 *
 * The skipped tests are marked with:
 * - "Dynamic Import Required" - needs actual JS file loading
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'

// Use built dist files
import { validateRoutes, groupRoutesByDirectory } from '../../dist/cli/utils/route-discovery.js'
import { RoboPaths } from '../../dist/core/paths.js'
import type { DiscoveredRoute } from '../../dist/types/routes.js'

// Helper to create test routes with correct types
function createRoute(overrides: Partial<DiscoveredRoute> & { name: string; sourcePath: string }): DiscoveredRoute {
	return {
		name: overrides.name,
		directory: overrides.directory ?? `/src/${overrides.name}`,
		config: overrides.config ?? { key: { style: 'filename' } },
		namespace: overrides.namespace ?? 'project',
		sourcePath: overrides.sourcePath,
		...overrides
	}
}

describe('Route Discovery', () => {
	let tempDir: string

	beforeEach(async () => {
		tempDir = path.join(os.tmpdir(), `robo-routes-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
		await fs.mkdir(tempDir, { recursive: true })
		RoboPaths.configure({ baseDir: tempDir, customBuildDir: undefined })
	})

	afterEach(async () => {
		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch {
			// Ignore
		}
	})

	describe('discoverRoutes()', () => {
		/**
		 * NOTE: Most discoverRoutes tests are skipped because the function uses
		 * dynamic imports to load route definition files, and Jest cannot handle
		 * ESM dynamic imports from temp directories.
		 *
		 * Full route discovery is tested in E2E tests where proper module resolution works.
		 */

		describe('Dynamic Import Required - Skipped', () => {
			it.skip('should discover routes from production mode directory', async () => {
				// Requires dynamic import of .js file - see E2E tests
			})

			it.skip('should discover routes from development mode directory', async () => {
				// Requires dynamic import of .js file - see E2E tests
			})

			it.skip('should discover routes from custom mode directory', async () => {
				// Requires dynamic import of .js file - see E2E tests
			})

			it.skip('should not cross-contaminate between modes', async () => {
				// Requires dynamic import of .js file - see E2E tests
			})

			it.skip('should discover plugin routes (non-mode-specific)', async () => {
				// Requires dynamic import of .js file - see E2E tests
			})

			it.skip('should handle incremental builds', async () => {
				// Requires dynamic import of .js file - see E2E tests
			})
		})
	})

	describe('validateRoutes()', () => {
		it('should return empty array for no conflicts', () => {
			const routes: DiscoveredRoute[] = [
				createRoute({ name: 'commands', sourcePath: '/a/commands.js' }),
				createRoute({ name: 'events', sourcePath: '/a/events.js', config: { key: { style: 'filepath' } } })
			]

			const conflicts = validateRoutes(routes)
			expect(conflicts).toEqual([])
		})

		it('should detect duplicate route names in same namespace', () => {
			const routes: DiscoveredRoute[] = [
				createRoute({ name: 'commands', sourcePath: '/a/commands.js', namespace: 'project' }),
				createRoute({ name: 'commands', sourcePath: '/b/commands.js', namespace: 'project' })
			]

			const conflicts = validateRoutes(routes)
			expect(conflicts.length).toBeGreaterThan(0)
			expect(conflicts[0]).toContain('commands')
		})

		it('should allow same route name in different namespaces with different directories', () => {
			// Routes from different sources (project vs plugin) can have the same name
			// as long as they have different directories
			const routes: DiscoveredRoute[] = [
				createRoute({ name: 'commands', sourcePath: '/a/commands.js', namespace: 'project', directory: '/src/commands' }),
				createRoute({ name: 'commands', sourcePath: '/b/commands.js', namespace: 'plugin-a', directory: '/node_modules/plugin-a/commands' })
			]

			const conflicts = validateRoutes(routes)
			expect(conflicts).toEqual([])
		})

		it('should detect multiple conflicts', () => {
			const routes: DiscoveredRoute[] = [
				createRoute({ name: 'commands', sourcePath: '/a/commands.js', namespace: 'project' }),
				createRoute({ name: 'commands', sourcePath: '/b/commands.js', namespace: 'project' }),
				createRoute({ name: 'events', sourcePath: '/a/events.js', namespace: 'project' }),
				createRoute({ name: 'events', sourcePath: '/c/events.js', namespace: 'project' })
			]

			const conflicts = validateRoutes(routes)
			expect(conflicts.length).toBe(2)
		})

		it('should handle empty routes array', () => {
			const conflicts = validateRoutes([])
			expect(conflicts).toEqual([])
		})

		it('should handle single route', () => {
			const routes: DiscoveredRoute[] = [
				createRoute({ name: 'single', sourcePath: '/a/single.js' })
			]

			const conflicts = validateRoutes(routes)
			expect(conflicts).toEqual([])
		})
	})

	describe('groupRoutesByDirectory()', () => {
		/**
		 * Note: groupRoutesByDirectory groups by route.directory property,
		 * not by the parent of sourcePath.
		 */

		it('should group routes by their directory property', () => {
			const routes: DiscoveredRoute[] = [
				createRoute({ name: 'cmd1', directory: '/src/commands', sourcePath: '/build/commands/cmd1.js' }),
				createRoute({ name: 'cmd2', directory: '/src/commands', sourcePath: '/build/commands/cmd2.js' }),
				createRoute({ name: 'evt1', directory: '/src/events', sourcePath: '/build/events/evt1.js' })
			]

			const grouped = groupRoutesByDirectory(routes)

			expect(grouped.has('/src/commands')).toBe(true)
			expect(grouped.has('/src/events')).toBe(true)
			expect(grouped.get('/src/commands')?.length).toBe(2)
			expect(grouped.get('/src/events')?.length).toBe(1)
		})

		it('should handle routes in same directory', () => {
			const routes: DiscoveredRoute[] = [
				createRoute({ name: 'a', directory: '/src/shared', sourcePath: '/dir/a.js' }),
				createRoute({ name: 'b', directory: '/src/shared', sourcePath: '/dir/b.js' }),
				createRoute({ name: 'c', directory: '/src/shared', sourcePath: '/dir/c.js' })
			]

			const grouped = groupRoutesByDirectory(routes)

			expect(grouped.size).toBe(1)
			expect(grouped.get('/src/shared')?.length).toBe(3)
		})

		it('should handle empty array', () => {
			const grouped = groupRoutesByDirectory([])
			expect(grouped.size).toBe(0)
		})

		it('should preserve route properties', () => {
			const route: DiscoveredRoute = createRoute({
				name: 'test',
				directory: '/src/api',
				config: { key: { style: 'filepath' } },
				sourcePath: '/build/api/test.js',
				namespace: 'custom-ns'
			})

			const grouped = groupRoutesByDirectory([route])
			const groupedRoute = grouped.get('/src/api')?.[0]

			expect(groupedRoute).toEqual(route)
		})

		it('should handle routes with different directories', () => {
			const routes: DiscoveredRoute[] = [
				createRoute({ name: 'shallow', directory: '/src/a', sourcePath: '/a/shallow.js' }),
				createRoute({ name: 'deep', directory: '/src/a/b', sourcePath: '/a/b/deep.js' }),
				createRoute({ name: 'deeper', directory: '/src/a/b/c', sourcePath: '/a/b/c/deeper.js' })
			]

			const grouped = groupRoutesByDirectory(routes)

			expect(grouped.size).toBe(3)
			expect(grouped.has('/src/a')).toBe(true)
			expect(grouped.has('/src/a/b')).toBe(true)
			expect(grouped.has('/src/a/b/c')).toBe(true)
		})
	})

	describe('Mode-specific path resolution', () => {
		/**
		 * These tests verify that RoboPaths returns correct mode-specific paths
		 * for route directories. The actual route discovery tests are in E2E tests.
		 */

		it('should use production mode in routes directory path', () => {
			const routesDir = RoboPaths.routesDir('production')
			expect(routesDir).toContain('production')
			expect(routesDir).toContain('robo')
			expect(routesDir).toContain('routes')
		})

		it('should use development mode in routes directory path', () => {
			const routesDir = RoboPaths.routesDir('development')
			expect(routesDir).toContain('development')
			expect(routesDir).not.toContain('production')
		})

		it('should use custom mode in routes directory path', () => {
			const routesDir = RoboPaths.routesDir('staging')
			expect(routesDir).toContain('staging')
		})

		it('should have different paths for different modes', () => {
			const prodRoutes = RoboPaths.routesDir('production')
			const devRoutes = RoboPaths.routesDir('development')
			const stagingRoutes = RoboPaths.routesDir('staging')

			expect(prodRoutes).not.toBe(devRoutes)
			expect(prodRoutes).not.toBe(stagingRoutes)
			expect(devRoutes).not.toBe(stagingRoutes)
		})

		it('should use plugin routes without mode suffix', () => {
			const pluginRoutes = RoboPaths.pluginRoutesDir('@robojs/test')
			expect(pluginRoutes).not.toContain('production')
			expect(pluginRoutes).not.toContain('development')
			expect(pluginRoutes).toContain('@robojs/test')
		})
	})
})
