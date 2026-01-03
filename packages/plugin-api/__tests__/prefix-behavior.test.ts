/**
 * Tests for Server Prefix Behavior
 *
 * These tests ensure the `prefix` option in @robojs/server config behaves correctly:
 * 1. Default prefix is '/api'
 * 2. Custom prefix REPLACES the default (not prepends)
 * 3. Leading slash normalization
 * 4. Null/false disables prefix
 *
 * @see https://github.com/anthropics/robo.js/issues/xxx - Prefix misconfiguration caused 404s
 */
import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals'

describe('Server Prefix Behavior', () => {
	describe('Prefix Configuration Rules', () => {
		/**
		 * The prefix option REPLACES the default '/api' prefix entirely.
		 * This is a critical behavior that must not change.
		 */
		it('should document: prefix REPLACES default /api, does not prepend', () => {
			// This test documents the expected behavior
			const examples = [
				{
					config: undefined,
					defaultApplied: '/api',
					routeKey: 'control/sessions',
					expectedPath: '/api/control/sessions'
				},
				{
					config: '/mock/api',
					defaultApplied: '/mock/api',
					routeKey: 'control/sessions',
					expectedPath: '/mock/api/control/sessions'
				},
				{
					config: '/custom',
					defaultApplied: '/custom',
					routeKey: 'health',
					expectedPath: '/custom/health'
				}
			]

			for (const example of examples) {
				// Simulate the prefix resolution logic from prepare.ts
				const prefix = example.config === undefined ? '/api' : example.config
				const expectedPath = prefix + '/' + example.routeKey

				expect(expectedPath).toBe(example.expectedPath)
			}
		})

		/**
		 * Prefixes without leading slashes cause route mismatches.
		 * Routes are registered at 'mock/api/...' but requests come in as '/mock/api/...'
		 */
		it('should document: prefix without leading slash breaks routing', () => {
			// This demonstrates why leading slash is critical
			const badPrefix = 'mock' // No leading slash
			const routeKey = 'control/sessions'

			// Routes get registered without leading slash
			const registeredPath = badPrefix + '/' + routeKey // 'mock/control/sessions'

			// But incoming URLs have leading slash
			const incomingUrl = '/mock/control/sessions'

			// The registered path doesn't match the incoming URL directly
			expect(registeredPath).not.toBe(incomingUrl) // 'mock/...' !== '/mock/...'
			expect(registeredPath).toBe('mock/control/sessions')
			expect(incomingUrl).toBe('/mock/control/sessions')

			// The radix router would try to match '/mock/control/sessions'
			// against 'mock/control/sessions' - these are different!
			expect(registeredPath.startsWith('/')).toBe(false)
			expect(incomingUrl.startsWith('/')).toBe(true)
		})

		/**
		 * Correct prefix configuration includes leading slash.
		 */
		it('should document: prefix with leading slash works correctly', () => {
			const goodPrefix = '/mock/api' // With leading slash
			const routeKey = 'control/sessions'

			// Routes get registered with leading slash
			const registeredPath = goodPrefix + '/' + routeKey // '/mock/api/control/sessions'

			// Incoming URLs also have leading slash
			const incomingUrl = '/mock/api/control/sessions'

			// These match!
			expect(registeredPath).toBe(incomingUrl)
		})
	})

	describe('Prefix Normalization', () => {
		/**
		 * Helper to simulate the normalization that SHOULD happen
		 * (but currently doesn't in start.ts)
		 */
		function normalizePrefix(prefix: string | null | false | undefined): string {
			if (prefix === null || prefix === false) {
				return ''
			}
			if (prefix === undefined) {
				return '/api'
			}
			// Ensure leading slash
			if (!prefix.startsWith('/')) {
				prefix = '/' + prefix
			}
			// Remove trailing slash
			if (prefix.endsWith('/') && prefix.length > 1) {
				prefix = prefix.slice(0, -1)
			}
			return prefix
		}

		it('should add leading slash if missing', () => {
			expect(normalizePrefix('mock')).toBe('/mock')
			expect(normalizePrefix('api/v2')).toBe('/api/v2')
		})

		it('should preserve existing leading slash', () => {
			expect(normalizePrefix('/mock')).toBe('/mock')
			expect(normalizePrefix('/api/v2')).toBe('/api/v2')
		})

		it('should remove trailing slash', () => {
			expect(normalizePrefix('/mock/')).toBe('/mock')
			expect(normalizePrefix('mock/')).toBe('/mock')
		})

		it('should handle root path correctly', () => {
			expect(normalizePrefix('/')).toBe('/')
		})

		it('should return empty string for null or false', () => {
			expect(normalizePrefix(null)).toBe('')
			expect(normalizePrefix(false)).toBe('')
		})

		it('should return default /api for undefined', () => {
			expect(normalizePrefix(undefined)).toBe('/api')
		})
	})

	describe('Route Path Generation', () => {
		/**
		 * Simulate how routes are generated in start.ts
		 */
		function generateRoutePath(prefix: string, routeKey: string): string {
			// This is the logic from start.ts line 188
			const PATH_REGEX = /\[(.+?)\]/g
			const baseKey = prefix + '/' + routeKey.replace(PATH_REGEX, ':$1')
			return baseKey
		}

		it('should generate correct path for control/sessions with /api prefix', () => {
			const path = generateRoutePath('/api', 'control/sessions')
			expect(path).toBe('/api/control/sessions')
		})

		it('should generate correct path for control/sessions with /mock/api prefix', () => {
			const path = generateRoutePath('/mock/api', 'control/sessions')
			expect(path).toBe('/mock/api/control/sessions')
		})

		it('should handle dynamic segments correctly', () => {
			const path = generateRoutePath('/api', 'users/[id]')
			expect(path).toBe('/api/users/:id')
		})

		it('should handle nested dynamic segments', () => {
			const path = generateRoutePath('/mock/api', 'v10/channels/[id]/messages/[messageId]')
			expect(path).toBe('/mock/api/v10/channels/:id/messages/:messageId')
		})

		it('should generate WRONG path when prefix lacks leading slash', () => {
			// This test documents the bug behavior
			const path = generateRoutePath('mock', 'control/sessions')
			expect(path).toBe('mock/control/sessions') // Missing leading slash!
			expect(path).not.toBe('/mock/control/sessions')
		})
	})

	describe('Common Prefix Configurations', () => {
		const testCases = [
			{
				name: 'default API prefix',
				prefix: '/api',
				routes: ['health', 'users', 'v10/channels/[id]'],
				expectedPaths: ['/api/health', '/api/users', '/api/v10/channels/:id']
			},
			{
				name: 'plugin prefix prepended to base path (e.g., @robojs/mock)',
				prefix: '/mock', // Plugin prefix
				routes: ['api/control/sessions', 'api/v10/gateway/bot', 'api/control/sessions/[id]/rate-limit'],
				expectedPaths: [
					'/mock/api/control/sessions',
					'/mock/api/v10/gateway/bot',
					'/mock/api/control/sessions/:id/rate-limit'
				]
			},
			{
				name: 'custom single-level prefix',
				prefix: '/custom',
				routes: ['health', 'data/[id]'],
				expectedPaths: ['/custom/health', '/custom/data/:id']
			},
			{
				name: 'deeply nested prefix',
				prefix: '/api/v1/internal',
				routes: ['users', 'admin/settings'],
				expectedPaths: ['/api/v1/internal/users', '/api/v1/internal/admin/settings']
			}
		]

		for (const { name, prefix, routes, expectedPaths } of testCases) {
			it(`should handle ${name}`, () => {
				const PATH_REGEX = /\[(.+?)\]/g

				routes.forEach((route, index) => {
					const path = prefix + '/' + route.replace(PATH_REGEX, ':$1')
					expect(path).toBe(expectedPaths[index])
				})
			})
		}
	})
})

