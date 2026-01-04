/**
 * Flashcore v1 Query Planner (Phase 6, spec rev 4.3)
 *
 * Analyzes queries and selects optimal execution strategies using available indexes.
 *
 * Key features:
 * - Analyzes where clause for index opportunities
 * - Chooses best index for orderBy + range queries
 * - Falls back to full scan when no index available
 * - Estimates query costs for comparison
 */

import type { CuckooFilter } from '../index/filter.js'
import type { SortedIndex, RangeOptions } from '../index/sorted.js'

/**
 * Available indexes for query planning.
 */
export interface AvailableIndexes {
	/** Cuckoo filter for fast negative lookups */
	filter?: CuckooFilter
	/** Sorted indexes by field name */
	sortedIndexes: Map<string, SortedIndex>
}

/**
 * Query arguments for planning.
 */
export interface QueryArgs {
	/** Where clause for filtering */
	where?: WhereInput
	/** Order by clause */
	orderBy?: OrderByInput | OrderByInput[]
	/** Skip count for pagination */
	skip?: number
	/** Take count for pagination */
	take?: number
}

/**
 * Where clause input.
 */
export interface WhereInput {
	[field: string]:
		| unknown
		| { equals?: unknown }
		| { gt?: unknown; gte?: unknown; lt?: unknown; lte?: unknown }
		| { in?: unknown[] }
		| { contains?: string }
}

/**
 * Order by input.
 */
export interface OrderByInput {
	[field: string]: 'asc' | 'desc'
}

/**
 * Query execution plan.
 */
export interface QueryPlan {
	/** Strategy type */
	type: 'full-scan' | 'index-scan' | 'index-range' | 'filter-check'
	/** Estimated cost (lower is better) */
	estimatedCost: number
	/** Index to use (if applicable) */
	indexField?: string
	/** Range options for index scan */
	rangeOptions?: RangeOptions
	/** Whether to use filter for pre-check */
	useFilter: boolean
	/** Whether index provides ordering (no in-memory sort needed) */
	indexProvidesOrder: boolean
	/** Fields that need post-filter (after index scan) */
	postFilterFields: string[]
	/** Description for debugging */
	description: string
}

/**
 * Query cost estimation factors.
 */
const COST_FACTORS = {
	/** Cost per record in full scan */
	FULL_SCAN_PER_RECORD: 1.0,
	/** Cost per record in index lookup */
	INDEX_LOOKUP_PER_RECORD: 0.1,
	/** Base cost for using an index */
	INDEX_BASE_COST: 10,
	/** Cost multiplier for in-memory sort */
	IN_MEMORY_SORT: 0.3,
	/** Cost multiplier for post-filter */
	POST_FILTER_PER_FIELD: 0.2,
	/** Base cost for filter check */
	FILTER_CHECK_COST: 0.01
}

/**
 * Query Planner.
 *
 * Analyzes queries and produces execution plans using available indexes.
 */
export class QueryPlanner {
	private totalRecords: number

	constructor(totalRecords: number) {
		this.totalRecords = totalRecords
	}

	/**
	 * Create an execution plan for a query.
	 *
	 * @param args - Query arguments
	 * @param indexes - Available indexes
	 * @returns Optimal query plan
	 */
	plan(args: QueryArgs, indexes: AvailableIndexes): QueryPlan {
		const candidates: QueryPlan[] = []

		// Always consider full scan as baseline
		candidates.push(this.planFullScan(args))

		// Check for index opportunities
		if (indexes.sortedIndexes.size > 0) {
			// Check orderBy for index opportunity
			const orderByPlan = this.planOrderByIndex(args, indexes)
			if (orderByPlan) {
				candidates.push(orderByPlan)
			}

			// Check where clause for range index opportunity
			const rangePlan = this.planRangeIndex(args, indexes)
			if (rangePlan) {
				candidates.push(rangePlan)
			}

			// Check where clause for equality index opportunity
			const equalityPlan = this.planEqualityIndex(args, indexes)
			if (equalityPlan) {
				candidates.push(equalityPlan)
			}
		}

		// Add filter pre-check opportunity
		if (indexes.filter && args.where) {
			const filterPlan = this.planFilterCheck(args, indexes)
			if (filterPlan) {
				candidates.push(filterPlan)
			}
		}

		// Choose lowest cost plan
		candidates.sort((a, b) => a.estimatedCost - b.estimatedCost)
		return candidates[0]
	}

	/**
	 * Check if a plan uses an index.
	 */
	usesIndex(plan: QueryPlan): boolean {
		return plan.type === 'index-scan' || plan.type === 'index-range'
	}

	/**
	 * Check if plan requires post-filtering.
	 */
	requiresPostFilter(plan: QueryPlan): boolean {
		return plan.postFilterFields.length > 0
	}

	// ========================================================================
	// Plan Generators
	// ========================================================================

