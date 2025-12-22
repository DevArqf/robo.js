/**
 * Flashcore v1 (spec rev 4.3) Read Operation
 *
 * Implements the findUnique() CRUD operation.
 */

import type { NormalizedSchema, FindUniqueArgs, IncludeClause } from '../../schema/types.js'
import type { Catalog } from '../catalog.js'
import type { ChunkManager } from '../chunk.js'
import type { UniqueIndexManager } from '../../index/unique.js'
import type { IncludeContext } from '../../relation/types.js'
import { TypeSerializer } from '../../schema/serialize.js'
import { ValidationError } from '../../core/errors.js'
import { resolveInclude, hasIncludes } from '../../relation/include.js'

/**
 * Context for read operation.
 */
export interface ReadContext<T> {
	modelName: string
	schema: NormalizedSchema
	catalog: Catalog
	chunkManager: ChunkManager
	serializer: TypeSerializer
	uniqueIndexManager?: UniqueIndexManager
	namespace?: string

	// Optional include context (Phase 9)
	includeContext?: IncludeContext
}

/**
 * Execute findUnique operation.
 *
 * 1. Extract ID from where clause
 * 2. Look up catalog entry
 * 3. If not found, return null
 * 4. Load record (from chunk or segments depending on entry kind)
 * 5. Deserialize and return
 *
 * @param ctx - Read context
 * @param args - Find arguments
 * @returns Found record or null
 */
export async function executeFindUnique<T extends { id: string }>(
	ctx: ReadContext<T>,
	args: FindUniqueArgs<T>
): Promise<T | null> {
	// Validate where clause
	if (!args.where || typeof args.where !== 'object') {
		throw new ValidationError('findUnique requires a where clause')
	}

	// Extract ID from where clause (may use unique index lookup)
	const { id, hadUniqueField } = await extractIdFromWhere(args.where, ctx)

	// If no id/unique field was provided, throw
	if (!hadUniqueField) {
		throw new ValidationError('findUnique where clause must include id or a unique field')
	}

	// If unique field was used but not found, return null
	if (!id) {
		return null
	}

	// Get catalog entry to check storage type
	const entry = ctx.catalog.getEntry(id)

	if (!entry) {
		// Record doesn't exist
		return null
	}

	let record: unknown

	if (entry.kind === 'segments' && entry.segmentIds) {
		// Load segmented record
		record = await ctx.chunkManager.loadSegmentedRecord(id, entry.segmentIds)
	} else if (entry.kind === 'chunk' && entry.chunkId !== undefined) {
		// Load from chunk
		record = await ctx.chunkManager.getRecord(entry.chunkId, id)
	} else {
		// Invalid catalog entry
		return null
	}

	if (!record) {
		// Record not in storage (catalog inconsistency)
		// This shouldn't happen in normal operation
		return null
	}

	// Deserialize for return
	let deserialized = ctx.serializer.deserializeRecord(
		record as Record<string, unknown>
	) as T

	// Resolve includes (Phase 9)
	if (args.include && hasIncludes(args.include as IncludeClause) && ctx.includeContext) {
		deserialized = await resolveInclude(
			deserialized,
			args.include as IncludeClause,
			ctx.schema,
			ctx.modelName,
			ctx.includeContext
		) as T
	}

	// Apply select if specified
	if (args.select) {
		return applySelect(deserialized, args.select)
	}

	return deserialized
}

/**
 * Result from extracting ID from where clause.
 */
interface ExtractIdResult {
	id: string | null
	hadUniqueField: boolean
}

/**
 * Extract ID from a where clause.
 *
 * Supports:
 * - Direct ID lookup
 * - Primary key lookup
 * - Unique field lookups via UniqueIndexManager
 *
 * @param where - Where clause
 * @param ctx - Read context
 * @returns ID string and whether a unique field was used
 */
async function extractIdFromWhere<T>(
	where: Record<string, unknown>,
	ctx: ReadContext<T>
): Promise<ExtractIdResult> {
	const schema = ctx.schema

	// Direct ID lookup
	if ('id' in where && typeof where.id === 'string') {
		return { id: where.id, hadUniqueField: true }
	}

	// Primary key lookup (if not 'id')
	if (schema.primaryKey !== 'id' && schema.primaryKey in where) {
		const pkValue = where[schema.primaryKey]
		if (typeof pkValue === 'string') {
			return { id: pkValue, hadUniqueField: true }
		}
	}

	// Unique field lookups via UniqueIndexManager
	if (ctx.uniqueIndexManager && schema.uniqueFields.length > 0) {
		for (const field of schema.uniqueFields) {
			if (field in where) {
				const value = where[field]

				// Skip null/undefined values
				if (value === null || value === undefined) {
					continue
				}

				// Look up via unique index
				const id = await ctx.uniqueIndexManager.lookup(
					{ modelName: ctx.modelName, namespace: ctx.namespace, field },
					value
				)

				// Whether found or not, we had a unique field
				return { id, hadUniqueField: true }
			}
		}
	}

	return { id: null, hadUniqueField: false }
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
 * Check if a record exists.
 *
 * @param ctx - Read context
 * @param id - Record ID
 * @returns True if exists
 */
export async function existsById<T>(
	ctx: ReadContext<T>,
	id: string
): Promise<boolean> {
	return ctx.catalog.has(id)
}
