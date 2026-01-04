/**
 * Phase 6: SortedIndex Tests
 *
 * Tests for the B+Tree sorted index.
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { SortedIndex } from '../../../src/flashcore/index/sorted.js'

describe('SortedIndex', () => {
	let index: SortedIndex

	beforeEach(() => {
		index = new SortedIndex('testField')
	})

	describe('insert/has/remove', () => {
		it('should insert and find entries', () => {
			index.insert(10, 'id1')
			expect(index.has(10, 'id1')).toBe(true)
		})

		it('should not find entries that were never inserted', () => {
			index.insert(10, 'id1')
			expect(index.has(20, 'id1')).toBe(false)
			expect(index.has(10, 'id2')).toBe(false)
		})

		it('should remove entries', () => {
			index.insert(10, 'id1')
			expect(index.has(10, 'id1')).toBe(true)

			expect(index.remove(10, 'id1')).toBe(true)
			expect(index.has(10, 'id1')).toBe(false)
		})

		it('should return false when removing non-existent entries', () => {
			expect(index.remove(10, 'nonexistent')).toBe(false)
		})

		it('should handle multiple entries with same value', () => {
			index.insert(10, 'id1')
			index.insert(10, 'id2')
			index.insert(10, 'id3')

			expect(index.has(10, 'id1')).toBe(true)
			expect(index.has(10, 'id2')).toBe(true)
			expect(index.has(10, 'id3')).toBe(true)
			expect(index.getCount()).toBe(3)
		})

		it('should skip null/undefined values', () => {
			index.insert(null, 'id1')
			index.insert(undefined, 'id2')

			expect(index.getCount()).toBe(0)
			expect(index.has(null, 'id1')).toBe(false)
			expect(index.has(undefined, 'id2')).toBe(false)
		})
	})

	describe('find', () => {
		it('should find all IDs for a specific value', () => {
			index.insert(10, 'id1')
			index.insert(10, 'id2')
			index.insert(20, 'id3')

			const ids = index.find(10)
			expect(ids).toContain('id1')
			expect(ids).toContain('id2')
			expect(ids).not.toContain('id3')
		})

		it('should return empty array for non-existent value', () => {
			index.insert(10, 'id1')
			expect(index.find(99)).toEqual([])
		})

		it('should return empty array for null/undefined', () => {
			index.insert(10, 'id1')
			expect(index.find(null)).toEqual([])
			expect(index.find(undefined)).toEqual([])
		})
	})

	describe('range queries', () => {
		beforeEach(() => {
			// Insert values 1-10
			for (let i = 1; i <= 10; i++) {
				index.insert(i, `id${i}`)
			}
		})

		it('should handle gte (greater than or equal)', () => {
			const ids = index.range({ gte: 8 })
			expect(ids).toEqual(['id8', 'id9', 'id10'])
		})

		it('should handle gt (greater than)', () => {
			const ids = index.range({ gt: 8 })
			expect(ids).toEqual(['id9', 'id10'])
		})

		it('should handle lte (less than or equal)', () => {
			const ids = index.range({ lte: 3 })
			expect(ids).toEqual(['id1', 'id2', 'id3'])
		})

		it('should handle lt (less than)', () => {
			const ids = index.range({ lt: 3 })
			expect(ids).toEqual(['id1', 'id2'])
		})

		it('should handle combined range (gte + lte)', () => {
			const ids = index.range({ gte: 3, lte: 7 })
			expect(ids).toEqual(['id3', 'id4', 'id5', 'id6', 'id7'])
		})

		it('should handle combined range (gt + lt)', () => {
			const ids = index.range({ gt: 3, lt: 7 })
			expect(ids).toEqual(['id4', 'id5', 'id6'])
		})

		it('should handle limit', () => {
			const ids = index.range({ gte: 1, limit: 3 })
			expect(ids).toEqual(['id1', 'id2', 'id3'])
		})

		it('should handle descending order', () => {
			const ids = index.range({ order: 'desc' })
			expect(ids).toEqual(['id10', 'id9', 'id8', 'id7', 'id6', 'id5', 'id4', 'id3', 'id2', 'id1'])
		})

		it('should handle descending order with limit', () => {
			const ids = index.range({ order: 'desc', limit: 3 })
			expect(ids).toEqual(['id10', 'id9', 'id8'])
		})

		it('should handle descending order with lte', () => {
			const ids = index.range({ lte: 5, order: 'desc' })
			expect(ids).toEqual(['id5', 'id4', 'id3', 'id2', 'id1'])
		})

		it('should return empty array for impossible range', () => {
			const ids = index.range({ gt: 10 })
			expect(ids).toEqual([])
		})
	})

	describe('getAll', () => {
		it('should return all IDs in ascending order', () => {
			index.insert(3, 'id3')
			index.insert(1, 'id1')
			index.insert(2, 'id2')

			const ids = index.getAll('asc')
			expect(ids).toEqual(['id1', 'id2', 'id3'])
		})

		it('should return all IDs in descending order', () => {
			index.insert(3, 'id3')
			index.insert(1, 'id1')
			index.insert(2, 'id2')

			const ids = index.getAll('desc')
			expect(ids).toEqual(['id3', 'id2', 'id1'])
		})

		it('should return empty array for empty index', () => {
			expect(index.getAll()).toEqual([])
		})
	})

	describe('stable ordering', () => {
		it('should maintain stable order by id for same values', () => {
			// Insert same value with different IDs
			index.insert(10, 'id_c')
			index.insert(10, 'id_a')
			index.insert(10, 'id_b')

			const ids = index.getAll('asc')
			// Should be sorted by id when values are equal
			expect(ids).toEqual(['id_a', 'id_b', 'id_c'])
		})

		it('should maintain order after many insertions', () => {
			// Insert in random order
			const items = [
				{ value: 5, id: 'e' },
				{ value: 3, id: 'c' },
				{ value: 1, id: 'a' },
				{ value: 4, id: 'd' },
				{ value: 2, id: 'b' }
			]

			for (const { value, id } of items) {
				index.insert(value, id)
			}

			const ids = index.getAll('asc')
			expect(ids).toEqual(['a', 'b', 'c', 'd', 'e'])
		})
	})

	describe('data types', () => {
		it('should handle string values', () => {
			index.insert('apple', 'id1')
			index.insert('banana', 'id2')
			index.insert('cherry', 'id3')

			const ids = index.getAll('asc')
			expect(ids).toEqual(['id1', 'id2', 'id3'])
		})

		it('should handle Date values', () => {
			const date1 = new Date('2024-01-01')
			const date2 = new Date('2024-06-01')
			const date3 = new Date('2024-12-01')

			index.insert(date2, 'id2')
			index.insert(date1, 'id1')
			index.insert(date3, 'id3')

			const ids = index.getAll('asc')
			expect(ids).toEqual(['id1', 'id2', 'id3'])
		})

		it('should handle boolean values', () => {
			index.insert(false, 'id1')
			index.insert(true, 'id2')

			const ids = index.getAll('asc')
			// false (0) comes before true (1)
			expect(ids).toEqual(['id1', 'id2'])
		})

		it('should handle mixed numeric values', () => {
			index.insert(1.5, 'id1')
			index.insert(1, 'id2')
			index.insert(2, 'id3')
			index.insert(-1, 'id4')

			const ids = index.getAll('asc')
			expect(ids).toEqual(['id4', 'id2', 'id1', 'id3'])
		})
	})

	describe('serialization', () => {
		it('should serialize and deserialize correctly', () => {
			index.insert(10, 'id1')
			index.insert(20, 'id2')
			index.insert(30, 'id3')

			const data = index.serialize()
			const restored = SortedIndex.deserialize(data)

			expect(restored.field).toBe('testField')
			expect(restored.getCount()).toBe(3)
			expect(restored.getAll('asc')).toEqual(['id1', 'id2', 'id3'])
		})

		it('should serialize and deserialize Date values', () => {
			const date = new Date('2024-06-15')
			index.insert(date, 'id1')

			const data = index.serialize()
			const restored = SortedIndex.deserialize(data)

			expect(restored.has(date, 'id1')).toBe(true)
		})

		it('should throw on unsupported version', () => {
			const data = { version: 999, field: 'test', entries: [] as Array<[unknown, string]> }
			expect(() => SortedIndex.deserialize(data as any)).toThrow('Unsupported SortedIndex version')
		})

		it('should handle empty index serialization', () => {
			const data = index.serialize()
			const restored = SortedIndex.deserialize(data)

			expect(restored.getCount()).toBe(0)
			expect(restored.isEmpty()).toBe(true)
		})
	})

	describe('bulkLoad', () => {
		it('should create an index from entries', () => {
			const entries = [
				{ value: 3, id: 'id3' },
				{ value: 1, id: 'id1' },
				{ value: 2, id: 'id2' }
			]

			const index = SortedIndex.bulkLoad('field', entries)

			expect(index.getCount()).toBe(3)
			expect(index.getAll('asc')).toEqual(['id1', 'id2', 'id3'])
		})

		it('should filter out null/undefined values', () => {
			const entries = [
				{ value: 1, id: 'id1' },
				{ value: null, id: 'id2' },
				{ value: undefined, id: 'id3' },
				{ value: 2, id: 'id4' }
			]

			const index = SortedIndex.bulkLoad('field', entries)

			expect(index.getCount()).toBe(2)
		})

		it('should handle large datasets', () => {
			const entries = Array.from({ length: 1000 }, (_, i) => ({
				value: Math.random() * 1000,
				id: `id${i}`
			}))

			const index = SortedIndex.bulkLoad('field', entries)

			expect(index.getCount()).toBe(1000)

			// Verify sorted order
			const ids = index.getAll('asc')
			let lastValue = -Infinity
			for (const id of ids) {
				const entry = entries.find((e) => e.id === id)!
				expect(entry.value).toBeGreaterThanOrEqual(lastValue)
				lastValue = entry.value
			}
		})
	})

	describe('clear', () => {
		it('should clear all entries', () => {
			index.insert(10, 'id1')
			index.insert(20, 'id2')
			index.insert(30, 'id3')

			expect(index.getCount()).toBe(3)

			index.clear()

			expect(index.getCount()).toBe(0)
			expect(index.isEmpty()).toBe(true)
			expect(index.getAll()).toEqual([])
		})
	})

	describe('estimateMemoryUsage', () => {
		it('should return a positive memory estimate', () => {
			expect(index.estimateMemoryUsage()).toBeGreaterThan(0)

			for (let i = 0; i < 100; i++) {
				index.insert(i, `id${i}`)
			}

			expect(index.estimateMemoryUsage()).toBeGreaterThan(100 * 50) // Rough estimate
		})
	})

	describe('edge cases', () => {
		it('should handle empty string values', () => {
			index.insert('', 'id1')
			expect(index.has('', 'id1')).toBe(true)
		})

		it('should handle zero', () => {
			index.insert(0, 'id1')
			expect(index.has(0, 'id1')).toBe(true)
		})

		it('should handle negative numbers', () => {
			index.insert(-100, 'id1')
			index.insert(-50, 'id2')
			index.insert(0, 'id3')

			const ids = index.getAll('asc')
			expect(ids).toEqual(['id1', 'id2', 'id3'])
		})

		it('should handle very large numbers', () => {
			index.insert(Number.MAX_SAFE_INTEGER, 'id1')
			index.insert(Number.MIN_SAFE_INTEGER, 'id2')

			const ids = index.getAll('asc')
			expect(ids).toEqual(['id2', 'id1'])
		})

		it('should handle many items triggering tree splits', () => {
			// Insert enough items to trigger multiple tree splits
			for (let i = 0; i < 1000; i++) {
				index.insert(i, `id${i.toString().padStart(4, '0')}`)
			}

			expect(index.getCount()).toBe(1000)

			// Verify range query still works
			const range = index.range({ gte: 100, lte: 110 })
			expect(range.length).toBe(11)
		})

		it('should handle rapid insert/remove cycles', () => {
			for (let i = 0; i < 100; i++) {
				index.insert(i, `id${i}`)
			}

			// Remove half
			for (let i = 0; i < 50; i++) {
				index.remove(i, `id${i}`)
			}

			expect(index.getCount()).toBe(50)

			// Verify remaining items
			for (let i = 50; i < 100; i++) {
				expect(index.has(i, `id${i}`)).toBe(true)
			}

			// Verify removed items
			for (let i = 0; i < 50; i++) {
				expect(index.has(i, `id${i}`)).toBe(false)
			}
		})
	})
})