	/**
	 * Plan a full table scan.
	 */
	private planFullScan(args: QueryArgs): QueryPlan {
		const needsSort = !!args.orderBy
		const whereFields = args.where ? Object.keys(args.where).filter((k) => k !== 'AND' && k !== 'OR') : []

		let cost = this.totalRecords * COST_FACTORS.FULL_SCAN_PER_RECORD
		if (needsSort) {
			cost += this.totalRecords * COST_FACTORS.IN_MEMORY_SORT
		}
		cost += whereFields.length * this.totalRecords * COST_FACTORS.POST_FILTER_PER_FIELD

		return {
			type: 'full-scan',
			estimatedCost: cost,
			useFilter: false,
			indexProvidesOrder: false,
			postFilterFields: whereFields,
			description: `Full scan (${this.totalRecords} records)${needsSort ? ' + sort' : ''}`
		}
	}

	/**
	 * Plan using sorted index for orderBy.
	 */
	private planOrderByIndex(args: QueryArgs, indexes: AvailableIndexes): QueryPlan | null {
		if (!args.orderBy) {
			return null
		}

		// Handle single orderBy
		const orderByItems = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy]
		if (orderByItems.length !== 1) {
			// Multi-field orderBy not supported by single index
			return null
		}

		const orderByEntry = Object.entries(orderByItems[0])[0]
		if (!orderByEntry) {
			return null
		}

		const [field, direction] = orderByEntry
		const index = indexes.sortedIndexes.get(field)

		if (!index) {
			return null
		}

		// Index provides ordering - no in-memory sort needed
		const whereFields = args.where ? Object.keys(args.where).filter((k) => k !== 'AND' && k !== 'OR' && k !== field) : []

		let cost = COST_FACTORS.INDEX_BASE_COST
		cost += this.totalRecords * COST_FACTORS.INDEX_LOOKUP_PER_RECORD
		cost += whereFields.length * this.totalRecords * COST_FACTORS.POST_FILTER_PER_FIELD

		const rangeOptions: RangeOptions = {
			order: direction,
			limit: args.take ? args.take + (args.skip ?? 0) : undefined
		}

