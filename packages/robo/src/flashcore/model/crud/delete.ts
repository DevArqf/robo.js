/**
 * Flashcore v1 (spec rev 4.3) Delete Operation
 *
 * Implements the delete() CRUD operation with WAL protection.
 */

import type { NormalizedSchema, DeleteArgs, ModelHooks } from '../../schema/types.js'
import type { Catalog } from '../catalog.js'
import type { ChunkManager } from '../chunk.js'
import type { CatalogLockManager, ChunkLockManager } from '../locks.js'
import type { UniqueIndexManager } from '../../index/unique.js'
import type { WriteAheadLog } from '../../wal/manager.js'
import type { UniqueChange } from '../../wal/deltas.js'
import { TypeSerializer } from '../../schema/serialize.js'
import { executeBeforeDelete, executeAfterDelete } from '../hooks.js'
import { ValidationError } from '../../core/errors.js'
import { buildDeleteDeltas, buildDeleteSegmentedDeltas } from '../../wal/deltas.js'
import { buildModelKey, buildUniqueKey } from '../../core/keys.js'
import { encodeUniqueValue } from '../../core/encoding.js'
import { splitRecordToSegments } from '../segments.js'

/**
 * Index update callbacks for derived writes (Phase 6).
 */
export interface IndexUpdateCallbacks {
	/** Remove record ID from filter */
	removeFromFilter?: (id: string) => void
	/** Remove entry from sorted index */
	removeFromSortedIndex?: (field: string, value: unknown, id: string) => void
	/** Mark indexes as dirty for persistence */
	markDirty?: () => void
}

/**
 * Cascade callbacks for Phase 9.
 */
export interface CascadeCallbacks {
	/**
	 * Check restrict constraints before delete.
	 * Throws FlashcoreError if delete should be blocked.
	 */
	checkRestrict?: (record: { id: string }) => Promise<void>

	/**
	 * Execute cascade operations for the delete.
	 * This handles cascade deletes, setNull, and junction cleanup.
	 */
	executeCascades?: (record: { id: string }) => Promise<void>
}

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

	// Optional WAL manager for crash safety
	wal?: WriteAheadLog

	// Optional override for building full chunk keys (for WAL deltas)
	getChunkKey?: (chunkId: number) => string

	// Optional index update callbacks (Phase 6)
	indexCallbacks?: IndexUpdateCallbacks

	// Optional cascade callbacks (Phase 9)
	cascadeCallbacks?: CascadeCallbacks
}

