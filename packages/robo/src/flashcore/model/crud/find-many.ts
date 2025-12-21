/**
 * Flashcore v1 (spec rev 4.3) FindMany Operation
 *
 * Implements findMany(), findFirst(), and count() with filtering.
 */

import type { NormalizedSchema, FindManyArgs, FindFirstArgs, WhereClause, CountArgs } from '../../schema/types.js'
import type { Catalog } from '../catalog.js'
import type { ChunkManager } from '../chunk.js'
import type { CuckooFilter } from '../../index/filter.js'
import type { SortedIndex } from '../../index/sorted.js'
import { TypeSerializer } from '../../schema/serialize.js'
import { evaluateWhere } from '../../query/evaluate.js'
import { sortRecords } from '../../query/order.js'
import { DEFAULT_SAFETY_CONFIG } from '../../core/constants.js'
import { logger } from '../../core/logger.js'
import { QueryPlanner, executeIndexPlan, filterMightContain, type AvailableIndexes, type QueryArgs } from '../../query/planner.js'

/**
 * Context for findMany operations.
 */
export interface FindManyContext<T> {
	modelName: string
	schema: NormalizedSchema
	catalog: Catalog
	chunkManager: ChunkManager
	serializer: TypeSerializer
	safetyConfig?: {
		maxDefaultResults: number
		warnResultsThreshold: number
	}
	// Index state (Phase 6)
	filter?: CuckooFilter
	sortedIndexes?: Map<string, SortedIndex>
}

/**
 * Execute findMany operation.
 *
 * 1. Plan query using available indexes (Phase 6)
 * 2. Execute plan: index scan or full scan
 * 3. Filter records against where clause (post-filter if index used)
 * 4. Sort by orderBy (if not provided by index)
 * 5. Apply skip/take pagination
 * 6. Apply select projection
 * 7. Return results
 *
 * @param ctx - FindMany context
 * @param args - Find arguments
 * @returns Array of matching records
 */
export async function executeFindMany<T extends { id: string }>(
	ctx: FindManyContext<T>,
	args?: FindManyArgs<T>
): Promise<T[]> {
	const safetyConfig = ctx.safetyConfig ?? DEFAULT_SAFETY_CONFIG

	// Check if we have indexes available (Phase 6)
	const indexes: AvailableIndexes = {
		filter: ctx.filter,
		sortedIndexes: ctx.sortedIndexes ?? new Map()
	}
	const hasIndexes = indexes.filter || indexes.sortedIndexes.size > 0

	let records: T[]

	if (hasIndexes && args) {
		// Use query planner to determine optimal execution strategy
		const totalRecords = ctx.catalog.getCount()
		const planner = new QueryPlanner(totalRecords)

		// Convert args to QueryArgs format
		const queryArgs: QueryArgs = {
			where: args.where as QueryArgs['where'],
			orderBy: args.orderBy as QueryArgs['orderBy'],
			skip: args.skip,
			take: args.take
		}

		const plan = planner.plan(queryArgs, indexes)

		if (plan.type === 'filter-check' && args.where && 'id' in args.where) {
			// Fast path: check filter first for ID lookup
			const idCondition = args.where.id
			const id = typeof idCondition === 'string' ? idCondition :
				(typeof idCondition === 'object' && idCondition && 'equals' in idCondition) ?
					(idCondition as { equals: string }).equals : null

			if (id && !filterMightContain(id, indexes.filter)) {
				// Definitely not present - return empty
				return []
			}
		}

		if (plan.type === 'index-scan' || plan.type === 'index-range') {
			// Execute index plan to get candidate IDs
			const candidateIds = executeIndexPlan(plan, indexes)

			if (candidateIds !== null) {
				// Load only matching records
				records = await loadRecordsByIds<T>(ctx, candidateIds)

				// Apply post-filter for fields not covered by index
				if (plan.postFilterFields.length > 0 && args.where) {
					records = records.filter((record) =>
						evaluateWhere(record as Record<string, unknown>, args.where as WhereClause<Record<string, unknown>>)
					)
				}

				// Sort only if index doesn't provide ordering
				if (!plan.indexProvidesOrder && args.orderBy) {
					records = sortRecords(records, args.orderBy)
				}

				// Apply pagination
				const skip = Math.max(0, args.skip ?? 0)
				let take = args.take ?? safetyConfig.maxDefaultResults

				if (records.length > safetyConfig.warnResultsThreshold && args.take === undefined) {
					logger.warn(
						`[flashcore] findMany on '${ctx.modelName}' returned ${records.length} results. ` +
						`Consider using 'take' for pagination. Limiting to ${take}.`
					)
				}

				const paginated = records.slice(skip, skip + take)

				// Apply select projection
				if (args.select) {
					return paginated.map((record) => applySelect(record, args.select!))
				}

				return paginated
			}
		}
	}

	// Fall back to full scan
	records = await loadAllRecords<T>(ctx)

	// Filter by where clause
	let filtered: T[]
	if (args?.where) {
		filtered = records.filter((record) =>
			evaluateWhere(record as Record<string, unknown>, args.where as WhereClause<Record<string, unknown>>)
		)
	} else {
		filtered = records
	}

	// Sort by orderBy
	const sorted = sortRecords(filtered, args?.orderBy)

	// Apply pagination (negative values treated as 0)
	const skip = Math.max(0, args?.skip ?? 0)
	let take = args?.take

	// Apply default take if not specified
	if (take === undefined) {
		take = safetyConfig.maxDefaultResults

		// Warn if there are many results
		if (filtered.length > safetyConfig.warnResultsThreshold) {
			logger.warn(
				`[flashcore] findMany on '${ctx.modelName}' returned ${filtered.length} results. ` +
				`Consider using 'take' for pagination. Limiting to ${take}.`
			)
		}
	} else {
		// Negative take treated as 0
		take = Math.max(0, take)
	}

	const paginated = sorted.slice(skip, skip + take)

	// Apply select projection
	if (args?.select) {
		return paginated.map((record) => applySelect(record, args.select!))
	}

	return paginated
}