		return {
			type: 'index-scan',
			estimatedCost: cost,
			indexField: field,
			rangeOptions,
			useFilter: false,
			indexProvidesOrder: true,
			postFilterFields: whereFields,
			description: `Index scan on '${field}' (${direction})`
		}
	}

	/**
	 * Plan using sorted index for range query.
	 */
	private planRangeIndex(args: QueryArgs, indexes: AvailableIndexes): QueryPlan | null {
		if (!args.where) {
			return null
		}

		// Look for range conditions in where clause
		for (const [field, condition] of Object.entries(args.where)) {
			if (field === 'AND' || field === 'OR') {
				continue
			}

			if (!this.isRangeCondition(condition)) {
				continue
			}

			const index = indexes.sortedIndexes.get(field)
			if (!index) {
				continue
			}

			const rangeOpts = this.extractRangeOptions(condition)
			const otherFields = Object.keys(args.where).filter((k) => k !== field && k !== 'AND' && k !== 'OR')

			// Estimate selectivity (rough approximation)
			const selectivity = this.estimateRangeSelectivity(rangeOpts)
			const expectedRecords = Math.ceil(this.totalRecords * selectivity)

			let cost = COST_FACTORS.INDEX_BASE_COST
			cost += expectedRecords * COST_FACTORS.INDEX_LOOKUP_PER_RECORD
			cost += otherFields.length * expectedRecords * COST_FACTORS.POST_FILTER_PER_FIELD

			// Add sort cost if orderBy on different field
			const needsSort = args.orderBy && !this.orderByMatchesField(args.orderBy, field)
			if (needsSort) {
				cost += expectedRecords * COST_FACTORS.IN_MEMORY_SORT
			}

			// Check if orderBy matches index field and direction
			let indexProvidesOrder = false
			if (args.orderBy) {
				const orderByItems = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy]
				if (orderByItems.length === 1) {
					const [orderField, direction] = Object.entries(orderByItems[0])[0]
					if (orderField === field) {
						rangeOpts.order = direction as 'asc' | 'desc'
						indexProvidesOrder = true
					}
				}
			}

			return {
				type: 'index-range',
				estimatedCost: cost,
				indexField: field,
				rangeOptions: rangeOpts,
				useFilter: false,
				indexProvidesOrder,
				postFilterFields: otherFields,
				description: `Range index on '${field}' (~${Math.round(selectivity * 100)}% selectivity)`
			}
		}

		return null
	}

	/**
	 * Plan using sorted index for equality lookup.
	 */
	private planEqualityIndex(args: QueryArgs, indexes: AvailableIndexes): QueryPlan | null {
		if (!args.where) {
			return null
		}

		// Look for equality conditions
		for (const [field, condition] of Object.entries(args.where)) {
			if (field === 'AND' || field === 'OR') {
				continue
			}

			if (!this.isEqualityCondition(condition)) {
				continue
			}

			const index = indexes.sortedIndexes.get(field)
			if (!index) {
				continue
			}

			const value = this.extractEqualityValue(condition)
			const otherFields = Object.keys(args.where).filter((k) => k !== field && k !== 'AND' && k !== 'OR')

			// Equality is typically very selective
			const expectedRecords = Math.max(1, Math.ceil(this.totalRecords * 0.01))

			let cost = COST_FACTORS.INDEX_BASE_COST
			cost += expectedRecords * COST_FACTORS.INDEX_LOOKUP_PER_RECORD
			cost += otherFields.length * expectedRecords * COST_FACTORS.POST_FILTER_PER_FIELD

			const needsSort = !!args.orderBy
			if (needsSort) {
				cost += expectedRecords * COST_FACTORS.IN_MEMORY_SORT
			}

			// Use range with gte/lte for equality
			const rangeOpts: RangeOptions = {
				gte: value,
				lte: value
			}

			return {
				type: 'index-range',
				estimatedCost: cost,
				indexField: field,
				rangeOptions: rangeOpts,
				useFilter: false,
				indexProvidesOrder: false,
				postFilterFields: otherFields,
				description: `Equality index on '${field}'`
			}
		}

		return null
	}

	/**
	 * Plan using filter for early rejection.
	 */
	private planFilterCheck(args: QueryArgs, indexes: AvailableIndexes): QueryPlan | null {
		if (!indexes.filter || !args.where) {
			return null
		}

		// Filter is useful when checking specific ID existence
		if (!('id' in args.where)) {
			return null
		}

		const idCondition = args.where.id
		if (!this.isEqualityCondition(idCondition)) {
			return null
		}

		// Filter check is O(1) and can reject non-existent records immediately
		return {
			type: 'filter-check',
			estimatedCost: COST_FACTORS.FILTER_CHECK_COST,
			useFilter: true,
			indexProvidesOrder: false,
			postFilterFields: [],
			description: 'Filter pre-check for ID lookup'
		}
	}

	// ========================================================================
	// Helpers
	// ========================================================================

	private isRangeCondition(condition: unknown): boolean {
		if (!condition || typeof condition !== 'object') {
			return false
		}
		const cond = condition as Record<string, unknown>
		return 'gt' in cond || 'gte' in cond || 'lt' in cond || 'lte' in cond
	}

	private isEqualityCondition(condition: unknown): boolean {
		if (condition === null || condition === undefined) {
			return false
		}
		if (typeof condition !== 'object') {
			return true // Direct value
		}
		const cond = condition as Record<string, unknown>
		return 'equals' in cond
	}

	private extractRangeOptions(condition: unknown): RangeOptions {
		const cond = condition as Record<string, unknown>
		return {
			gt: cond.gt as unknown,
			gte: cond.gte as unknown,
			lt: cond.lt as unknown,
			lte: cond.lte as unknown
		}
	}

	private extractEqualityValue(condition: unknown): unknown {
		if (typeof condition !== 'object' || condition === null) {
			return condition
		}
		const cond = condition as Record<string, unknown>
		return cond.equals
	}

	private estimateRangeSelectivity(opts: RangeOptions): number {
		// Very rough estimation
		// Open-ended ranges: 50%
		// Bounded ranges: 20%
		const hasLower = opts.gt !== undefined || opts.gte !== undefined
		const hasUpper = opts.lt !== undefined || opts.lte !== undefined

		if (hasLower && hasUpper) {
			return 0.2
		}
		return 0.5
	}

	private orderByMatchesField(orderBy: OrderByInput | OrderByInput[], field: string): boolean {
		const items = Array.isArray(orderBy) ? orderBy : [orderBy]
		if (items.length !== 1) {
			return false
		}
		return field in items[0]
	}
}

/**
 * Execute a query plan against sorted index.
 *
 * @param plan - Query plan
 * @param indexes - Available indexes
 * @returns Record IDs from index (or null if full scan needed)
 */
export function executeIndexPlan(plan: QueryPlan, indexes: AvailableIndexes): string[] | null {
	if (plan.type === 'full-scan') {
		return null // Caller should do full scan
	}

	if (plan.type === 'filter-check') {
		return null // Filter is a pre-check, not a full answer
	}

	if (!plan.indexField || !plan.rangeOptions) {
		return null
	}

	const index = indexes.sortedIndexes.get(plan.indexField)
	if (!index) {
		return null
	}

	return index.range(plan.rangeOptions)
}

/**
 * Check if a record might exist using filter.
 *
 * @param id - Record ID to check
 * @param filter - Cuckoo filter
 * @returns true if might exist, false if definitely doesn't
 */
export function filterMightContain(id: string, filter: CuckooFilter | undefined): boolean {
	if (!filter) {
		return true // No filter = assume exists
	}
	return filter.mightContain(id)
}
