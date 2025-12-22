/**
 * Phase 10: JSON Patch Generation Tests
 *
 * Tests that JSON Patch (RFC 6902) is correctly generated:
 * - Add operations for new fields
 * - Remove operations for deleted fields
 * - Replace operations for changed values
 * - Nested object support
 */

import { describe, test, expect } from '@jest/globals'
import { computePatches, applyPatches } from '../../../src/flashcore/plugin/utils.js'

describe('Phase 10: JSON Patch Generation', () => {
	describe('computePatches', () => {
		test('generates add operation for new field', () => {
			const before = { id: '1', name: 'Alice' }
			const after = { id: '1', name: 'Alice', age: 30 }
			
			const patches = computePatches(before, after)
			
			expect(patches).toEqual([
				{ op: 'add', path: '/age', value: 30 }
			])
		})

		test('generates remove operation for deleted field', () => {
			const before = { id: '1', name: 'Alice', age: 30 }
			const after = { id: '1', name: 'Alice' }
			
			const patches = computePatches(before, after)
			
			expect(patches).toEqual([
				{ op: 'remove', path: '/age' }
			])
		})

		test('generates replace operation for changed value', () => {
			const before = { id: '1', name: 'Alice', age: 30 }
			const after = { id: '1', name: 'Alice', age: 31 }
			
			const patches = computePatches(before, after)
			
			expect(patches).toEqual([
				{ op: 'replace', path: '/age', value: 31 }
			])
		})

		test('handles nested object changes', () => {
			const before = { id: '1', profile: { name: 'Alice', bio: 'Hello' } }
			const after = { id: '1', profile: { name: 'Alice', bio: 'Updated' } }
			
			const patches = computePatches(before, after)
			
			expect(patches).toEqual([
				{ op: 'replace', path: '/profile/bio', value: 'Updated' }
			])
		})

		test('generates multiple patches for multiple changes', () => {
			const before = { id: '1', name: 'Alice', age: 30, status: 'active' }
			const after = { id: '1', name: 'Bob', points: 100 }
			
			const patches = computePatches(before, after)
			
			expect(patches).toContainEqual({ op: 'replace', path: '/name', value: 'Bob' })
			expect(patches).toContainEqual({ op: 'remove', path: '/age' })
			expect(patches).toContainEqual({ op: 'remove', path: '/status' })
			expect(patches).toContainEqual({ op: 'add', path: '/points', value: 100 })
		})

		test('returns empty array when no changes', () => {
			const before = { id: '1', name: 'Alice' }
			const after = { id: '1', name: 'Alice' }
			
			const patches = computePatches(before, after)
			
			expect(patches).toEqual([])
		})
	})

	describe('applyPatches', () => {
		test('applies add operation', () => {
			const obj = { id: '1', name: 'Alice' }
			const result = applyPatches(obj, [
				{ op: 'add', path: '/age', value: 30 }
			])
			
			expect(result).toEqual({ id: '1', name: 'Alice', age: 30 })
		})

		test('applies remove operation', () => {
			const obj = { id: '1', name: 'Alice', age: 30 }
			const result = applyPatches(obj, [
				{ op: 'remove', path: '/age' }
			])
			
			expect(result).toEqual({ id: '1', name: 'Alice' })
		})

		test('applies replace operation', () => {
			const obj = { id: '1', name: 'Alice' }
			const result = applyPatches(obj, [
				{ op: 'replace', path: '/name', value: 'Bob' }
			])
			
			expect(result).toEqual({ id: '1', name: 'Bob' })
		})

		test('does not mutate original object', () => {
			const obj = { id: '1', name: 'Alice' }
			const result = applyPatches(obj, [
				{ op: 'add', path: '/age', value: 30 }
			])
			
			expect(obj).toEqual({ id: '1', name: 'Alice' })
			expect(result).toEqual({ id: '1', name: 'Alice', age: 30 })
		})

		test('applies multiple patches in order', () => {
			const obj = { id: '1', a: 1, b: 2 }
			const result = applyPatches(obj, [
				{ op: 'remove', path: '/a' },
				{ op: 'replace', path: '/b', value: 20 },
				{ op: 'add', path: '/c', value: 3 }
			])
			
			expect(result).toEqual({ id: '1', b: 20, c: 3 })
		})
	})

	describe('roundtrip', () => {
		test('patches can recreate after state', () => {
			const before = { id: '1', name: 'Alice', age: 30, active: true }
			const after = { id: '1', name: 'Bob', points: 100, active: true }
			
			const patches = computePatches(before, after)
			const reconstructed = applyPatches(before, patches)
			
			expect(reconstructed).toEqual(after)
		})
	})
})
