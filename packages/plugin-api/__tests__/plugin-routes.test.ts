/**
 * Tests for Plugin Route Registry
 *
 * Tests the prefix matching, stripping, and plugin asset detection
 * for transparent plugin route prefixing.
 */
import { describe, expect, it, beforeEach, afterEach } from '@jest/globals'
import {
	PluginRouteRegistry,
	initPluginRoutes,
	getPluginRouteRegistry,
	resetPluginRouteRegistry,
	type PluginPrefixConfig,
	type PluginPrefixMap
} from '../.robo/build/core/plugin-routes.js'

describe('PluginRouteRegistry', () => {
	let registry: PluginRouteRegistry

	beforeEach(() => {
		registry = new PluginRouteRegistry()
	})

	describe('register()', () => {
		it('should register a plugin with string prefix', () => {
			registry.register({
				'@robojs/mock': '/mock'
			})

			const plugin = registry.getPlugin('@robojs/mock')
			expect(plugin).toBeDefined()
			expect(plugin?.apiPrefix).toBe('/mock')
			expect(plugin?.staticPrefix).toBe('/mock')
		})

		it('should register a plugin with object prefix (same for api and static)', () => {
			registry.register({
				'@robojs/mock': {
					api: '/mock-api',
					static: '/mock-static'
				}
			})

			const plugin = registry.getPlugin('@robojs/mock')
			expect(plugin).toBeDefined()
			expect(plugin?.apiPrefix).toBe('/mock-api')
			expect(plugin?.staticPrefix).toBe('/mock-static')
		})

		it('should handle api-only prefix (static: false)', () => {
			registry.register({
				'@robojs/mock': {
					api: '/mock-api',
					static: false
				}
			})

			const plugin = registry.getPlugin('@robojs/mock')
			expect(plugin).toBeDefined()
			expect(plugin?.apiPrefix).toBe('/mock-api')
			expect(plugin?.staticPrefix).toBeNull()
		})

		it('should handle static-only prefix (api: false)', () => {
			registry.register({
				'@robojs/mock': {
					api: false,
					static: '/mock-static'
				}
			})

			const plugin = registry.getPlugin('@robojs/mock')
			expect(plugin).toBeDefined()
			expect(plugin?.apiPrefix).toBeNull()
			expect(plugin?.staticPrefix).toBe('/mock-static')
		})

		it('should normalize prefixes (add leading slash, remove trailing)', () => {
			registry.register({
				'@robojs/mock': 'mock/'
			})

			const plugin = registry.getPlugin('@robojs/mock')
			expect(plugin?.apiPrefix).toBe('/mock')
			expect(plugin?.staticPrefix).toBe('/mock')
		})

		it('should register multiple plugins', () => {
			registry.register({
				'@robojs/mock': '/mock',
				'@robojs/other': '/other'
			})

			expect(registry.getPlugin('@robojs/mock')?.apiPrefix).toBe('/mock')
			expect(registry.getPlugin('@robojs/other')?.apiPrefix).toBe('/other')
		})
	})

	describe('matchApiPrefix()', () => {
		beforeEach(() => {
			registry.register({
				'@robojs/mock': '/mock',
				'@robojs/stage': '/mock/stage', // Longer prefix
				'@robojs/other': '/other'
			})
		})

		it('should match exact prefix', () => {
			const match = registry.matchApiPrefix('/mock')
			expect(match).toBeDefined()
			expect(match?.prefix).toBe('/mock')
			expect(match?.plugin).toBe('@robojs/mock')
		})

		it('should match prefix followed by path', () => {
			const match = registry.matchApiPrefix('/mock/api/v10/guilds')
			expect(match).toBeDefined()
			expect(match?.prefix).toBe('/mock')
			expect(match?.plugin).toBe('@robojs/mock')
		})

		it('should match longest prefix first', () => {
			const match = registry.matchApiPrefix('/mock/stage/index.html')
			expect(match).toBeDefined()
			expect(match?.prefix).toBe('/mock/stage')
			expect(match?.plugin).toBe('@robojs/stage')
		})

		it('should return null for non-matching path', () => {
			const match = registry.matchApiPrefix('/api/v10/guilds')
			expect(match).toBeNull()
		})

		it('should not match partial prefix', () => {
			const match = registry.matchApiPrefix('/mockery/api')
			expect(match).toBeNull()
		})
	})

	describe('matchStaticPrefix()', () => {
		beforeEach(() => {
			registry.register({
				'@robojs/mock': {
					api: '/mock-api',
					static: '/mock-static'
				}
			})
		})

		it('should match static prefix separately from API prefix', () => {
			const apiMatch = registry.matchApiPrefix('/mock-api/health')
			const staticMatch = registry.matchStaticPrefix('/mock-static/index.html')

			expect(apiMatch?.prefix).toBe('/mock-api')
			expect(staticMatch?.prefix).toBe('/mock-static')
		})

		it('should return null when static is disabled', () => {
			registry.register({
				'@robojs/other': {
					api: '/other',
					static: false
				}
			})

			const staticMatch = registry.matchStaticPrefix('/other/index.html')
			expect(staticMatch).toBeNull()
		})
	})

	describe('stripPrefix()', () => {
		it('should strip prefix from path', () => {
			const result = registry.stripPrefix('/mock/api/v10/guilds', '/mock')
			expect(result).toBe('/api/v10/guilds')
		})

		it('should return / for exact prefix match', () => {
			const result = registry.stripPrefix('/mock', '/mock')
			expect(result).toBe('/')
		})

		it('should handle path without leading slash after stripping', () => {
			const result = registry.stripPrefix('/mock/health', '/mock')
			expect(result).toBe('/health')
		})

		it('should preserve query strings', () => {
			// Note: stripPrefix operates on pathname only, query strings should be handled separately
			const result = registry.stripPrefix('/mock/api?foo=bar', '/mock')
			expect(result).toBe('/api?foo=bar')
		})

		it('should return original path if prefix does not match', () => {
			const result = registry.stripPrefix('/other/api', '/mock')
			expect(result).toBe('/other/api')
		})
	})

	describe('hasStaticPlugins()', () => {
		it('should return false when no plugins registered', () => {
			expect(registry.hasStaticPlugins()).toBe(false)
		})

		it('should return true when plugins with static prefix are registered', () => {
			registry.register({
				'@robojs/mock': '/mock'
			})
			expect(registry.hasStaticPlugins()).toBe(true)
		})

		it('should return false when only api prefixes are registered', () => {
			registry.register({
				'@robojs/mock': {
					api: '/mock-api',
					static: false
				}
			})
			expect(registry.hasStaticPlugins()).toBe(false)
		})
	})
})

