/**
 * Unit tests for tunnel utility functions.
 *
 * These are pure functions that don't require mocking.
 */
import { describe, expect, it } from '@jest/globals'
import { formatAge, generateId, isProcessAlive, extractTunnelUrl } from '../../.robo/build/core/tunnel/utils.js'

describe('formatAge', () => {
	it('formats seconds correctly', () => {
		expect(formatAge(0)).toBe('0s')
		expect(formatAge(1000)).toBe('1s')
		expect(formatAge(5000)).toBe('5s')
		expect(formatAge(59000)).toBe('59s')
	})

	it('formats minutes and seconds', () => {
		expect(formatAge(60000)).toBe('1m 0s')
		expect(formatAge(90000)).toBe('1m 30s')
		expect(formatAge(300000)).toBe('5m 0s')
		expect(formatAge(3599000)).toBe('59m 59s')
	})

	it('formats hours and minutes', () => {
		expect(formatAge(3600000)).toBe('1h 0m')
		expect(formatAge(3660000)).toBe('1h 1m')
		expect(formatAge(7200000)).toBe('2h 0m')
		expect(formatAge(7260000)).toBe('2h 1m')
	})

	it('formats days and hours', () => {
		expect(formatAge(86400000)).toBe('1d 0h')
		expect(formatAge(90000000)).toBe('1d 1h')
		expect(formatAge(172800000)).toBe('2d 0h')
		expect(formatAge(180000000)).toBe('2d 2h')
	})
})

describe('generateId', () => {
	it('generates 6-character alphanumeric IDs', () => {
		const id = generateId()
		expect(id).toMatch(/^[a-z0-9]{6}$/)
	})

	it('generates unique IDs', () => {
		const ids = new Set(Array.from({ length: 100 }, generateId))
		// Should have 100 unique IDs (statistically very unlikely to have collisions)
		expect(ids.size).toBe(100)
	})

	it('generates IDs with only lowercase letters and numbers', () => {
		// Generate many IDs and check they all match the pattern
		for (let i = 0; i < 50; i++) {
			const id = generateId()
			expect(id).toMatch(/^[a-z0-9]+$/)
			expect(id.length).toBe(6)
		}
	})
})

describe('isProcessAlive', () => {
	it('returns true for current process', () => {
		expect(isProcessAlive(process.pid)).toBe(true)
	})

	it('returns false for non-existent PID', () => {
		// Use a very high PID that's unlikely to exist
		expect(isProcessAlive(999999999)).toBe(false)
	})

	// Note: PID 0 and negative PIDs have platform-specific behavior
	// On macOS, process.kill(0, 0) signals the process group, which succeeds
	// On Linux, behavior differs. We skip these tests for cross-platform compatibility.
})

describe('extractTunnelUrl', () => {
	// Note: This function is specifically for Cloudflare quick tunnels.
	// When using MockTunnelProvider, this function is NOT called since
	// MockTunnelProvider returns URLs directly without parsing output.

	it('extracts trycloudflare.com URLs from output', () => {
		const output = 'INF |  https://foo-bar-baz.trycloudflare.com'
		expect(extractTunnelUrl(output)).toBe('https://foo-bar-baz.trycloudflare.com')
	})

	it('extracts URL with complex subdomain', () => {
		const output = 'Some log line\nhttps://abc-def-123-xyz.trycloudflare.com\nMore output'
		expect(extractTunnelUrl(output)).toBe('https://abc-def-123-xyz.trycloudflare.com')
	})

	it('returns null for non-matching output', () => {
		expect(extractTunnelUrl('some random text')).toBeNull()
		expect(extractTunnelUrl('')).toBeNull()
		expect(extractTunnelUrl('https://example.com')).toBeNull()
	})

	it('matches api.trycloudflare.com (filtered elsewhere)', () => {
		// Note: extractTunnelUrl matches ANY trycloudflare.com subdomain
		// The filtering of api.trycloudflare.com happens in CloudflareProvider.waitForUrl
		// via the Ignore array, not in extractTunnelUrl
		const output = 'Request to https://api.trycloudflare.com/something'
		const result = extractTunnelUrl(output)
		// This function WILL match it - documenting actual behavior
		expect(result).toBe('https://api.trycloudflare.com')
	})

	it('extracts first URL when multiple are present', () => {
		const output = 'https://first.trycloudflare.com https://second.trycloudflare.com'
		expect(extractTunnelUrl(output)).toBe('https://first.trycloudflare.com')
	})
})
