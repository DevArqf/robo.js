/**
 * Flashcore v1 Upsert Operation (spec rev 4.3)
 *
 * Implements the upsert (create-or-update) operation.
 */

import type { FlashcoreAdapter } from '../../adapter/types.js'
import type {
	NormalizedSchema,
	UniqueWhere,
	UpsertArgs
} from '../../schema/types.js'
import type { Catalog } from '../catalog.js'
import type { ChunkManager } from '../chunk.js'
import type { CatalogLockManager, ChunkLockManager } from '../locks.js'
import type { UniqueIndexManager } from '../../index/unique.js'
import { RecordValidator, throwIfInvalid } from '../../schema/validate.js'
import { TypeSerializer } from '../../schema/serialize.js'
import { applyDefaults, normalizeRecordShape } from '../../schema/normalize.js'
import { generateId, isValidId } from '../id.js'
import { ValidationError } from '../../core/errors.js'
import { MAX_VERSION_VALUE, VERSION_OVERFLOW_WARN_THRESHOLD } from '../../core/constants.js'
import { logger } from '../../core/logger.js'

/**
 * Index update callbacks for upsert operations.
 */
export interface UpsertIndexCallbacks {
	addToFilter?: (id: string) => void
	addToSortedIndex?: (field: string, value: unknown, id: string) => void
	removeFromSortedIndex?: (field: string, value: unknown, id: string) => void
	markDirty?: () => void
}

/**
 * Context for upsert operation.
 */
export interface UpsertContext<T> {
	modelName: string
	modelKey: string
	schema: NormalizedSchema
	catalog: Catalog
	chunkManager: ChunkManager
	adapter: FlashcoreAdapter
	catalogLock: CatalogLockManager
	chunkLock: ChunkLockManager
	validator: RecordValidator
	serializer: TypeSerializer
	uniqueIndexManager?: UniqueIndexManager
	namespace?: string
	persistCatalog: () => Promise<void>
	indexCallbacks?: UpsertIndexCallbacks
}

/**
 * Result from upsert operation.
 */
export interface UpsertResult<T> {
	record: T
	created: boolean
}

/**
 * Execute upsert operation.
 *
 * Creates a new record if no match found, otherwise updates the existing one.
 *
 * @param ctx - Upsert context
 * @param args - Upsert arguments (where, create, update)
 * @returns Upserted record and whether it was created
 */
