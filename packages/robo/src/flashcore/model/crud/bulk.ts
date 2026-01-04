/**
 * Flashcore v1 Bulk Operations (spec rev 4.3)
 *
 * Implements createMany, updateMany, and deleteMany operations.
 * These operations require ACID capability (caps.acid === true).
 */

import type { FlashcoreAdapter } from '../../adapter/types.js'
import type {
	NormalizedSchema,
	CreateInput,
	WhereClause,
	UpdateInput,
	BatchResult
} from '../../schema/types.js'
import type { Catalog } from '../catalog.js'
import type { ChunkManager } from '../chunk.js'
import type { CatalogLockManager, ChunkLockManager } from '../locks.js'
import type { UniqueIndexManager } from '../../index/unique.js'
import { RecordValidator, throwIfInvalid } from '../../schema/validate.js'
import { TypeSerializer } from '../../schema/serialize.js'
import { applyDefaults, normalizeRecordShape } from '../../schema/normalize.js'
import { generateId, isValidId } from '../id.js'
import { UniqueConstraintError, SafetyError } from '../../core/errors.js'
import { requiresAcid } from '../../transaction/modes.js'
import { DEFAULT_SAFETY_LIMITS, MAX_VERSION_VALUE, VERSION_OVERFLOW_WARN_THRESHOLD } from '../../core/constants.js'
import { evaluateWhere } from '../../query/evaluate.js'
import { encodeUniqueValue } from '../../core/encoding.js'
import { logger } from '../../core/logger.js'

/**
 * Index update callbacks for bulk operations.
 */
export interface BulkIndexCallbacks {
	addToFilter?: (id: string) => void
	removeFromFilter?: (id: string) => void
	addToSortedIndex?: (field: string, value: unknown, id: string) => void
	removeFromSortedIndex?: (field: string, value: unknown, id: string) => void
	markDirty?: () => void
}

/**
 * Context for bulk operations.
 */
export interface BulkContext<T> {
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
	indexCallbacks?: BulkIndexCallbacks
	safetyLimits?: typeof DEFAULT_SAFETY_LIMITS
}

/**
 * Result from createMany operation.
 */
export interface CreateManyResult<T> {
	count: number
	records: T[]
}

/**
 * Execute createMany operation.
 *
 * Creates multiple records atomically using transaction or atomicBatch.
 * Requires caps.acid === true.
 *
 * @param ctx - Bulk context
 * @param data - Array of records to create
 * @param skipDuplicates - If true, skip records with duplicate IDs/unique fields instead of throwing
 * @returns Created records
 */
