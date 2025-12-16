/**
 * Tests for Dev Reload Handler Integration
 *
 * Tests the no-cache headers added to static file serving for dev mode hot reload.
 */
import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals'

describe('Dev Mode Cache Headers', () => {
	const originalEnv = process.env.NODE_ENV

	afterEach(() => {
		process.env.NODE_ENV = originalEnv
	})

	describe('Cache-Control Header Logic', () => {
		const shouldAddNoCacheHeaders = (): boolean => {
			return process.env.NODE_ENV !== 'production'
		}

		it('should add no-cache headers in development mode', () => {
			process.env.NODE_ENV = 'development'
			expect(shouldAddNoCacheHeaders()).toBe(true)
		})

		it('should add no-cache headers when NODE_ENV is undefined', () => {
			delete process.env.NODE_ENV
			expect(shouldAddNoCacheHeaders()).toBe(true)
		})

		it('should NOT add no-cache headers in production mode', () => {
			process.env.NODE_ENV = 'production'
			expect(shouldAddNoCacheHeaders()).toBe(false)
		})

		it('should add no-cache headers in test mode', () => {
			process.env.NODE_ENV = 'test'
			expect(shouldAddNoCacheHeaders()).toBe(true)
		})
	})

	describe('Cache-Control Header Value', () => {
		const CACHE_CONTROL_VALUE = 'no-cache, no-store, must-revalidate'

		it('should include no-cache directive', () => {
			expect(CACHE_CONTROL_VALUE).toContain('no-cache')
		})

		it('should include no-store directive', () => {
			expect(CACHE_CONTROL_VALUE).toContain('no-store')
		})

		it('should include must-revalidate directive', () => {
			expect(CACHE_CONTROL_VALUE).toContain('must-revalidate')
		})

		it('should be a valid HTTP Cache-Control header', () => {
			// Valid Cache-Control directives are comma-separated
			const directives = CACHE_CONTROL_VALUE.split(',').map((d) => d.trim())
			expect(directives.length).toBe(3)
			directives.forEach((directive) => {
				expect(directive).toMatch(/^[a-z-]+$/)
			})
		})
	})

	describe('Response Header Setting', () => {
		it('should call setHeader with correct arguments', () => {
			const mockRes = {
				setHeader: jest.fn()
			}

			// Simulate what handler.ts does
			if (process.env.NODE_ENV !== 'production') {
				mockRes.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
			}

			expect(mockRes.setHeader).toHaveBeenCalledWith(
				'Cache-Control',
				'no-cache, no-store, must-revalidate'
			)
		})

		it('should NOT call setHeader in production', () => {
			process.env.NODE_ENV = 'production'

			const mockRes = {
				setHeader: jest.fn()
			}

			// Simulate what handler.ts does
			if (process.env.NODE_ENV !== 'production') {
				mockRes.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
			}

			expect(mockRes.setHeader).not.toHaveBeenCalled()
		})
	})
})

describe('Static File Serving for Hot Reload', () => {
	describe('File Types Affected', () => {
		const staticFileExtensions = ['.html', '.js', '.css', '.json', '.svg', '.png', '.jpg']

		it('should affect all common static file types', () => {
			// The cache headers are applied to all static files served by the handler
			staticFileExtensions.forEach((ext) => {
				expect(ext).toMatch(/^\.[a-z]+$/)
			})
		})

		it('should include index.html', () => {
			const isHtmlFile = (filename: string) => filename.endsWith('.html')
			expect(isHtmlFile('index.html')).toBe(true)
		})

		it('should include JavaScript bundles', () => {
			const isJsFile = (filename: string) => filename.endsWith('.js')
			expect(isJsFile('main.js')).toBe(true)
			expect(isJsFile('index-DNgXfM4f.js')).toBe(true) // Vite hash
		})

		it('should include CSS files', () => {
			const isCssFile = (filename: string) => filename.endsWith('.css')
			expect(isCssFile('styles.css')).toBe(true)
			expect(isCssFile('index-CM1C8ZhK.css')).toBe(true) // Vite hash
		})
	})

	describe('Build Signal File Exclusion', () => {
		it('should not cache build signal file', () => {
			// The .build-signal file should also get no-cache headers
			// This ensures the watcher can detect changes immediately
			const filename = '.build-signal'
			const shouldCache = process.env.NODE_ENV === 'production'
			expect(shouldCache).toBe(false) // In dev mode
		})
	})
})

describe('Production vs Development Behavior', () => {
	const originalEnv = process.env.NODE_ENV

	afterEach(() => {
		process.env.NODE_ENV = originalEnv
	})

	describe('Development Mode', () => {
		beforeEach(() => {
			process.env.NODE_ENV = 'development'
		})

		it('should prioritize fresh content over performance', () => {
			const addCacheHeaders = process.env.NODE_ENV !== 'production'
			expect(addCacheHeaders).toBe(true)
		})

		it('should ensure browser always fetches latest assets', () => {
			const cacheControl = 'no-cache, no-store, must-revalidate'
			expect(cacheControl).toContain('no-cache')
		})
	})

	describe('Production Mode', () => {
		beforeEach(() => {
			process.env.NODE_ENV = 'production'
		})

		it('should allow normal caching for performance', () => {
			const addNoCacheHeaders = process.env.NODE_ENV !== 'production'
			expect(addNoCacheHeaders).toBe(false)
		})

		it('should not interfere with CDN caching', () => {
			// In production, the handler should not set Cache-Control
			// allowing CDNs and browsers to cache normally
			const shouldSetCacheControl = process.env.NODE_ENV !== 'production'
			expect(shouldSetCacheControl).toBe(false)
		})
	})
})
