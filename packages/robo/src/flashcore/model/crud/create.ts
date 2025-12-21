/**
 * Flashcore v4.3 Create Operation
 *
 * Implements the create() CRUD operation.
 */

import type { NormalizedSchema, ModelHooks } from '../../schema/types.js'
import type { Catalog } from '../catalog.js'
import type { ChunkManager } from '../chunk.js'
import type { CatalogLockManager, ChunkLockManager } from '../locks.js'
import type { UniqueIndexManager, UniqueConstraintOptions } from '../../index/unique.js'
import { RecordValidator, throwIfInvalid } from '../../schema/validate.js'
import { TypeSerializer } from '../../schema/serialize.js'
import { applyDefaults, normalizeRecordShape } from '../../schema/normalize.js'
import { generateId, isValidId } from '../id.js'
import { executeBeforeCreate, executeAfterCreate } from '../hooks.js'
import { UniqueConstraintError } from '../../core/errors.js'

/**
 * Context for create operation.
 */
export interface CreateContext<T> {
	modelName: string
	modelKey: string
	schema: NormalizedSchema
	catalog: Catalog
	chunkManager: ChunkManager
	catalogLock: CatalogLockManager
	chunkLock: ChunkLockManager
	validator: RecordValidator
	serializer: TypeSerializer
	hooks?: ModelHooks<T>
	uniqueIndexManager?: UniqueIndexManager
	namespace?: string

	// Callback to persist catalog after modification
	persistCatalog: () => Promise<void>
}

/**
 * Execute create operation.
 *
 * 1. Validate input (required fields, types, unknown rejection)
 * 2. Generate ID if not provided
 * 3. Apply defaults
 * 4. Execute beforeCreate hook
 * 5. Check ID uniqueness (via catalog lookup)
 * 6. Acquire catalog lock
 * 7. Select chunk, acquire chunk lock
 * 8. Add to chunk, update catalog
 * 9. Release locks
 * 10. Execute afterCreate hook
 * 11. Return created record
 *
 * @param ctx - Create context
 * @param data - Input data
 * @returns Created record
 */
export async function executeCreate<T extends { id: string }>(
	ctx: CreateContext<T>,
	data: unknown
): Promise<T> {
	// Ensure data is an object
	const inputData = (typeof data === 'object' && data !== null)
		? { ...data as Record<string, unknown> }
		: {}

	// Generate ID if not provided
	if (!('id' in inputData) || inputData.id === undefined) {
		inputData.id = generateId()
	}

	// Validate ID format
	const id = inputData.id as string
	if (!isValidId(id)) {
		throwIfInvalid({
			valid: false,
			errors: [{
				field: 'id',
				message: 'Invalid ID format. IDs must be non-empty strings containing only letters, numbers, underscores, and hyphens, with max length 200.',
				code: 'INVALID_ID'
			}]
		})
	}

	// Apply defaults before validation
	const withDefaults = applyDefaults(inputData, ctx.schema)

	// Validate input
	const validationResult = ctx.validator.validateCreate(withDefaults)
	throwIfInvalid(validationResult)

	// Execute beforeCreate hook (may modify data)
	const hookedData = await executeBeforeCreate(ctx.hooks, withDefaults) as Record<string, unknown>

	// Normalize record shape
	const normalized = normalizeRecordShape(hookedData, ctx.schema)

	// Ensure ID is preserved after hooks
	normalized[ctx.schema.primaryKey] = id

	// Serialize for storage
	const serialized = ctx.serializer.serializeRecord(normalized)

	// Acquire catalog lock for the entire create operation
	const result = await ctx.catalogLock.withCatalogLock(ctx.modelKey, async () => {
		// Check if ID already exists
		if (ctx.catalog.has(id)) {
			throw new UniqueConstraintError(
				`Record with id "${id}" already exists in model "${ctx.modelName}"`,
				{ model: ctx.modelName, field: 'id', value: id }
			)
		}

		// Acquire unique constraints for all unique fields
		const acquiredConstraints: Array<{ options: UniqueConstraintOptions; value: unknown }> = []

		if (ctx.uniqueIndexManager && ctx.schema.uniqueFields.length > 0) {
			try {
				for (const field of ctx.schema.uniqueFields) {
					const value = normalized[field]

					// Skip null/undefined values (no constraint)
					if (value === null || value === undefined) {
						continue
					}

					const options: UniqueConstraintOptions = {
						modelName: ctx.modelName,
						namespace: ctx.namespace,
						field
					}

					await ctx.uniqueIndexManager.acquire(options, value, id)
					acquiredConstraints.push({ options, value })
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

		// Select chunk for insertion
		const chunkId = ctx.chunkManager.selectChunkForInsert(ctx.catalog)

		try {
			// Acquire chunk lock and perform insert
			return await ctx.chunkLock.withChunkLock(ctx.modelKey, chunkId, async () => {
				// Add record to chunk
				await ctx.chunkManager.setRecord(chunkId, id, serialized)

				// Update catalog
				ctx.catalog.addEntry(id, chunkId)

				// Persist catalog
				await ctx.persistCatalog()

				// Deserialize for return
				return ctx.serializer.deserializeRecord(serialized) as T
			})
		} catch (error) {
			// Release unique constraints on chunk/catalog failure
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
	})

	// Execute afterCreate hook
	await executeAfterCreate(ctx.hooks, result)

	return result
}