describe('Global Registry Functions', () => {
	afterEach(() => {
		resetPluginRouteRegistry()
	})

	describe('initPluginRoutes()', () => {
		it('should create and return a new registry', () => {
			const registry = initPluginRoutes()
			expect(registry).toBeInstanceOf(PluginRouteRegistry)
		})

		it('should register plugins if provided', () => {
			const registry = initPluginRoutes({
				'@robojs/mock': '/mock'
			})

			expect(registry.getPlugin('@robojs/mock')).toBeDefined()
		})
	})

	describe('getPluginRouteRegistry()', () => {
		it('should return the same instance after init', () => {
			initPluginRoutes()
			const registry1 = getPluginRouteRegistry()
			const registry2 = getPluginRouteRegistry()

			expect(registry1).toBe(registry2)
		})

		it('should create a new registry if none exists', () => {
			const registry = getPluginRouteRegistry()
			expect(registry).toBeInstanceOf(PluginRouteRegistry)
		})
	})

	describe('resetPluginRouteRegistry()', () => {
		it('should reset the global registry', () => {
			const registry1 = initPluginRoutes({ '@robojs/mock': '/mock' })
			resetPluginRouteRegistry()
			const registry2 = getPluginRouteRegistry()

			expect(registry1).not.toBe(registry2)
			expect(registry2.getPlugin('@robojs/mock')).toBeUndefined()
		})
	})
})