export async function executeCreateMany<T extends { id: string }>(
	ctx: BulkContext<T>,
	data: CreateInput<T>[],
	skipDuplicates = false
): Promise<CreateManyResult<T>> {
	// Require ACID support
	requiresAcid(ctx.adapter)

	if (data.length === 0) {
		return { count: 0, records: [] }
	}

	// Prepare all records
	let preparedRecords: Array<{
		id: string
		normalized: Record<string, unknown>
		serialized: Record<string, unknown>
	}> = []

	const seenIds = new Set<string>()
	const seenUniqueValues = new Map<string, Set<string>>() // field -> set of values

	for (const inputData of data) {
		const record = { ...inputData as Record<string, unknown> }

		// Generate ID if not provided
		if (!('id' in record) || record.id === undefined) {
			record.id = generateId()
		}

		const id = record.id as string

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

		// Check for duplicate IDs within the batch
		if (seenIds.has(id)) {
			if (skipDuplicates) continue
			throw new UniqueConstraintError(
				`Duplicate ID "${id}" in createMany batch`,
				{ model: ctx.modelName, field: 'id', value: id }
			)
		}
		seenIds.add(id)

		// Check if ID already exists in catalog
		if (ctx.catalog.has(id)) {
			if (skipDuplicates) continue
			throw new UniqueConstraintError(
				`Record with id "${id}" already exists in model "${ctx.modelName}"`,
				{ model: ctx.modelName, field: 'id', value: id }
			)
		}

		// Apply defaults
		const withDefaults = applyDefaults(record, ctx.schema)

		// Initialize version field to 0 if schema has one
		const versionField = findVersionField(ctx.schema)
		if (versionField && !(versionField in withDefaults)) {
			withDefaults[versionField] = 0
		}

		// Validate input
		const validationResult = ctx.validator.validateCreate(withDefaults)
		throwIfInvalid(validationResult)

		// Check unique constraints within batch
		for (const field of ctx.schema.uniqueFields) {
			const value = withDefaults[field]
			if (value !== null && value !== undefined) {
				const encodedValue = encodeUniqueValue(value)
				let fieldSet = seenUniqueValues.get(field)
				if (!fieldSet) {
					fieldSet = new Set()
					seenUniqueValues.set(field, fieldSet)
				}

				if (fieldSet.has(encodedValue)) {
					if (skipDuplicates) continue
					throw new UniqueConstraintError(
						`Duplicate value for unique field "${field}" in createMany batch`,
						{ model: ctx.modelName, field, value }
					)
				}
				fieldSet.add(encodedValue)
			}
		}

		// Normalize and serialize
		const normalized = normalizeRecordShape(withDefaults, ctx.schema)
		normalized[ctx.schema.primaryKey] = id
		const serialized = ctx.serializer.serializeRecord(normalized)

		preparedRecords.push({ id, normalized, serialized })
	}

	if (preparedRecords.length === 0) {
		return { count: 0, records: [] }
	}

	// Execute atomically
	const createdRecords: T[] = []

	await ctx.catalogLock.withCatalogLock(ctx.modelKey, async () => {
		// Acquire all unique constraints first
		const acquiredConstraints: Array<{
			field: string
			value: unknown
			id: string
		}> = []
		const skippedIds = new Set<string>()

		if (ctx.uniqueIndexManager) {
			for (const { id, normalized } of preparedRecords) {
				let recordSkipped = false

				for (const field of ctx.schema.uniqueFields) {
					const value = normalized[field]
					if (value !== null && value !== undefined) {
						try {
							await ctx.uniqueIndexManager.acquire(
								{ modelName: ctx.modelName, namespace: ctx.namespace, field },
								value,
								id
							)
							acquiredConstraints.push({ field, value, id })
						} catch (error) {
							if (skipDuplicates && error instanceof UniqueConstraintError) {
								// Skip this record - release any constraints acquired for it
								for (const constraint of acquiredConstraints.filter(c => c.id === id)) {
									try {
										await ctx.uniqueIndexManager.release(
											{ modelName: ctx.modelName, namespace: ctx.namespace, field: constraint.field },
											constraint.value
										)
									} catch {
										// Ignore release errors
									}
								}
								skippedIds.add(id)
								recordSkipped = true
								break // Skip remaining fields for this record
							}

							// Release all acquired constraints on failure
							for (const { field: f, value: v } of acquiredConstraints) {
								try {
									await ctx.uniqueIndexManager.release(
										{ modelName: ctx.modelName, namespace: ctx.namespace, field: f },
										v
									)
								} catch {
									// Ignore release errors
								}
							}
							throw error
						}
					}
				}

				if (recordSkipped) {
					// Remove constraints for this record from acquired list
					const toRemove = acquiredConstraints.filter(c => c.id === id)
					for (const constraint of toRemove) {
						const idx = acquiredConstraints.indexOf(constraint)
						if (idx >= 0) acquiredConstraints.splice(idx, 1)
					}
				}
			}
		}

		// Filter out skipped records
		preparedRecords = preparedRecords.filter(r => !skippedIds.has(r.id))

		if (preparedRecords.length === 0) {
			return
		}

		try {
			// Use atomicBatch or transaction
			if (ctx.adapter.atomicBatch) {
				for (const { id, serialized } of preparedRecords) {
					// Select chunk for this record
					const sizeCheck = ctx.chunkManager.checkRecordSize(serialized)
					const chunkId = ctx.chunkManager.selectChunkForInsert(ctx.catalog, sizeCheck.estimatedSize)

					// Update catalog
					ctx.catalog.addEntry(id, chunkId, sizeCheck.estimatedSize)
				}

				// Add records to chunks
				for (const { id, serialized } of preparedRecords) {
					const entry = ctx.catalog.getEntry(id)
					if (entry?.kind === 'chunk' && entry.chunkId !== undefined) {
						await ctx.chunkManager.setRecord(entry.chunkId, id, serialized)
					}
				}

				// Persist catalog
				await ctx.persistCatalog()
			} else if (ctx.adapter.transaction) {
				await ctx.adapter.transaction(async () => {
					for (const { id, serialized } of preparedRecords) {
						const sizeCheck = ctx.chunkManager.checkRecordSize(serialized)
						const chunkId = ctx.chunkManager.selectChunkForInsert(ctx.catalog, sizeCheck.estimatedSize)

						await ctx.chunkManager.setRecord(chunkId, id, serialized)
						ctx.catalog.addEntry(id, chunkId, sizeCheck.estimatedSize)
					}

					await ctx.persistCatalog()
				})
			}

			// Deserialize records for return
			for (const { serialized } of preparedRecords) {
				createdRecords.push(ctx.serializer.deserializeRecord(serialized) as T)
			}

			// Update indexes
			if (ctx.indexCallbacks) {
				for (const { id, normalized } of preparedRecords) {
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
				}

				if (ctx.indexCallbacks.markDirty) {
					ctx.indexCallbacks.markDirty()
				}
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

	return { count: createdRecords.length, records: createdRecords }
}

/**
 * Execute updateMany operation.
 *
 * Updates multiple records matching the where clause.
 * Requires caps.acid === true.
 *
 * @param ctx - Bulk context
 * @param where - Filter clause
 * @param data - Update data
 * @returns Number of records updated
 */
export async function executeUpdateMany<T extends { id: string }>(
	ctx: BulkContext<T>,
	where: WhereClause<T>,
	data: UpdateInput<T>
): Promise<BatchResult> {
	// Require ACID support
	requiresAcid(ctx.adapter)

	// Safety check: require where clause
	if (!where || Object.keys(where).length === 0) {
		throw new SafetyError(
			'updateMany requires a where clause. Use explicit criteria to prevent accidental bulk updates.',
			{ reason: 'missing_where_clause' }
		)
	}

	// Validate update data
	const updateData = data as Record<string, unknown>

	// Reject ID mutation
	if ('id' in updateData) {
		throw new Error('Cannot update id field. ID is immutable.')
	}

	const validationResult = ctx.validator.validateUpdate(updateData)
	throwIfInvalid(validationResult)

	// Find matching records
	const allIds = ctx.catalog.getAllIds()
	const matchingRecords: Array<{ id: string; record: T; chunkId: number }> = []

	for (const id of allIds) {
		const entry = ctx.catalog.getEntry(id)
		if (!entry) continue

		const chunkId = entry.kind === 'chunk' ? entry.chunkId ?? 0 : 0
		let raw: unknown

		if (entry.kind === 'segments' && entry.segmentIds) {
			raw = await ctx.chunkManager.loadSegmentedRecord(id, entry.segmentIds)
		} else {
			raw = await ctx.chunkManager.getRecord(chunkId, id)
		}

		if (!raw) continue

		const record = ctx.serializer.deserializeRecord(raw as Record<string, unknown>) as T

		// Evaluate where clause
		if (evaluateWhere(record, where)) {
			matchingRecords.push({ id, record, chunkId })
		}
	}

	if (matchingRecords.length === 0) {
		return { count: 0 }
	}

	// Validate unique constraints BEFORE applying any updates
	// This ensures atomicity - either all updates succeed or none
	if (ctx.uniqueIndexManager) {
		const matchingIds = new Set(matchingRecords.map(r => r.id))

		for (const field of ctx.schema.uniqueFields) {
			if (field in updateData) {
				const newValue = updateData[field]
				if (newValue !== null && newValue !== undefined) {
					// If updating multiple records to the same unique value, that's a violation
					if (matchingRecords.length > 1) {
						throw new UniqueConstraintError(
							`Cannot update multiple records to same ${field} value '${newValue}': uniqueness would be violated`,
							{ model: ctx.modelName, field, value: newValue }
						)
					}

					// Check if this value exists on a record NOT being updated
					const existingId = await ctx.uniqueIndexManager.lookup(
						{ modelName: ctx.modelName, namespace: ctx.namespace, field },
						newValue
					)

					if (existingId && !matchingIds.has(existingId)) {
						throw new UniqueConstraintError(
							`Cannot update ${field} to '${newValue}': value already exists on another record`,
							{ model: ctx.modelName, field, value: newValue }
						)
					}
				}
			}
		}
	}

	let updatedCount = 0

	// Update matching records
	for (const { id, record, chunkId } of matchingRecords) {
		// Merge existing record with update data
		const merged = { ...(record as Record<string, unknown>), ...updateData }
		merged.id = id

		// Increment version field if present (with overflow protection)
		const versionField = findVersionField(ctx.schema)
		if (versionField && versionField in merged) {
			const currentVersion = (merged[versionField] as number) || 0
			let newVersion = currentVersion + 1

			// Version overflow protection
			if (newVersion >= MAX_VERSION_VALUE) {
				logger.warn(
					`Version overflow detected for ${ctx.modelName}:${id}. ` +
					`Resetting from ${currentVersion} to 1.`
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

		// Normalize and serialize
		const normalized = normalizeRecordShape(merged, ctx.schema)
		const serialized = ctx.serializer.serializeRecord(normalized)

		// Update in chunk
		await ctx.chunkManager.setRecord(chunkId, id, serialized)

		// Update sorted indexes
		if (ctx.indexCallbacks) {
			for (const field of ctx.schema.indexedFields) {
				if (!(field in updateData)) continue

				const oldValue = (record as Record<string, unknown>)[field]
				const newValue = normalized[field]

				if (oldValue !== newValue) {
					if (ctx.indexCallbacks.removeFromSortedIndex && oldValue !== null && oldValue !== undefined) {
						ctx.indexCallbacks.removeFromSortedIndex(field, oldValue, id)
					}
					if (ctx.indexCallbacks.addToSortedIndex && newValue !== null && newValue !== undefined) {
						ctx.indexCallbacks.addToSortedIndex(field, newValue, id)
					}
				}
			}

			if (ctx.indexCallbacks.markDirty) {
				ctx.indexCallbacks.markDirty()
			}
		}

		updatedCount++
	}

	return { count: updatedCount }
}

/**
 * Execute deleteMany operation.
 *
 * Deletes multiple records matching the where clause.
 * Requires caps.acid === true.
 *
 * @param ctx - Bulk context
 * @param where - Filter clause
 * @returns Number of records deleted
 */
export async function executeDeleteMany<T extends { id: string }>(
	ctx: BulkContext<T>,
	where: WhereClause<T>
): Promise<BatchResult> {
	// Require ACID support
	requiresAcid(ctx.adapter)

	// Safety check: require where clause
	if (!where || Object.keys(where).length === 0) {
		throw new SafetyError(
			'deleteMany requires a where clause. Use explicit criteria to prevent accidental bulk deletes.',
			{ reason: 'missing_where_clause' }
		)
	}

	// Find matching records
	const allIds = ctx.catalog.getAllIds()
	const matchingRecords: Array<{ id: string; record: T; chunkId: number }> = []

	for (const id of allIds) {
		const entry = ctx.catalog.getEntry(id)
		if (!entry) continue

		const chunkId = entry.kind === 'chunk' ? entry.chunkId ?? 0 : 0
		let raw: unknown

		if (entry.kind === 'segments' && entry.segmentIds) {
			raw = await ctx.chunkManager.loadSegmentedRecord(id, entry.segmentIds)
		} else {
			raw = await ctx.chunkManager.getRecord(chunkId, id)
		}

		if (!raw) continue

		const record = ctx.serializer.deserializeRecord(raw as Record<string, unknown>) as T

		// Evaluate where clause
		if (evaluateWhere(record, where)) {
			matchingRecords.push({ id, record, chunkId })
		}
	}

	if (matchingRecords.length === 0) {
		return { count: 0 }
	}

	let deletedCount = 0

	await ctx.catalogLock.withCatalogLock(ctx.modelKey, async () => {
		// Delete matching records
		for (const { id, record, chunkId } of matchingRecords) {
			// Release unique constraints
			if (ctx.uniqueIndexManager) {
				for (const field of ctx.schema.uniqueFields) {
					const value = (record as Record<string, unknown>)[field]
					if (value !== null && value !== undefined) {
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
			}

			// Delete from chunk
			await ctx.chunkManager.deleteRecord(chunkId, id)

			// Update catalog
			ctx.catalog.removeEntry(id)

			// Update indexes
			if (ctx.indexCallbacks) {
				if (ctx.indexCallbacks.removeFromFilter) {
					ctx.indexCallbacks.removeFromFilter(id)
				}

				if (ctx.indexCallbacks.removeFromSortedIndex) {
					for (const field of ctx.schema.indexedFields) {
						const value = (record as Record<string, unknown>)[field]
						if (value !== null && value !== undefined) {
							ctx.indexCallbacks.removeFromSortedIndex(field, value, id)
						}
					}
				}
			}

			deletedCount++
		}

		// Persist catalog
		await ctx.persistCatalog()

		// Mark indexes as dirty
		if (ctx.indexCallbacks?.markDirty) {
			ctx.indexCallbacks.markDirty()
		}
	})

	return { count: deletedCount }
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
