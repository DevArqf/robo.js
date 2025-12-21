/**
 * Flashcore v4.3 Delete Operation
 *
 * Implements the delete() CRUD operation.
 */

import type { NormalizedSchema, DeleteArgs, ModelHooks } from '../../schema/types.js'
import type { Catalog } from '../catalog.js'
import type { ChunkManager } from '../chunk.js'
import type { CatalogLockManager, ChunkLockManager } from '../locks.js'
import type { UniqueIndexManager } from '../../index/unique.js'
import { TypeSerializer } from '../../schema/serialize.js'
import { executeBeforeDelete, executeAfterDelete } from '../hooks.js'
import { ValidationError } from '../../core/errors.js'

/**
 * Context for delete operation.
 */
export interface DeleteContext<T> {
	modelName: string
	modelKey: string
	schema: NormalizedSchema
	catalog: Catalog
	chunkManager: ChunkManager
	catalogLock: CatalogLockManager
	chunkLock: ChunkLockManager
	serializer: TypeSerializer
	hooks?: ModelHooks<T>
	uniqueIndexManager?: UniqueIndexManager
	namespace?: string

	// Callback to persist catalog after modification
	persistCatalog: () => Promise<void>
}

/**
 * Execute delete operation.
 *
 * 1. Extract ID from where clause
 * 2. Find record (must exist)
 * 3. Execute beforeDelete hook
 * 4. Acquire catalog lock
 * 5. Acquire chunk lock
 * 6. Remove from chunk, remove from catalog
 * 7. Release locks
 * 8. Execute afterDelete hook
 * 9. Return deleted record (or null if not found)
 *
 * @param ctx - Delete context
 * @param args - Delete arguments
 * @returns Deleted record or null
 */
export async function executeDelete<T extends { id: string }>(
	ctx: DeleteContext<T>,
	args: DeleteArgs<T>
): Promise<T | null> {
	// Validate where clause
	if (!args.where || typeof args.where !== 'object') {
		throw new ValidationError('delete requires a where clause')
	}

	// Extract ID from where clause
	const id = extractIdFromWhere(args.where)

	if (!id) {
		throw new ValidationError('delete where clause must include id')
	}

	// Check if record exists
	const chunkId = ctx.catalog.getChunkFor(id)

	if (chunkId === null) {
		// Record doesn't exist - return null
		return null
	}

	// Acquire catalog lock for the delete operation
	const result = await ctx.catalogLock.withCatalogLock(ctx.modelKey, async () => {
		// Re-check after acquiring lock
		const currentChunkId = ctx.catalog.getChunkFor(id)
		if (currentChunkId === null) {
			// Record was deleted between check and lock
			return null
		}

		// Acquire chunk lock
		return ctx.chunkLock.withChunkLock(ctx.modelKey, currentChunkId, async () => {
			// Load existing record
			const existingRaw = await ctx.chunkManager.getRecord(currentChunkId, id)

			if (!existingRaw) {
				// Record not in chunk (catalog inconsistency)
				return null
			}

			// Deserialize existing record
			const existing = ctx.serializer.deserializeRecord(
				existingRaw as Record<string, unknown>
			) as T

			// Execute beforeDelete hook
			await executeBeforeDelete(ctx.hooks, existing)

			// Remove from chunk
			await ctx.chunkManager.deleteRecord(currentChunkId, id)

			// Remove from catalog
			ctx.catalog.removeEntry(id)

			// Persist catalog
			await ctx.persistCatalog()

			// Release unique constraints
			if (ctx.uniqueIndexManager && ctx.schema.uniqueFields.length > 0) {
				for (const field of ctx.schema.uniqueFields) {
					const value = (existing as Record<string, unknown>)[field]

					// Skip null/undefined values
					if (value === null || value === undefined) {
						continue
					}

					try {
						await ctx.uniqueIndexManager.release(
							{ modelName: ctx.modelName, namespace: ctx.namespace, field },
							value
						)
					} catch {
						// Ignore release errors - record is already deleted
					}
				}
			}

			return existing
		})
	})

	if (!result) {
		return null
	}

	// Execute afterDelete hook
	await executeAfterDelete(ctx.hooks, result)

	return result
}

/**
 * Extract ID from where clause.
 */
function extractIdFromWhere(where: Record<string, unknown>): string | null {
	if ('id' in where && typeof where.id === 'string') {
		return where.id
	}
	return null
}