describe('Exclusive Mode', () => {
	let registry: PluginRouteRegistry

	beforeEach(() => {
		registry = new PluginRouteRegistry()
	})

	it('should default to exclusive: true for string prefix', () => {
		registry.register({
			'@robojs/mock': '/mock'
		})

		const plugin = registry.getPlugin('@robojs/mock')
		expect(plugin?.exclusive).toBe(true)
	})

	it('should default to exclusive: true for object prefix', () => {
		registry.register({
			'@robojs/mock': {
				api: '/mock-api',
				static: '/mock-static'
			}
		})

		const plugin = registry.getPlugin('@robojs/mock')
		expect(plugin?.exclusive).toBe(true)
	})

	it('should support explicit exclusive: false', () => {
		registry.register({
			'@robojs/mock': {
				api: '/mock',
				exclusive: false
			}
		})

		const plugin = registry.getPlugin('@robojs/mock')
		expect(plugin?.exclusive).toBe(false)
	})

	it('should support explicit exclusive: true', () => {
		registry.register({
			'@robojs/mock': {
				api: '/mock',
				exclusive: true
			}
		})

		const plugin = registry.getPlugin('@robojs/mock')
		expect(plugin?.exclusive).toBe(true)
	})

	it('should return exclusive status via isExclusive()', () => {
		registry.register({
			'@robojs/mock': '/mock',
			'@robojs/other': {
				api: '/other',
				exclusive: false
			}
		})

		expect(registry.isExclusive('@robojs/mock')).toBe(true)
		expect(registry.isExclusive('@robojs/other')).toBe(false)
		expect(registry.isExclusive('@robojs/unknown')).toBe(true) // Default for unknown
	})

	it('should include exclusive status in getApiPrefixes()', () => {
		registry.register({
			'@robojs/mock': '/mock',
			'@robojs/other': {
				api: '/other',
				exclusive: false
			}
		})

		const prefixes = registry.getApiPrefixes()
		expect(prefixes).toHaveLength(2)

		const mockPrefix = prefixes.find((p) => p.plugin === '@robojs/mock')
		expect(mockPrefix?.exclusive).toBe(true)

		const otherPrefix = prefixes.find((p) => p.plugin === '@robojs/other')
		expect(otherPrefix?.exclusive).toBe(false)
	})
})

describe('Prefix Edge Cases', () => {
	let registry: PluginRouteRegistry

	beforeEach(() => {
		registry = new PluginRouteRegistry()
	})

	it('should not match root prefix / (intentional - would match everything)', () => {
		// Root prefix '/' is a special case that doesn't make practical sense
		// because it would match all paths. The implementation intentionally
		// doesn't match it to prevent unintended behavior.
		registry.register({
			'@robojs/mock': '/'
		})

		// Root prefix doesn't match arbitrary paths
		const match = registry.matchApiPrefix('/api/health')
		expect(match).toBeNull()
	})

	it('should handle deeply nested prefix', () => {
		registry.register({
			'@robojs/mock': '/api/v1/mock/server'
		})

		const match = registry.matchApiPrefix('/api/v1/mock/server/health')
		expect(match?.prefix).toBe('/api/v1/mock/server')

		const stripped = registry.stripPrefix('/api/v1/mock/server/health', '/api/v1/mock/server')
		expect(stripped).toBe('/health')
	})

	it('should handle prefix with special characters', () => {
		registry.register({
			'@robojs/mock': '/mock-server_v1'
		})

		const match = registry.matchApiPrefix('/mock-server_v1/health')
		expect(match?.prefix).toBe('/mock-server_v1')
	})
})
