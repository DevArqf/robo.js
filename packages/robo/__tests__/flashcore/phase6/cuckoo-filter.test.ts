/**
 * Phase 6: CuckooFilter Tests
 *
 * Tests for the Cuckoo filter probabilistic data structure.
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { CuckooFilter } from '../../../src/flashcore/index/filter.js'

describe('CuckooFilter', () => {
	let filter: CuckooFilter

	beforeEach(() => {
		filter = new CuckooFilter()
	})

	describe('add/mightContain/remove', () => {
		it('should add and find items', () => {
			expect(filter.add('item1')).toBe(true)
			expect(filter.mightContain('item1')).toBe(true)
		})

		it('should not find items that were never added', () => {
			filter.add('item1')
			expect(filter.mightContain('item2')).toBe(false)
		})

		it('should remove items', () => {
			filter.add('item1')
			expect(filter.mightContain('item1')).toBe(true)

			expect(filter.remove('item1')).toBe(true)
			expect(filter.mightContain('item1')).toBe(false)
		})

		it('should return false when removing non-existent items', () => {
			expect(filter.remove('nonexistent')).toBe(false)
		})

		it('should handle multiple items', () => {
			const items = ['a', 'b', 'c', 'd', 'e']

			for (const item of items) {
				filter.add(item)
			}

			for (const item of items) {
				expect(filter.mightContain(item)).toBe(true)
			}

			expect(filter.getCount()).toBe(5)
		})

		it('should handle duplicate adds (idempotent)', () => {
			filter.add('item1')
			filter.add('item1')
			filter.add('item1')

			// Count will increment each time, but mightContain is still true
			expect(filter.mightContain('item1')).toBe(true)
		})

		it('should handle remove after multiple adds', () => {
			filter.add('item1')
			filter.add('item1')

			// First remove succeeds
			expect(filter.remove('item1')).toBe(true)
			// Second remove also succeeds (duplicate fingerprints)
			expect(filter.remove('item1')).toBe(true)
			// Third remove fails
			expect(filter.remove('item1')).toBe(false)
		})
	})

	describe('false positives', () => {
		it('should have a low false positive rate (<3%)', () => {
			const numItems = 10000
			const testItems = 10000

			// Add items
			for (let i = 0; i < numItems; i++) {
				filter.add(`item-${i}`)
			}

			// Test for false positives with items not in the filter
			let falsePositives = 0
			for (let i = numItems; i < numItems + testItems; i++) {
				if (filter.mightContain(`item-${i}`)) {
					falsePositives++
				}
			}

			const falsePositiveRate = falsePositives / testItems
			expect(falsePositiveRate).toBeLessThan(0.03)
		})

		it('should never have false negatives', () => {
			const items: string[] = []

			for (let i = 0; i < 1000; i++) {
				const item = `item-${i}`
				items.push(item)
				filter.add(item)
			}

			// Every added item must be found
			for (const item of items) {
				expect(filter.mightContain(item)).toBe(true)
			}
		})
	})

	describe('resize', () => {
		it('should auto-resize when load factor is high', () => {
			const initialCapacity = filter.getCapacity()

			// Fill up the filter beyond load factor
			for (let i = 0; i < initialCapacity; i++) {
				filter.add(`item-${i}`)
			}

			// Capacity should have increased
			expect(filter.getCapacity()).toBeGreaterThan(initialCapacity)
		})

		it('should maintain correctness after resize', () => {
			const items: string[] = []

			// Add enough items to trigger resize
			for (let i = 0; i < 2000; i++) {
				const item = `item-${i}`
				items.push(item)
				filter.add(item)
			}

			// All items should still be findable
			for (const item of items) {
				expect(filter.mightContain(item)).toBe(true)
			}
		})
	})

	describe('serialization', () => {
		it('should serialize and deserialize correctly', () => {
			const items = ['a', 'b', 'c', 'd', 'e']

			for (const item of items) {
				filter.add(item)
			}

			const data = filter.serialize()
			const restored = CuckooFilter.deserialize(data)

			for (const item of items) {
				expect(restored.mightContain(item)).toBe(true)
			}

			expect(restored.getCount()).toBe(filter.getCount())
		})

		it('should throw on unsupported version', () => {
			const data = { version: 999, bucketSize: 4, fpSize: 16, numBuckets: 256, count: 0, buckets: [] as number[][] }
			expect(() => CuckooFilter.deserialize(data as any)).toThrow('Unsupported CuckooFilter version')
		})

		it('should handle empty filter serialization', () => {
			const data = filter.serialize()
			const restored = CuckooFilter.deserialize(data)

			expect(restored.getCount()).toBe(0)
			expect(restored.mightContain('anything')).toBe(false)
		})
	})

	describe('fromIds', () => {
		it('should create a filter from an array of IDs', () => {
			const ids = ['id1', 'id2', 'id3', 'id4', 'id5']
			const filter = CuckooFilter.fromIds(ids)

			for (const id of ids) {
				expect(filter.mightContain(id)).toBe(true)
			}

			expect(filter.getCount()).toBe(5)
		})

		it('should handle large ID sets', () => {
			const ids = Array.from({ length: 5000 }, (_, i) => `id-${i}`)
			const filter = CuckooFilter.fromIds(ids)

			// Sample check
			expect(filter.mightContain('id-0')).toBe(true)
			expect(filter.mightContain('id-2500')).toBe(true)
			expect(filter.mightContain('id-4999')).toBe(true)
		})
	})

	describe('clear', () => {
		it('should clear all items', () => {
			filter.add('item1')
			filter.add('item2')
			filter.add('item3')

			expect(filter.getCount()).toBe(3)

			filter.clear()

			expect(filter.getCount()).toBe(0)
			expect(filter.mightContain('item1')).toBe(false)
			expect(filter.mightContain('item2')).toBe(false)
			expect(filter.mightContain('item3')).toBe(false)
		})
	})

	describe('getLoadFactor', () => {
		it('should return correct load factor', () => {
			expect(filter.getLoadFactor()).toBe(0)

			const capacity = filter.getCapacity()
			for (let i = 0; i < capacity / 2; i++) {
				filter.add(`item-${i}`)
			}

			// Should be approximately 50% (may be less due to duplicates)
			expect(filter.getLoadFactor()).toBeGreaterThan(0.4)
			expect(filter.getLoadFactor()).toBeLessThan(0.6)
		})
	})

	describe('estimateMemoryUsage', () => {
		it('should return a positive memory estimate', () => {
			expect(filter.estimateMemoryUsage()).toBeGreaterThan(0)

			filter.add('item1')
			filter.add('item2')

			expect(filter.estimateMemoryUsage()).toBeGreaterThan(0)
		})
	})

	describe('edge cases', () => {
		it('should handle empty strings', () => {
			filter.add('')
			expect(filter.mightContain('')).toBe(true)
		})

		it('should handle very long strings', () => {
			const longString = 'a'.repeat(10000)
			filter.add(longString)
			expect(filter.mightContain(longString)).toBe(true)
		})

		it('should handle special characters', () => {
			const special = '!@#$%^&*()_+-=[]{}|;:,.<>?'
			filter.add(special)
			expect(filter.mightContain(special)).toBe(true)
		})

		it('should handle unicode', () => {
			const unicode = '你好世界🌍🎉'
			filter.add(unicode)
			expect(filter.mightContain(unicode)).toBe(true)
		})
	})
})
