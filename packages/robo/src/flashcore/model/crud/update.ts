/**
 * Flashcore v1 (spec rev 4.3) Update Operation
 *
 * Implements the update() CRUD operation with WAL protection.
 */

import type { NormalizedSchema, UpdateArgs, ModelHooks } from '../../schema/types.js'
import type { Catalog } from '../catalog.js'
import type { ChunkManager } from '../chunk.js'
import type { ChunkLockManager } from '../locks.js'
import type { UniqueIndexManager, UniqueConstraintOptions } from '../../index/unique.js'
import type { WriteAheadLog } from '../../wal/manager.js'
import type { UniqueUpdate } from '../../wal/deltas.js'
import { RecordValidator, throwIfInvalid } from '../../schema/validate.js'
import { TypeSerializer } from '../../schema/serialize.js'
import { normalizeRecordShape } from '../../schema/normalize.js'
import { executeBeforeUpdate, executeAfterUpdate } from '../hooks.js'
import { ValidationError, TransactionConflictError } from '../../core/errors.js'
import { MAX_VERSION_VALUE, VERSION_OVERFLOW_WARN_THRESHOLD } from '../../core/constants.js'
import { logger } from '../../core/logger.js'
import {
	buildUpdateDeltas,
	buildUpdateSegmentedDeltas,
	buildUpdateChunkToSegmentsDeltas,
	buildUpdateSegmentsToChunkDeltas
} from '../../wal/deltas.js'
import { buildModelKey, buildUniqueKey } from '../../core/keys.js'
import { encodeUniqueValue } from '../../core/encoding.js'
import { splitRecordToSegments } from '../segments.js'

/**
 * Index update callbacks for derived writes (Phase 6).
 */
export interface IndexUpdateCallbacks {
	/** Remove entry from sorted index */
	removeFromSortedIndex?: (field: string, value: unknown, id: string) => void
	/** Add entry to sorted index */
	addToSortedIndex?: (field: string, value: unknown, id: string) => void
	/** Mark indexes as dirty for persistence */
	markDirty?: () => void
}

/**
 * Relation callbacks for Phase 9.
 */
export interface RelationCallbacks {
	/**
	 * Validate foreign keys in the input data.
	 * Throws ValidationError if a FK references a non-existent record.
	 */
	validateForeignKeys?: (data: Record<string, unknown>) => Promise<void>
}

/**
 * Context for update operation.
 */
export interface UpdateContext<T> {
	modelName: string
	modelKey: string
	schema: NormalizedSchema
	catalog: Catalog
	chunkManager: ChunkManager
	chunkLock: ChunkLockManager
	validator: RecordValidator
	serializer: TypeSerializer
	hooks?: ModelHooks<T>
	uniqueIndexManager?: UniqueIndexManager
	namespace?: string

	// Callback to persist catalog after modification
	persistCatalog?: () => Promise<void>

	// Optional WAL manager for crash safety
	wal?: WriteAheadLog

	// Optional override for building full chunk keys (for WAL deltas)
	getChunkKey?: (chunkId: number) => string

	// Optional index update callbacks (Phase 6)
	indexCallbacks?: IndexUpdateCallbacks

	// Optional relation callbacks (Phase 9)
	relationCallbacks?: RelationCallbacks
}

/**
 * Execute update operation.
 *
 * 1. Extract ID from where clause
 * 2. Find record (must exist)
 * 3. Reject ID mutation attempt
 * 4. Execute beforeUpdate hook
 * 5. Validate update data
 * 6. Begin WAL entry (if enabled)
 * 7. Acquire chunk lock
 * 8. Merge and save (mark WAL authoritative)
 * 9. Release lock
 * 10. Complete WAL
 * 11. Execute afterUpdate hook
 * 12. Return updated record (or null if not found)
 *
 * @param ctx - Update context
 * @param args - Update arguments
 * @returns Updated record or null
 */