/**
 * Execute findFirst operation.
 *
 * Same as findMany but returns first result or null.
 *
 * @param ctx - FindMany context
 * @param args - Find arguments
 * @returns First matching record or null
 */
export async function executeFindFirst<T extends { id: string }>(
	ctx: FindManyContext<T>,
	args?: FindFirstArgs<T>
): Promise<T | null> {
	// Override take to 1 for efficiency
	const results = await executeFindMany(ctx, { ...args, take: 1 })
	return results[0] ?? null
}

/**
 * Execute count operation with optional filter.
 *
 * @param ctx - FindMany context
 * @param args - Count arguments (optional where clause)
 * @returns Count of matching records
 */
export async function executeCount<T extends { id: string }>(
	ctx: FindManyContext<T>,
	args?: CountArgs<T>
): Promise<number> {
	// No filter - use catalog count directly (O(1))
	if (!args?.where) {
		return ctx.catalog.getCount()
	}

	// With filter - must load and count matches
	const allRecords = await loadAllRecords<T>(ctx)
	return allRecords.filter((record) =>
		evaluateWhere(record as Record<string, unknown>, args.where as WhereClause<Record<string, unknown>>)
	).length
}

/**
 * Load all records from storage.
 *
 * Groups by chunk ID for efficient loading.
 */
async function loadAllRecords<T extends { id: string }>(
	ctx: FindManyContext<T>
): Promise<T[]> {
	const records: T[] = []

	// Get all record IDs grouped by chunk
	const chunkIds = ctx.catalog.getChunkIds()

	for (const chunkId of chunkIds) {
		// Load chunk
		const chunk = await ctx.chunkManager.loadChunk(chunkId)

		// Deserialize each record
		for (const [id, rawRecord] of Object.entries(chunk)) {
			const deserialized = ctx.serializer.deserializeRecord(
				rawRecord as Record<string, unknown>
			) as T

			// Ensure id is set
			if (!deserialized.id) {
				(deserialized as Record<string, unknown>).id = id
			}

			records.push(deserialized)
		}
	}

	return records
}