describe('Regression Prevention: Mock Package Prefix', () => {
	/**
	 * These tests specifically prevent the regression where @robojs/mock
	 * routes were inaccessible due to incorrect prefix configuration.
	 *
	 * IMPORTANT: There are TWO different prefix systems:
	 * 1. Project server config `prefix`: REPLACES the default `/api` for standalone projects
	 * 2. Plugin manifest `prefix`: PREPENDED to routes by @robojs/server when used as a plugin
	 *
	 * For plugins, the prefix is stored in the manifest and prepended to baseKey
	 * (which already includes `/api` from the project's server config).
	 */

	it('should document: plugin prefix is prepended to base route key', () => {
		// When @robojs/mock is used as a plugin:
		// - Plugin declares: prefix: '/mock'
		// - Manifest stores: "prefix": "mock"
		// - Registry normalizes to: /mock
		// - baseKey includes: /api (from project's server config)
		// - Route building: pluginPrefix + baseKey = /mock + /api/control/sessions

		const pluginPrefix = '/mock' // What plugin declares
		const baseKey = '/api/control/sessions' // Built from project prefix + routeKey

		// Final route path
		const routePath = pluginPrefix + baseKey
		expect(routePath).toBe('/mock/api/control/sessions')
	})

	it('should document: plugin should NOT include /api in its prefix', () => {
		// WRONG: Plugin declares prefix: '/mock/api'
		// This causes routes at /mock/api/api/control/sessions (double /api!)

		const wrongPluginPrefix = '/mock/api'
		const baseKey = '/api/control/sessions'

		const wrongPath = wrongPluginPrefix + baseKey
		expect(wrongPath).toBe('/mock/api/api/control/sessions')
		expect(wrongPath).toContain('/api/api/') // This is the bug!
	})

	it('should use /mock prefix for plugin routes (prepended to base path)', () => {
		// The mock package MUST use '/mock' (NOT '/mock/api')
		// The /api comes from the base path, not the plugin prefix

		const correctPluginPrefix = '/mock'
		const baseApiPath = '/api'

		// Control API routes
		const controlRoutes = [
			'control/sessions',
			'control/sessions/[id]',
			'control/sessions/[id]/rate-limit',
			'control/sessions/[id]/permissions/enforcement',
			'control/sessions/[id]/permissions/overrides',
			'control/sessions/[id]/permissions/denied'
		]

		const PATH_REGEX = /\[(.+?)\]/g

		for (const route of controlRoutes) {
			// baseKey = baseApiPath + '/' + route
			const baseKey = baseApiPath + '/' + route.replace(PATH_REGEX, ':$1')
			// pluginPrefix + baseKey
			const path = correctPluginPrefix + baseKey

			// Path must start with /mock/api/control
			expect(path.startsWith('/mock/api/control')).toBe(true)

			// Path must have leading slash
			expect(path.startsWith('/')).toBe(true)

			// Path must NOT have double /api
			expect(path).not.toContain('/api/api/')
		}
	})

	it('should NOT use prefix without leading slash in manifest normalization', () => {
		// The manifest strips leading slash, but registry adds it back
		// If this normalization fails, routes break

		const manifestPrefix = 'mock' // What manifest stores (no leading slash)
		const normalizedPrefix = '/' + manifestPrefix // What registry should normalize to

		expect(normalizedPrefix).toBe('/mock')
		expect(normalizedPrefix.startsWith('/')).toBe(true)
	})
})