export async function executeUpdate<T extends { id: string }>(
	ctx: UpdateContext<T>,
	args: UpdateArgs<T>
): Promise<T | null> {
	// Validate where clause
	if (!args.where || typeof args.where !== 'object') {
		throw new ValidationError('update requires a where clause')
	}

	// Extract ID from where clause
	const id = extractIdFromWhere(args.where)

	if (!id) {
		throw new ValidationError('update where clause must include id')
	}

	// Check if record exists and get storage info
	const entry = ctx.catalog.getEntry(id)

	if (!entry) {
		// Record doesn't exist - return null
		return null
	}

	// Track if record is currently segmented
	const isSegmented = entry.kind === 'segments'
	const chunkId = entry.kind === 'chunk' ? entry.chunkId ?? 0 : 0

	// Validate update data
	const updateData = args.data as Record<string, unknown>

	// Reject ID mutation
	if ('id' in updateData) {
		throw new ValidationError(
			'Cannot update id field. ID is immutable.',
			{ field: 'id' }
		)
	}

	// Validate update data types
	const validationResult = ctx.validator.validateUpdate(updateData)
	throwIfInvalid(validationResult)

	// Validate foreign keys if any FK fields are being updated (Phase 9)
	if (ctx.relationCallbacks?.validateForeignKeys) {
		await ctx.relationCallbacks.validateForeignKeys(updateData)
	}

	// Track WAL entry ID for cleanup
	let walId: string | null = null
	const walEnabled = ctx.wal?.isEnabled() ?? false

	// Helper to perform update operation
	const performUpdate = async () => {
		// Load existing record based on storage type
		let existingRaw: unknown

		if (isSegmented && entry.segmentIds) {
			existingRaw = await ctx.chunkManager.loadSegmentedRecord(id, entry.segmentIds)
		} else {
			existingRaw = await ctx.chunkManager.getRecord(chunkId, id)
		}

		if (!existingRaw) {
			// Record was deleted between check and lock
			return null
		}

		// Deserialize existing record
		const existing = ctx.serializer.deserializeRecord(
			existingRaw as Record<string, unknown>
		) as T

		// Check explicit version if provided (optimistic locking)
		if (args.version !== undefined) {
			const versionField = findVersionField(ctx.schema)
			if (versionField) {
				const actualVersion = (existing as Record<string, unknown>)[versionField] as number | undefined
				if (actualVersion !== args.version) {
					throw new TransactionConflictError(
						`Version mismatch: expected ${args.version}, found ${actualVersion ?? 0}`,
						{
							model: ctx.modelName,
							id,
							expectedVersion: args.version,
							actualVersion: actualVersion ?? 0
						}
					)
				}
			}
		}

		// Execute beforeUpdate hook (may modify data)
		const hookedData = await executeBeforeUpdate(ctx.hooks, updateData, existing) as Record<string, unknown>

		// Merge existing record with update data
		const merged: Record<string, unknown> = {
			...(existing as Record<string, unknown>),
			...hookedData
		}

		// Ensure ID is preserved
		merged.id = id

		// Handle unique constraint updates
		const constraintUpdates: Array<{
			options: UniqueConstraintOptions
			oldValue: unknown
			newValue: unknown
		}> = []
		const acquiredConstraints: Array<{ options: UniqueConstraintOptions; value: unknown }> = []

		if (ctx.uniqueIndexManager && ctx.schema.uniqueFields.length > 0) {
			for (const field of ctx.schema.uniqueFields) {
				// Only process if this field is being updated
				if (!(field in hookedData)) {
					continue
				}

				const oldValue = (existing as Record<string, unknown>)[field]
				const newValue = hookedData[field]

				// Skip if values are the same
				if (valuesEqual(oldValue, newValue)) {
					continue
				}

				const options: UniqueConstraintOptions = {
					modelName: ctx.modelName,
					namespace: ctx.namespace,
					field
				}

				constraintUpdates.push({ options, oldValue, newValue })
			}
		}

		// Increment version field if present (with overflow protection)
		const versionField = findVersionField(ctx.schema)
		if (versionField && versionField in merged) {
			// Skip auto-increment if explicit _version provided in update data
			if (!(versionField in hookedData)) {
				const currentVersion = (merged[versionField] as number) || 0
				let newVersion = currentVersion + 1

				// Version overflow protection
				if (newVersion >= MAX_VERSION_VALUE) {
					logger.warn(
						`Version overflow detected for ${ctx.modelName}:${id}. ` +
						`Resetting from ${currentVersion} to 1. This breaks optimistic locking for in-flight transactions.`
					)
					newVersion = 1
				} else if (newVersion >= VERSION_OVERFLOW_WARN_THRESHOLD) {
					logger.warn(
						`Version approaching overflow for ${ctx.modelName}:${id}. ` +
						`Current: ${newVersion}, Max: ${MAX_VERSION_VALUE}`
					)
				}

				merged[versionField] = newVersion
			}
		}

		// Normalize record shape
		const normalized = normalizeRecordShape(merged, ctx.schema)

		// Serialize for storage
		const serialized = ctx.serializer.serializeRecord(normalized)

		// Build unique constraint updates for WAL
		const uniqueUpdates: UniqueUpdate[] = []
		for (const { options, oldValue, newValue } of constraintUpdates) {
			const oldKey = (oldValue !== null && oldValue !== undefined)
				? buildUniqueKey(options.modelName, options.field, encodeUniqueValue(oldValue), options.namespace)
				: null
			const newKey = (newValue !== null && newValue !== undefined)
				? buildUniqueKey(options.modelName, options.field, encodeUniqueValue(newValue), options.namespace)
				: null
			uniqueUpdates.push({ oldKey, newKey, id })
		}

		const existingSerialized = existingRaw as Record<string, unknown>

		// Build patch and inverse patch in STORAGE (serialized) form for WAL.
		const patch: Record<string, unknown> = {}
		const inversePatch: Record<string, unknown> = {}
		for (const key of Object.keys(serialized)) {
			if (!serializedValuesEqual(existingSerialized[key], (serialized as Record<string, unknown>)[key])) {
				patch[key] = (serialized as Record<string, unknown>)[key]
				inversePatch[key] = existingSerialized[key]
			}
		}

		// Compute new storage type BEFORE WAL begin so the WAL entry is valid for segmented records.
		const sizeCheck = ctx.chunkManager.checkRecordSize(serialized)
		const needsSegmentation = sizeCheck.needsSegmentation

		// Build WAL deltas (if enabled)
		if (walEnabled && ctx.wal) {
			let deltas: ReturnType<typeof buildUpdateDeltas>

			if (!isSegmented && !needsSegmentation) {
				// Regular chunk update
				const fullChunkKey = ctx.getChunkKey
					? ctx.getChunkKey(chunkId)
					: buildModelKey(ctx.modelName, `chunk:${chunkId}`, ctx.namespace)

				deltas = buildUpdateDeltas(fullChunkKey, id, patch, inversePatch, uniqueUpdates)
			} else if (!isSegmented && needsSegmentation) {
				// Chunk -> Segments transition
				const fullChunkKey = ctx.getChunkKey
					? ctx.getChunkKey(chunkId)
					: buildModelKey(ctx.modelName, `chunk:${chunkId}`, ctx.namespace)

				const { segmentIds, segments } = splitRecordToSegments(ctx.chunkManager, id, serialized)
				deltas = buildUpdateChunkToSegmentsDeltas(
					fullChunkKey,
					chunkId,
					id,
					existingRaw,
					segmentIds,
					segments,
					uniqueUpdates
				)
			} else if (isSegmented && !needsSegmentation) {
				// Segments -> Chunk transition
				const targetChunkId = ctx.chunkManager.selectChunkForInsert(ctx.catalog, sizeCheck.estimatedSize)
				const targetChunkKey = ctx.getChunkKey
					? ctx.getChunkKey(targetChunkId)
					: buildModelKey(ctx.modelName, `chunk:${targetChunkId}`, ctx.namespace)

				const oldCount = entry.segmentIds?.length
				const { segmentIds: oldSegmentIds, segments: oldSegments } = splitRecordToSegments(
					ctx.chunkManager,
					id,
					existingRaw,
					typeof oldCount === 'number' ? oldCount : undefined
				)

				deltas = buildUpdateSegmentsToChunkDeltas(
					id,
					oldSegmentIds,
					oldSegments,
					targetChunkKey,
					targetChunkId,
					serialized,
					uniqueUpdates
				)
			} else {
				// Segments -> Segments update
				const oldCount = entry.segmentIds?.length
				const { segmentIds: oldSegmentIds, segments: oldSegments } = splitRecordToSegments(
					ctx.chunkManager,
					id,
					existingRaw,
					typeof oldCount === 'number' ? oldCount : undefined
				)
				const { segmentIds: newSegmentIds, segments: newSegments } = splitRecordToSegments(
					ctx.chunkManager,
					id,
					serialized
				)

				deltas = buildUpdateSegmentedDeltas(
					id,
					oldSegmentIds,
					oldSegments,
					newSegmentIds,
					newSegments,
					uniqueUpdates
				)
			}

			walId = await ctx.wal.begin({
				model: ctx.modelName,
				namespace: ctx.namespace,
				op: 'update',
				auth: deltas.auth,
				undo: deltas.undo,
				derived: deltas.derived
			})
		}

		// Acquire new constraints first (may throw on duplicate) - after WAL begin
		if (ctx.uniqueIndexManager && constraintUpdates.length > 0) {
			try {
				for (const { options, newValue } of constraintUpdates) {
					if (newValue !== null && newValue !== undefined) {
						await ctx.uniqueIndexManager.acquire(options, newValue, id)
						acquiredConstraints.push({ options, value: newValue })
					}
				}
			} catch (error) {
				// Release already-acquired constraints on failure
				for (const { options, value } of acquiredConstraints) {
					try {
						await ctx.uniqueIndexManager.release(options, value)
					} catch {
						// Ignore release errors during rollback
					}
				}

				// Operation failed without performing chunk writes; remove WAL entry to prevent replay.
				if (walId && ctx.wal) {
					try {
						await ctx.wal.deleteEntry(walId)
					} catch {
						// Ignore WAL cleanup errors; recovery will handle it if needed.
					}
					walId = null
				}

				throw error
			}
		}

		try {
			if (needsSegmentation) {
				// Store as segmented record
				let newSegmentIds: string[]

				if (isSegmented && entry.segmentIds) {
					// Already segmented, update in place
					newSegmentIds = await ctx.chunkManager.updateSegmentedRecord(id, entry.segmentIds, serialized)
				} else {
					// Transitioning from chunk to segments
					newSegmentIds = await ctx.chunkManager.saveSegmentedRecord(id, serialized)
					// Remove from old chunk
					await ctx.chunkManager.deleteRecord(chunkId, id)
				}

				// Update catalog to segments
				ctx.catalog.addSegmentedEntry(id, newSegmentIds)
				await ctx.persistCatalog?.()
			} else if (isSegmented && entry.segmentIds) {
				// Transitioning from segments to chunk
				const targetChunkId = ctx.chunkManager.selectChunkForInsert(ctx.catalog, sizeCheck.estimatedSize)

				await ctx.chunkLock.withChunkLock(ctx.modelKey, targetChunkId, async () => {
					await ctx.chunkManager.setRecord(targetChunkId, id, serialized)
				})

				// Update catalog to chunk
				ctx.catalog.addEntry(id, targetChunkId, sizeCheck.estimatedSize)
				await ctx.persistCatalog?.()

				// Delete old segments
				await ctx.chunkManager.deleteSegmentedRecord(id, entry.segmentIds)
			} else {
				// Regular chunk update
				await ctx.chunkManager.setRecord(chunkId, id, serialized)
			}

			// Release old unique constraints after successful update
			if (ctx.uniqueIndexManager) {
				for (const { options, oldValue } of constraintUpdates) {
					if (oldValue !== null && oldValue !== undefined) {
						try {
							await ctx.uniqueIndexManager.release(options, oldValue)
						} catch {
							// Ignore release errors
						}
					}
				}
			}

			// Mark WAL as authoritative (all writes complete)
			if (walId && ctx.wal) {
				await ctx.wal.markPhase(walId, 'authoritative')
			}

			// Derived writes: update sorted indexes for changed indexed fields (Phase 6)
			if (ctx.indexCallbacks) {
				let indexUpdated = false

				for (const field of ctx.schema.indexedFields) {
					// Only process if this field was updated
					if (!(field in hookedData)) {
						continue
					}

					const oldValue = (existing as Record<string, unknown>)[field]
					const newValue = normalized[field]

					// Skip if values are the same
					if (valuesEqual(oldValue, newValue)) {
						continue
					}

					// Remove old value from index
					if (ctx.indexCallbacks.removeFromSortedIndex && oldValue !== null && oldValue !== undefined) {
						ctx.indexCallbacks.removeFromSortedIndex(field, oldValue, id)
						indexUpdated = true
					}

					// Add new value to index
					if (ctx.indexCallbacks.addToSortedIndex && newValue !== null && newValue !== undefined) {
						ctx.indexCallbacks.addToSortedIndex(field, newValue, id)
						indexUpdated = true
					}
				}

				// Mark indexes as dirty if any updates were made
				if (indexUpdated && ctx.indexCallbacks.markDirty) {
					ctx.indexCallbacks.markDirty()
				}
			}

			// Mark derived writes complete
			if (walId && ctx.wal) {
				await ctx.wal.markPhase(walId, 'derived')
			}
		} catch (error) {
			// Release acquired constraints on chunk write failure
			if (ctx.uniqueIndexManager) {
				for (const { options, value } of acquiredConstraints) {
					try {
						await ctx.uniqueIndexManager.release(options, value)
					} catch {
						// Ignore release errors during rollback
					}
				}
			}
			// WAL will be recovered on next startup (if crash occurs here)
			throw error
		}

		// Deserialize for return
		return ctx.serializer.deserializeRecord(serialized) as T
	}

	// Execute the update with appropriate locking
	let result: T | null

	if (isSegmented) {
		// Segmented records don't use chunk lock (no shared chunk)
		result = await performUpdate()
	} else {
		// Use chunk lock for regular records
		result = await ctx.chunkLock.withChunkLock(ctx.modelKey, chunkId, performUpdate)
	}

	if (!result) {
		return null
	}

	// Complete WAL entry (operation successful)
	if (walId && ctx.wal) {
		await ctx.wal.complete(walId)
	}

	// Execute afterUpdate hook
	await executeAfterUpdate(ctx.hooks, result)

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

/**
 * Find the version field in the schema.
 */
function findVersionField(schema: NormalizedSchema): string | null {
	for (const [name, field] of schema.fields) {
		if (field.version) {
			return name
		}
	}
	return null
}

/**
 * Check if two values are equal for constraint purposes.
 */
function valuesEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true
	if (a === null || a === undefined) return b === null || b === undefined
	if (b === null || b === undefined) return false

	// Handle Date comparison
	if (a instanceof Date && b instanceof Date) {
		return a.getTime() === b.getTime()
	}

	return false
}

/**
 * Compare two values in serialized storage form.
 *
 * Serialized records are plain JSON-safe data, so JSON-stringify equality is
 * acceptable here (and avoids special-case handling for nested objects).
 */
function serializedValuesEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true
	try {
		return JSON.stringify(a) === JSON.stringify(b)
	} catch {
		return false
	}
}