/**
 * Load specific records by their IDs.
 *
 * Groups by chunk ID for efficient batch loading.
 */
async function loadRecordsByIds<T extends { id: string }>(
	ctx: FindManyContext<T>,
	ids: string[]
): Promise<T[]> {
	const records: T[] = []

	// Group IDs by chunk for efficient loading
	const idsByChunk = new Map<number, string[]>()

	for (const id of ids) {
		const entry = ctx.catalog.getEntry(id)
		if (!entry) {
			continue // ID not in catalog
		}

		if (entry.kind === 'chunk' && entry.chunkId !== undefined) {
			const chunkIds = idsByChunk.get(entry.chunkId) ?? []
			chunkIds.push(id)
			idsByChunk.set(entry.chunkId, chunkIds)
		} else if (entry.kind === 'segments' && entry.segmentIds) {
			// Handle segmented records
			try {
				const rawRecord = await ctx.chunkManager.loadSegmentedRecord(id, entry.segmentIds)
				if (rawRecord) {
					const deserialized = ctx.serializer.deserializeRecord(
						rawRecord as Record<string, unknown>
					) as T

					if (!deserialized.id) {
						(deserialized as Record<string, unknown>).id = id
					}

					records.push(deserialized)
				}
			} catch {
				// Skip failed segment loads
			}
		}
	}

	// Load records from chunks
	for (const [chunkId, chunkRecordIds] of idsByChunk) {
		const chunk = await ctx.chunkManager.loadChunk(chunkId)

		for (const id of chunkRecordIds) {
			const rawRecord = chunk[id]
			if (!rawRecord) {
				continue // Record not in chunk (shouldn't happen if catalog is consistent)
			}

			const deserialized = ctx.serializer.deserializeRecord(
				rawRecord as Record<string, unknown>
			) as T

			if (!deserialized.id) {
				(deserialized as Record<string, unknown>).id = id
			}

			records.push(deserialized)
		}
	}

	return records
}

/**
 * Apply select clause to filter returned fields.
 *
 * @param record - Full record
 * @param select - Select clause
 * @returns Filtered record
 */
function applySelect<T>(
	record: T,
	select: Partial<Record<keyof T, boolean>>
): T {
	const recordObj = record as Record<string, unknown>
	const selectEntries = Object.entries(select)

	// If select is empty, return all fields
	if (selectEntries.length === 0) {
		return record
	}

	const result: Partial<T> = {}

	for (const [key, include] of selectEntries) {
		if (include && key in recordObj) {
			(result as Record<string, unknown>)[key] = recordObj[key]
		}
	}

	// Always include id
	if ('id' in recordObj) {
		(result as Record<string, unknown>).id = recordObj.id
	}

	return result as T
}

/**
 * Async generator for streaming findMany results.
 *
 * Yields records one by one for memory-efficient processing.
 *
 * @param ctx - FindMany context
 * @param args - Find arguments
 */
export async function* executeFindManyStream<T extends { id: string }>(
	ctx: FindManyContext<T>,
	args?: FindManyArgs<T>
): AsyncGenerator<T, void, undefined> {
	const safetyConfig = ctx.safetyConfig ?? DEFAULT_SAFETY_CONFIG

	// For streaming, we still need to apply ordering
	// So we load all, filter, sort first, then stream
	const allRecords = await loadAllRecords<T>(ctx)

	// Filter
	let filtered: T[]
	if (args?.where) {
		filtered = allRecords.filter((record) =>
			evaluateWhere(record as Record<string, unknown>, args.where as WhereClause<Record<string, unknown>>)
		)
	} else {
		filtered = allRecords
	}

	// Sort
	const sorted = sortRecords(filtered, args?.orderBy)

	// Pagination (negative values treated as 0)
	const skip = Math.max(0, args?.skip ?? 0)
	const take = Math.max(0, args?.take ?? safetyConfig.maxDefaultResults)

	let count = 0
	for (let i = skip; i < sorted.length && count < take; i++, count++) {
		let record = sorted[i]

		// Apply select
		if (args?.select) {
			record = applySelect(record, args.select)
		}

		yield record
	}
}