export async function executeUpsert<T extends { id: string }>(
	ctx: UpsertContext<T>,
	args: UpsertArgs<T>
): Promise<UpsertResult<T>> {
	const { where, create, update } = args

	// Validate where clause
	if (!where || typeof where !== 'object') {
		throw new ValidationError('upsert requires a where clause')
	}

	// Try to find existing record
	const existingRecord = await findRecordByWhere(ctx, where)

	if (existingRecord) {
		// Update existing record
		const updateData = update as Record<string, unknown>

		// Reject ID mutation
		if ('id' in updateData) {
			throw new ValidationError('Cannot update id field. ID is immutable.', { field: 'id' })
		}

		// Validate update data
		const validationResult = ctx.validator.validateUpdate(updateData)
		throwIfInvalid(validationResult)

		// Merge existing record with update data
		const merged = { ...(existingRecord.record as Record<string, unknown>), ...updateData }
		merged.id = existingRecord.id

		// Increment version field if present (with overflow protection)
		const versionField = findVersionField(ctx.schema)
		if (versionField && versionField in merged) {
			const currentVersion = (merged[versionField] as number) || 0
			let newVersion = currentVersion + 1

			// Version overflow protection
			if (newVersion >= MAX_VERSION_VALUE) {
				logger.warn(
					`Version overflow detected for ${ctx.modelName}:${existingRecord.id}. ` +
					`Resetting from ${currentVersion} to 1.`
				)
				newVersion = 1
			} else if (newVersion >= VERSION_OVERFLOW_WARN_THRESHOLD) {
				logger.warn(
					`Version approaching overflow for ${ctx.modelName}:${existingRecord.id}. ` +
					`Current: ${newVersion}, Max: ${MAX_VERSION_VALUE}`
				)
			}

			merged[versionField] = newVersion
		}

		// Handle unique constraint updates
		await handleUniqueUpdates(ctx, existingRecord.id, existingRecord.record, updateData)

		// Normalize and serialize
		const normalized = normalizeRecordShape(merged, ctx.schema)
		const serialized = ctx.serializer.serializeRecord(normalized)

		// Update in chunk
		await ctx.chunkManager.setRecord(existingRecord.chunkId, existingRecord.id, serialized)

		// Update sorted indexes
		if (ctx.indexCallbacks) {
			for (const field of ctx.schema.indexedFields) {
				if (!(field in updateData)) continue

				const oldValue = (existingRecord.record as Record<string, unknown>)[field]
				const newValue = normalized[field]

				if (oldValue !== newValue) {
					if (ctx.indexCallbacks.removeFromSortedIndex && oldValue !== null && oldValue !== undefined) {
						ctx.indexCallbacks.removeFromSortedIndex(field, oldValue, existingRecord.id)
					}
					if (ctx.indexCallbacks.addToSortedIndex && newValue !== null && newValue !== undefined) {
						ctx.indexCallbacks.addToSortedIndex(field, newValue, existingRecord.id)
					}
				}
			}

			if (ctx.indexCallbacks.markDirty) {
				ctx.indexCallbacks.markDirty()
			}
		}

		return {
			record: ctx.serializer.deserializeRecord(serialized) as T,
			created: false
		}
	} else {
		// Create new record
		const createData = { ...create as Record<string, unknown> }

		// Copy the where clause identifier to create data if not present
		if ('id' in where && !('id' in createData)) {
			createData.id = (where as { id: string }).id
		}

		// For unique field where clauses, copy the value to create data
		for (const field of ctx.schema.uniqueFields) {
			if (field in where && !(field in createData)) {
				createData[field] = (where as Record<string, unknown>)[field]
			}
		}

		// Generate ID if not provided
		if (!('id' in createData) || createData.id === undefined) {
			createData.id = generateId()
		}

		const id = createData.id as string

		// Validate ID format
		if (!isValidId(id)) {
			throwIfInvalid({
				valid: false,
				errors: [{
					field: 'id',
					message: 'Invalid ID format',
					code: 'INVALID_ID'
				}]
			})
		}

		// Apply defaults
		const withDefaults = applyDefaults(createData, ctx.schema)

		// Initialize version field to 0 if schema has one
		const versionField = findVersionField(ctx.schema)
		if (versionField && !(versionField in withDefaults)) {
			withDefaults[versionField] = 0
		}

		// Validate create data
		const validationResult = ctx.validator.validateCreate(withDefaults)
		throwIfInvalid(validationResult)

		// Normalize and serialize
		const normalized = normalizeRecordShape(withDefaults, ctx.schema)
		normalized[ctx.schema.primaryKey] = id
		const serialized = ctx.serializer.serializeRecord(normalized)

		// Acquire catalog lock
		const result = await ctx.catalogLock.withCatalogLock(ctx.modelKey, async () => {
			// Double-check that record wasn't created by another process
			if (ctx.catalog.has(id)) {
				// Record was created by another process - treat as update
				// This is a simplified handling; in production we might retry
				const entry = ctx.catalog.getEntry(id)
				if (!entry) throw new Error('Race condition: record appears then disappears')

				const chunkId = entry.kind === 'chunk' ? entry.chunkId ?? 0 : 0
				const raw = await ctx.chunkManager.getRecord(chunkId, id)
				if (!raw) throw new Error('Race condition: catalog entry without data')

				return {
					record: ctx.serializer.deserializeRecord(raw as Record<string, unknown>) as T,
					created: false
				}
			}

			// Acquire unique constraints
			const acquiredConstraints: Array<{ field: string; value: unknown }> = []

			if (ctx.uniqueIndexManager) {
				try {
					for (const field of ctx.schema.uniqueFields) {
						const value = normalized[field]
						if (value !== null && value !== undefined) {
							await ctx.uniqueIndexManager.acquire(
								{ modelName: ctx.modelName, namespace: ctx.namespace, field },
								value,
								id
							)
							acquiredConstraints.push({ field, value })
						}
					}
				} catch (error) {
					// Release acquired constraints on failure
					for (const { field, value } of acquiredConstraints) {
						try {
							await ctx.uniqueIndexManager.release(
								{ modelName: ctx.modelName, namespace: ctx.namespace, field },
								value
							)
						} catch {
							// Ignore release errors
						}
					}
					throw error
				}
			}

			try {
				// Select chunk for this record
				const sizeCheck = ctx.chunkManager.checkRecordSize(serialized)
				const chunkId = ctx.chunkManager.selectChunkForInsert(ctx.catalog, sizeCheck.estimatedSize)

				// Add to chunk
				await ctx.chunkManager.setRecord(chunkId, id, serialized)

				// Update catalog
				ctx.catalog.addEntry(id, chunkId, sizeCheck.estimatedSize)

				// Persist catalog
				await ctx.persistCatalog()

				// Update indexes
				if (ctx.indexCallbacks) {
					if (ctx.indexCallbacks.addToFilter) {
						ctx.indexCallbacks.addToFilter(id)
					}

					if (ctx.indexCallbacks.addToSortedIndex) {
						for (const field of ctx.schema.indexedFields) {
							const value = normalized[field]
							if (value !== null && value !== undefined) {
								ctx.indexCallbacks.addToSortedIndex(field, value, id)
							}
						}
					}

					if (ctx.indexCallbacks.markDirty) {
						ctx.indexCallbacks.markDirty()
					}
				}

				return {
					record: ctx.serializer.deserializeRecord(serialized) as T,
					created: true
				}
			} catch (error) {
				// Release constraints on failure
				if (ctx.uniqueIndexManager) {
					for (const { field, value } of acquiredConstraints) {
						try {
							await ctx.uniqueIndexManager.release(
								{ modelName: ctx.modelName, namespace: ctx.namespace, field },
								value
							)
						} catch {
							// Ignore release errors
						}
					}
				}
				throw error
			}
		})

		return result
	}
}

