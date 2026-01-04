/**
 * Phase 6: QueryPlanner Tests
 *
 * Tests for query planning and index selection.
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { QueryPlanner, executeIndexPlan, filterMightContain } from '../../../src/flashcore/query/planner.js'
import { CuckooFilter } from '../../../src/flashcore/index/filter.js'
import { SortedIndex } from '../../../src/flashcore/index/sorted.js'
import type { AvailableIndexes, QueryArgs } from '../../../src/flashcore/query/planner.js'

describe('QueryPlanner', () => {
	let planner: QueryPlanner
	let indexes: AvailableIndexes

	beforeEach(() => {
		planner = new QueryPlanner(1000) // 1000 records
		indexes = {
			sortedIndexes: new Map()
		}
	})

	describe('plan selection', () => {
		it('should choose full scan when no indexes available', () => {
			const args: QueryArgs = {
				where: { name: 'Alice' }
			}

			const plan = planner.plan(args, indexes)

			expect(plan.type).toBe('full-scan')
			expect(plan.useFilter).toBe(false)
		})

		it('should choose full scan for empty query', () => {
			const plan = planner.plan({}, indexes)

			expect(plan.type).toBe('full-scan')
		})

		it('should choose index scan for orderBy with matching index', () => {
			const createdAtIndex = new SortedIndex('createdAt')
			indexes.sortedIndexes.set('createdAt', createdAtIndex)

			const args: QueryArgs = {
				orderBy: { createdAt: 'desc' }
			}

			const plan = planner.plan(args, indexes)

			expect(plan.type).toBe('index-scan')
			expect(plan.indexField).toBe('createdAt')
			expect(plan.indexProvidesOrder).toBe(true)
		})

		it('should choose range index for range query', () => {
			const scoreIndex = new SortedIndex('score')
			indexes.sortedIndexes.set('score', scoreIndex)

			const args: QueryArgs = {
				where: { score: { gte: 100, lte: 200 } }
			}

			const plan = planner.plan(args, indexes)

			expect(plan.type).toBe('index-range')
			expect(plan.indexField).toBe('score')
			expect(plan.rangeOptions?.gte).toBe(100)
			expect(plan.rangeOptions?.lte).toBe(200)
		})

		it('should choose equality index for equality query', () => {
			const statusIndex = new SortedIndex('status')
			indexes.sortedIndexes.set('status', statusIndex)

			const args: QueryArgs = {
				where: { status: { equals: 'active' } }
			}

			const plan = planner.plan(args, indexes)

			expect(plan.type).toBe('index-range')
			expect(plan.indexField).toBe('status')
		})

		it('should handle direct value as equality', () => {
			const statusIndex = new SortedIndex('status')
			indexes.sortedIndexes.set('status', statusIndex)

			const args: QueryArgs = {
				where: { status: 'active' }
			}

			const plan = planner.plan(args, indexes)

			expect(plan.type).toBe('index-range')
			expect(plan.indexField).toBe('status')
		})

		it('should use filter check for id lookup', () => {
			const filter = new CuckooFilter()
			filter.add('id123')
			indexes.filter = filter

			const args: QueryArgs = {
				where: { id: 'id123' }
			}

			const plan = planner.plan(args, indexes)

			expect(plan.type).toBe('filter-check')
			expect(plan.useFilter).toBe(true)
		})
	})

	describe('cost estimation', () => {
		it('should prefer index scan over full scan', () => {
			const createdAtIndex = new SortedIndex('createdAt')
			indexes.sortedIndexes.set('createdAt', createdAtIndex)

			const args: QueryArgs = {
				orderBy: { createdAt: 'desc' }
			}

			const plan = planner.plan(args, indexes)
			const fullScanPlan = planner.plan({}, { sortedIndexes: new Map() })

			// Index plan should have lower cost
			expect(plan.estimatedCost).toBeLessThan(fullScanPlan.estimatedCost)
		})

		it('should prefer range index for selective range queries', () => {
			const scoreIndex = new SortedIndex('score')
			indexes.sortedIndexes.set('score', scoreIndex)

			const args: QueryArgs = {
				where: { score: { gte: 90, lte: 100 } }
			}

			const plan = planner.plan(args, indexes)
			const fullScanPlan = planner.plan(args, { sortedIndexes: new Map() })

			expect(plan.estimatedCost).toBeLessThan(fullScanPlan.estimatedCost)
		})

		it('should consider post-filter cost', () => {
			const statusIndex = new SortedIndex('status')
			indexes.sortedIndexes.set('status', statusIndex)

			// Query with indexed field + additional filter
			const args: QueryArgs = {
				where: {
					status: 'active',
					name: { contains: 'test' }
				}
			}

			const plan = planner.plan(args, indexes)

			expect(plan.postFilterFields).toContain('name')
		})
	})

	describe('plan properties', () => {
		it('should track post-filter fields correctly', () => {
			const statusIndex = new SortedIndex('status')
			indexes.sortedIndexes.set('status', statusIndex)

			const args: QueryArgs = {
				where: {
					status: 'active',
					name: 'Alice',
					age: { gte: 21 }
				}
			}

			const plan = planner.plan(args, indexes)

			expect(plan.postFilterFields).toContain('name')
			expect(plan.postFilterFields).toContain('age')
			expect(plan.postFilterFields).not.toContain('status')
		})

		it('should indicate when index provides ordering', () => {
			const scoreIndex = new SortedIndex('score')
			indexes.sortedIndexes.set('score', scoreIndex)

			// Range on score + order by score
			const args: QueryArgs = {
				where: { score: { gte: 100 } },
				orderBy: { score: 'desc' }
			}

			const plan = planner.plan(args, indexes)

			expect(plan.indexProvidesOrder).toBe(true)
		})

		it('should indicate when in-memory sort is needed', () => {
			const scoreIndex = new SortedIndex('score')
			indexes.sortedIndexes.set('score', scoreIndex)

			// Range on score + order by different field
			const args: QueryArgs = {
				where: { score: { gte: 100 } },
				orderBy: { name: 'asc' }
			}

			const plan = planner.plan(args, indexes)

			expect(plan.indexProvidesOrder).toBe(false)
		})
	})

	describe('usesIndex', () => {
		it('should return true for index-scan', () => {
			const createdAtIndex = new SortedIndex('createdAt')
			indexes.sortedIndexes.set('createdAt', createdAtIndex)

			const plan = planner.plan({ orderBy: { createdAt: 'asc' } }, indexes)

			expect(planner.usesIndex(plan)).toBe(true)
		})

		it('should return true for index-range', () => {
			const scoreIndex = new SortedIndex('score')
			indexes.sortedIndexes.set('score', scoreIndex)

			const plan = planner.plan({ where: { score: { gte: 100 } } }, indexes)

			expect(planner.usesIndex(plan)).toBe(true)
		})

		it('should return false for full-scan', () => {
			const plan = planner.plan({}, indexes)

			expect(planner.usesIndex(plan)).toBe(false)
		})
	})

	describe('requiresPostFilter', () => {
		it('should return true when there are post-filter fields', () => {
			const statusIndex = new SortedIndex('status')
			indexes.sortedIndexes.set('status', statusIndex)

			const plan = planner.plan(
				{
					where: { status: 'active', name: 'Alice' }
				},
				indexes
			)

			expect(planner.requiresPostFilter(plan)).toBe(true)
		})

		it('should return false when index covers all filters', () => {
			const statusIndex = new SortedIndex('status')
			indexes.sortedIndexes.set('status', statusIndex)

			const plan = planner.plan(
				{
					where: { status: 'active' }
				},
				indexes
			)

			expect(planner.requiresPostFilter(plan)).toBe(false)
		})
	})
})

describe('executeIndexPlan', () => {
	it('should return null for full-scan plan', () => {
		const planner = new QueryPlanner(100)
		const indexes: AvailableIndexes = { sortedIndexes: new Map() }
		const plan = planner.plan({}, indexes)

		const result = executeIndexPlan(plan, indexes)

		expect(result).toBeNull()
	})

	it('should return IDs from sorted index for index-range plan', () => {
		const index = new SortedIndex('score')
		index.insert(50, 'id1')
		index.insert(100, 'id2')
		index.insert(150, 'id3')
		index.insert(200, 'id4')

		const indexes: AvailableIndexes = {
			sortedIndexes: new Map([['score', index]])
		}

		// Use a larger record count so index is preferred over full scan
		const planner = new QueryPlanner(10000)
		const plan = planner.plan({ where: { score: { gte: 100, lte: 150 } } }, indexes)

		expect(plan.type).toBe('index-range')

		const result = executeIndexPlan(plan, indexes)

		expect(result).not.toBeNull()
		expect(result).toContain('id2')
		expect(result).toContain('id3')
		expect(result).not.toContain('id1')
		expect(result).not.toContain('id4')
	})
})

describe('filterMightContain', () => {
	it('should return true when filter is undefined', () => {
		expect(filterMightContain('any-id', undefined)).toBe(true)
	})

	it('should return true for items in filter', () => {
		const filter = new CuckooFilter()
		filter.add('id123')

		expect(filterMightContain('id123', filter)).toBe(true)
	})

	it('should return false for items not in filter', () => {
		const filter = new CuckooFilter()
		filter.add('id123')

		expect(filterMightContain('id456', filter)).toBe(false)
	})
})
