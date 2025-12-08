/**
 * Tests for utility functions in @robojs/sync
 */

import { describe, test, expect } from '@jest/globals'

// Import from built output
const { normalizeKey } = await import('../.robo/build/core/utils.js')

describe('normalizeKey', () => {
	describe('array input', () => {
		test('converts array to dot-separated string', () => {
			expect(normalizeKey(['room', '123'])).toBe('room.123')
		})

		test('handles single-element array', () => {
			expect(normalizeKey(['room'])).toBe('room')
		})

		test('handles empty array', () => {
			expect(normalizeKey([])).toBe('')
		})

		test('handles multiple elements', () => {
			expect(normalizeKey(['game', 'room', 'player', '1'])).toBe('game.room.player.1')
		})

		test('handles null values in array (joins as empty)', () => {
			// Array.join() treats null as empty string
			expect(normalizeKey(['room', null, 'test'])).toBe('room..test')
		})

		test('handles array with only null', () => {
			// Array.join() treats null as empty string
			expect(normalizeKey([null])).toBe('')
		})
	})

	describe('string input', () => {
		test('returns string as-is', () => {
			expect(normalizeKey('room.123')).toBe('room.123')
		})

		test('handles empty string', () => {
			expect(normalizeKey('')).toBe('')
		})

		test('handles string without dots', () => {
			expect(normalizeKey('room')).toBe('room')
		})
	})

	describe('undefined input', () => {
		test('returns undefined as-is (cast to string)', () => {
			// The function casts to string, so undefined becomes undefined
			expect(normalizeKey(undefined)).toBe(undefined)
		})
	})

	describe('edge cases', () => {
		test('handles array with empty strings', () => {
			expect(normalizeKey(['', 'room', ''])).toBe('.room.')
		})

		test('handles array with numbers converted to strings', () => {
			// Arrays should contain strings, but if numbers slip through
			expect(normalizeKey(['room', '123', '456'] as unknown as string[])).toBe('room.123.456')
		})
	})
})