/**
 * Find a record by where clause.
 */
async function findRecordByWhere<T extends { id: string }>(
	ctx: UpsertContext<T>,
	where: UniqueWhere<T>
): Promise<{ id: string; record: T; chunkId: number } | null> {
	// Check for ID-based lookup
	if ('id' in where && typeof (where as { id: string }).id === 'string') {
		const id = (where as { id: string }).id
		const entry = ctx.catalog.getEntry(id)

		if (!entry) return null

		const chunkId = entry.kind === 'chunk' ? entry.chunkId ?? 0 : 0
		let raw: unknown

		if (entry.kind === 'segments' && entry.segmentIds) {
			raw = await ctx.chunkManager.loadSegmentedRecord(id, entry.segmentIds)
		} else {
			raw = await ctx.chunkManager.getRecord(chunkId, id)
		}

		if (!raw) return null

		const record = ctx.serializer.deserializeRecord(raw as Record<string, unknown>) as T
		return { id, record, chunkId }
	}

	// Check for unique field lookup
	for (const field of ctx.schema.uniqueFields) {
		if (field in where) {
			const value = (where as Record<string, unknown>)[field]
			if (value === null || value === undefined) continue

			// Look up via unique index
			if (ctx.uniqueIndexManager) {
				const id = await ctx.uniqueIndexManager.lookup(
					{ modelName: ctx.modelName, namespace: ctx.namespace, field },
					value
				)

				if (id) {
					const entry = ctx.catalog.getEntry(id)
					if (!entry) return null

					const chunkId = entry.kind === 'chunk' ? entry.chunkId ?? 0 : 0
					let raw: unknown

					if (entry.kind === 'segments' && entry.segmentIds) {
						raw = await ctx.chunkManager.loadSegmentedRecord(id, entry.segmentIds)
					} else {
						raw = await ctx.chunkManager.getRecord(chunkId, id)
					}

					if (!raw) return null

					const record = ctx.serializer.deserializeRecord(raw as Record<string, unknown>) as T
					return { id, record, chunkId }
				}
			}
		}
	}

	return null
}

/**
 * Handle unique constraint updates during upsert.
 */
async function handleUniqueUpdates<T>(
	ctx: UpsertContext<T>,
	id: string,
	existing: T,
	updateData: Record<string, unknown>
): Promise<void> {
	if (!ctx.uniqueIndexManager) return

	for (const field of ctx.schema.uniqueFields) {
		if (!(field in updateData)) continue

		const oldValue = (existing as Record<string, unknown>)[field]
		const newValue = updateData[field]

		// Skip if values are the same
		if (valuesEqual(oldValue, newValue)) continue

		// Release old constraint
		if (oldValue !== null && oldValue !== undefined) {
			try {
				await ctx.uniqueIndexManager.release(
					{ modelName: ctx.modelName, namespace: ctx.namespace, field },
					oldValue
				)
			} catch {
				// Ignore release errors
			}
		}

		// Acquire new constraint
		if (newValue !== null && newValue !== undefined) {
			await ctx.uniqueIndexManager.acquire(
				{ modelName: ctx.modelName, namespace: ctx.namespace, field },
				newValue,
				id
			)
		}
	}
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
 * Check if two values are equal.
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
