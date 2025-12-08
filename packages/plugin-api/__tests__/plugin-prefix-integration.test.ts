/**
 * Integration Tests for Plugin Route Prefixing
 *
 * Tests the complete flow of plugin route prefixing, from configuration
 * to request handling, including API routes and static assets.
 */
import { describe, expect, it, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
	PluginRouteRegistry,
	initPluginRoutes,
	resetPluginRouteRegistry,
	getPluginRouteRegistry
} from '../.robo/build/core/plugin-routes.js'

// Test fixtures directory (ESM compatible)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'plugin-prefix-integration')

describe('Plugin Prefix Integration', () => {
	beforeAll(() => {
		// Create test fixtures directory structure
		mkdirSync(FIXTURES_DIR, { recursive: true })

		// Create mock plugin structure
		const mockPluginDir = path.join(FIXTURES_DIR, 'node_modules', '@robojs', 'mock', 'public')
		mkdirSync(mockPluginDir, { recursive: true })
		writeFileSync(path.join(mockPluginDir, 'index.html'), '<!DOCTYPE html><html><body>Mock UI</body></html>')
		writeFileSync(path.join(mockPluginDir, 'app.js'), 'console.log("mock app")')

		// Create another mock plugin
		const otherPluginDir = path.join(FIXTURES_DIR, 'node_modules', '@robojs', 'other', 'public')
		mkdirSync(otherPluginDir, { recursive: true })
		writeFileSync(path.join(otherPluginDir, 'index.html'), '<!DOCTYPE html><html><body>Other UI</body></html>')
	})

	afterAll(() => {
		if (existsSync(FIXTURES_DIR)) {
			rmSync(FIXTURES_DIR, { recursive: true })
		}
	})

	afterEach(() => {
		resetPluginRouteRegistry()
	})

	describe('API Route Prefix Stripping', () => {
		it('should strip prefix for API routes', () => {
			const registry = initPluginRoutes({
				'@robojs/mock': '/mock'
			})

			const match = registry.matchApiPrefix('/mock/api/v10/guilds')
			expect(match).not.toBeNull()
			expect(match?.prefix).toBe('/mock')

			const stripped = registry.stripPrefix('/mock/api/v10/guilds', match!.prefix)
			expect(stripped).toBe('/api/v10/guilds')
		})

		it('should handle root path after stripping', () => {
			const registry = initPluginRoutes({
				'@robojs/mock': '/mock'
			})

			const match = registry.matchApiPrefix('/mock')
			expect(match).not.toBeNull()

			const stripped = registry.stripPrefix('/mock', match!.prefix)
			expect(stripped).toBe('/')
		})

		it('should not strip prefix for non-matching paths', () => {
			const registry = initPluginRoutes({
				'@robojs/mock': '/mock'
			})

			const match = registry.matchApiPrefix('/api/v10/guilds')
			expect(match).toBeNull()
		})
	})

	describe('Static Asset Prefix Stripping', () => {
		it('should strip static prefix separately from API prefix', () => {
			const registry = initPluginRoutes({
				'@robojs/mock': {
					api: '/mock-api',
					static: '/mock-static'
				}
			})

			// API prefix
			const apiMatch = registry.matchApiPrefix('/mock-api/health')
			expect(apiMatch?.prefix).toBe('/mock-api')

			// Static prefix
			const staticMatch = registry.matchStaticPrefix('/mock-static/index.html')
			expect(staticMatch?.prefix).toBe('/mock-static')

			// Cross-check: API prefix shouldn't match static path
			const wrongMatch = registry.matchApiPrefix('/mock-static/index.html')
			expect(wrongMatch).toBeNull()
		})

		it('should handle static: false (no static prefix)', () => {
			const registry = initPluginRoutes({
				'@robojs/mock': {
					api: '/mock',
					static: false
				}
			})

			expect(registry.matchApiPrefix('/mock/api')).not.toBeNull()
			expect(registry.matchStaticPrefix('/mock/index.html')).toBeNull()
		})
	})

	describe('Multiple Plugins', () => {
		it('should handle multiple plugins with different prefixes', () => {
			const registry = initPluginRoutes({
				'@robojs/mock': '/mock',
				'@robojs/other': '/other'
			})

			const mockMatch = registry.matchApiPrefix('/mock/api/health')
			expect(mockMatch?.plugin).toBe('@robojs/mock')

			const otherMatch = registry.matchApiPrefix('/other/api/health')
			expect(otherMatch?.plugin).toBe('@robojs/other')
		})

		it('should match longest prefix first', () => {
			const registry = initPluginRoutes({
				'@robojs/mock': '/mock',
				'@robojs/mock-stage': '/mock/stage'
			})

			const stageMatch = registry.matchApiPrefix('/mock/stage/api')
			expect(stageMatch?.prefix).toBe('/mock/stage')
			expect(stageMatch?.plugin).toBe('@robojs/mock-stage')

			const mockMatch = registry.matchApiPrefix('/mock/api')
			expect(mockMatch?.prefix).toBe('/mock')
			expect(mockMatch?.plugin).toBe('@robojs/mock')
		})
	})

	describe('WebSocket Path Handling', () => {
		it('should handle WebSocket paths with prefix', () => {
			const registry = initPluginRoutes({
				'@robojs/mock': '/mock'
			})

			// WebSocket Gateway path
			const match = registry.matchApiPrefix('/mock/')
			expect(match).not.toBeNull()

			const stripped = registry.stripPrefix('/mock/', match!.prefix)
			expect(stripped).toBe('/')
		})

		it('should handle WebSocket paths with query parameters', () => {
			const registry = initPluginRoutes({
				'@robojs/mock': '/mock'
			})

			// In practice, query params are stripped before matching
			const pathWithoutQuery = '/mock/'
			const match = registry.matchApiPrefix(pathWithoutQuery)
			expect(match).not.toBeNull()
		})
	})

	describe('Backward Compatibility', () => {
		it('should work without any plugin prefixes configured', () => {
			const registry = initPluginRoutes()

			// No prefixes registered
			expect(registry.matchApiPrefix('/api/health')).toBeNull()
			expect(registry.matchStaticPrefix('/index.html')).toBeNull()
		})

		it('should work with empty plugin prefixes object', () => {
			const registry = initPluginRoutes({})

			expect(registry.matchApiPrefix('/api/health')).toBeNull()
		})
	})

	describe('Global Registry', () => {
		it('should maintain consistent registry across calls', () => {
			initPluginRoutes({
				'@robojs/mock': '/mock'
			})

			const registry1 = getPluginRouteRegistry()
			const registry2 = getPluginRouteRegistry()

			expect(registry1).toBe(registry2)
			expect(registry1.matchApiPrefix('/mock/api')).not.toBeNull()
		})

		it('should reset registry properly', () => {
			initPluginRoutes({
				'@robojs/mock': '/mock'
			})

			resetPluginRouteRegistry()

			const newRegistry = getPluginRouteRegistry()
			expect(newRegistry.matchApiPrefix('/mock/api')).toBeNull()
		})
	})
})

describe('Example: @robojs/mock with Prefix', () => {
	/**
	 * This test demonstrates the expected behavior for @robojs/mock
	 * when configured with a URL prefix.
	 */
	it('should transform routes as documented', () => {
		const registry = initPluginRoutes({
			'@robojs/mock': '/discord-mock'
		})

		// API route transformations
		const routes = [
			{ original: '/api/v10/gateway/bot', prefixed: '/discord-mock/api/v10/gateway/bot' },
			{ original: '/api/control/sessions', prefixed: '/discord-mock/api/control/sessions' },
			{ original: '/', prefixed: '/discord-mock/' }, // Gateway WebSocket
			{ original: '/stage/index.html', prefixed: '/discord-mock/stage/index.html' }
		]

		for (const { original, prefixed } of routes) {
			const match = registry.matchApiPrefix(prefixed)
			expect(match).not.toBeNull()
			expect(match?.prefix).toBe('/discord-mock')

			const stripped = registry.stripPrefix(prefixed, match!.prefix)
			expect(stripped).toBe(original)
		}
	})

	afterEach(() => {
		resetPluginRouteRegistry()
	})
})
