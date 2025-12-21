/**
 * Flashcore v4.3 Update Operation
 *
 * Implements the update() CRUD operation.
 */

import type { NormalizedSchema, UpdateArgs, ModelHooks } from '../../schema/types.js'
import type { Catalog } from '../catalog.js'
import type { ChunkManager } from '../chunk.js'
import type { ChunkLockManager } from '../locks.js'
import type { UniqueIndexManager, UniqueConstraintOptions } from '../../index/unique.js'
import { RecordValidator, throwIfInvalid } from '../../schema/validate.js'
import { TypeSerializer } from '../../schema/serialize.js'
import { normalizeRecordShape } from '../../schema/normalize.js'
import { executeBeforeUpdate, executeAfterUpdate } from '../hooks.js'
import { ValidationError } from '../../core/errors.js'

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
}

/**
 * Execute update operation.
 *
 * 1. Extract ID from where clause
 * 2. Find record (must exist)
 * 3. Reject ID mutation attempt
 * 4. Execute beforeUpdate hook
 * 5. Validate update data
 * 6. Acquire chunk lock
 * 7. Merge and save
 * 8. Release lock
 * 9. Execute afterUpdate hook
 * 10. Return updated record (or null if not found)
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

	// Check if record exists
	const chunkId = ctx.catalog.getChunkFor(id)

	if (chunkId === null) {
		// Record doesn't exist - return null
		return null
	}

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

	// Acquire chunk lock for update
	const result = await ctx.chunkLock.withChunkLock(ctx.modelKey, chunkId, async () => {
		// Load existing record
		const existingRaw = await ctx.chunkManager.getRecord(chunkId, id)

		if (!existingRaw) {
			// Record was deleted between check and lock
			return null
		}

		// Deserialize existing record
		const existing = ctx.serializer.deserializeRecord(
			existingRaw as Record<string, unknown>
		) as T

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

			// Acquire new constraints first (may throw on duplicate)
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
				throw error
			}
		}

		// Increment version field if present
		const versionField = findVersionField(ctx.schema)
		if (versionField && versionField in merged) {
			const currentVersion = merged[versionField] as number
			merged[versionField] = (currentVersion || 0) + 1
		}

		// Normalize record shape
		const normalized = normalizeRecordShape(merged, ctx.schema)

		// Serialize for storage
		const serialized = ctx.serializer.serializeRecord(normalized)

		try {
			// Save to chunk
			await ctx.chunkManager.setRecord(chunkId, id, serialized)

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
			throw error
		}

		// Deserialize for return
		return ctx.serializer.deserializeRecord(serialized) as T
	})

	if (!result) {
		return null
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