/**
 * Execute delete operation.
 *
 * 1. Extract ID from where clause
 * 2. Find record (must exist)
 * 3. Execute beforeDelete hook
 * 4. Begin WAL entry (if enabled)
 * 5. Acquire catalog lock
 * 6. Acquire chunk lock
 * 7. Remove from chunk, remove from catalog (mark WAL authoritative)
 * 8. Release locks
 * 9. Complete WAL
 * 10. Execute afterDelete hook
 * 11. Return deleted record (or null if not found)
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

	// Check if record exists and get storage info
	const entry = ctx.catalog.getEntry(id)

	if (!entry) {
		// Record doesn't exist - return null
		return null
	}

	// Track storage type
	const isSegmented = entry.kind === 'segments'
	const chunkId = entry.kind === 'chunk' ? entry.chunkId ?? 0 : 0

	// Track WAL entry ID for cleanup
	let walId: string | null = null
	const walEnabled = ctx.wal?.isEnabled() ?? false

	// Helper to perform delete operation
	const performDelete = async () => {
		// Re-check after acquiring lock
		const currentEntry = ctx.catalog.getEntry(id)
		if (!currentEntry) {
			// Record was deleted between check and lock
			return null
		}

		// Load existing record based on storage type
		let existingRaw: unknown

		if (currentEntry.kind === 'segments' && currentEntry.segmentIds) {
			existingRaw = await ctx.chunkManager.loadSegmentedRecord(id, currentEntry.segmentIds)
		} else if (currentEntry.kind === 'chunk' && currentEntry.chunkId !== undefined) {
			existingRaw = await ctx.chunkManager.getRecord(currentEntry.chunkId, id)
		} else {
			return null
		}

		if (!existingRaw) {
			// Record not in storage (catalog inconsistency)
			return null
		}

		// Deserialize existing record
		const existing = ctx.serializer.deserializeRecord(
			existingRaw as Record<string, unknown>
		) as T

		// Check restrict constraints before proceeding (Phase 9)
		if (ctx.cascadeCallbacks?.checkRestrict) {
			await ctx.cascadeCallbacks.checkRestrict(existing)
		}

		// Execute beforeDelete hook
		await executeBeforeDelete(ctx.hooks, existing)

		// Build unique constraint keys for WAL deltas
		const uniqueKeys: UniqueChange[] = []
		if (ctx.schema.uniqueFields.length > 0) {
			for (const field of ctx.schema.uniqueFields) {
				const value = (existing as Record<string, unknown>)[field]
				if (value !== null && value !== undefined) {
					const encodedValue = encodeUniqueValue(value)
					const key = buildUniqueKey(ctx.modelName, field, encodedValue, ctx.namespace)
					uniqueKeys.push({ key, id })
				}
			}
		}

		// Get full chunk key for WAL (only if not segmented)
		const currentChunkId = currentEntry.kind === 'chunk' ? currentEntry.chunkId ?? 0 : 0
		const fullChunkKey =
			currentEntry.kind === 'chunk'
				? ctx.getChunkKey
					? ctx.getChunkKey(currentChunkId)
					: buildModelKey(ctx.modelName, `chunk:${currentChunkId}`, ctx.namespace)
				: '' // Segmented records don't use chunk keys

		// Begin WAL entry (if enabled) - include full record for rollback
		if (walEnabled && ctx.wal) {
			const deltas = currentEntry.kind === 'segments' && currentEntry.segmentIds
				? (() => {
					const { segmentIds, segments } = splitRecordToSegments(
						ctx.chunkManager,
						id,
						existingRaw,
						currentEntry.segmentIds.length
					)
					return buildDeleteSegmentedDeltas(id, segmentIds, segments, uniqueKeys)
				})()
				: buildDeleteDeltas(fullChunkKey, currentChunkId, id, existingRaw, uniqueKeys)

			walId = await ctx.wal.begin({
				model: ctx.modelName,
				namespace: ctx.namespace,
				op: 'delete',
				auth: deltas.auth,
				undo: deltas.undo,
				derived: deltas.derived
			})
		}

		// Remove from storage based on type
		if (currentEntry.kind === 'segments' && currentEntry.segmentIds) {
			// Delete all segments
			await ctx.chunkManager.deleteSegmentedRecord(id, currentEntry.segmentIds)
		} else if (currentEntry.kind === 'chunk' && currentEntry.chunkId !== undefined) {
			// Remove from chunk
			await ctx.chunkManager.deleteRecord(currentEntry.chunkId, id)
		}

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

		// Mark WAL as authoritative (all writes complete)
		if (walId && ctx.wal) {
			await ctx.wal.markPhase(walId, 'authoritative')
		}

		// Derived writes: update filter and sorted indexes (Phase 6)
		if (ctx.indexCallbacks) {
			// Remove from filter
			if (ctx.indexCallbacks.removeFromFilter) {
				ctx.indexCallbacks.removeFromFilter(id)
			}

			// Remove from sorted indexes for indexed fields
			if (ctx.indexCallbacks.removeFromSortedIndex) {
				for (const field of ctx.schema.indexedFields) {
					const value = (existing as Record<string, unknown>)[field]
					if (value !== null && value !== undefined) {
						ctx.indexCallbacks.removeFromSortedIndex(field, value, id)
					}
				}
			}

			// Mark indexes as dirty for persistence
			if (ctx.indexCallbacks.markDirty) {
				ctx.indexCallbacks.markDirty()
			}
		}

		// Mark derived writes complete
		if (walId && ctx.wal) {
			await ctx.wal.markPhase(walId, 'derived')
		}

		// Execute cascade operations (Phase 9)
		// This handles cascade deletes, setNull, and junction cleanup
		if (ctx.cascadeCallbacks?.executeCascades) {
			await ctx.cascadeCallbacks.executeCascades(existing)
		}

		return existing
	}

	// Execute delete with appropriate locking
	let result: T | null

	// Use catalog lock for the operation
	result = await ctx.catalogLock.withCatalogLock(ctx.modelKey, async () => {
		if (isSegmented) {
			// Segmented records don't use chunk lock
			return performDelete()
		} else {
			// Use chunk lock for regular records
			return ctx.chunkLock.withChunkLock(ctx.modelKey, chunkId, performDelete)
		}
	})

	if (!result) {
		return null
	}

	// Complete WAL entry (operation successful)
	if (walId && ctx.wal) {
		await ctx.wal.complete(walId)
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
