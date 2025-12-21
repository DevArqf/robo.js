/**
 * Flashcore v4.3 Model
 *
 * Main FlashcoreModel class with CRUD operations.
 */

import type { FlashcoreAdapter } from '../adapter/types.js'
import type {
	SchemaFields,
	NormalizedSchema,
	ModelHooks,
	CreateInput,
	FindUniqueArgs,
	UpdateArgs,
	DeleteArgs,
	RelationDef,
	FindManyArgs,
	FindFirstArgs,
	CountArgs
} from '../schema/types.js'
import { normalizeSchema } from '../schema/normalize.js'
import { RecordValidator } from '../schema/validate.js'
import { TypeSerializer } from '../schema/serialize.js'
import { validateHooks } from './hooks.js'
import { Catalog } from './catalog.js'
import { ChunkManager } from './chunk.js'
import { catalogLockManager, chunkLockManager } from './locks.js'
import { buildModelKey } from '../core/keys.js'

import { executeCreate, type CreateContext } from './crud/create.js'
import { executeFindUnique, type ReadContext } from './crud/read.js'
import { executeUpdate, type UpdateContext } from './crud/update.js'
import { executeDelete, type DeleteContext } from './crud/delete.js'
import {
	executeFindMany,
	executeFindFirst,
	executeCount,
	executeFindManyStream,
	type FindManyContext
} from './crud/find-many.js'
import { UniqueIndexManager } from '../index/unique.js'

/**
 * Model options for registration.
 */
export interface FlashcoreModelOptions {
	namespace?: string
	methods?: Record<string, (...args: unknown[]) => unknown>
	hooks?: ModelHooks
}

/**
 * FlashcoreModel class.
 *
 * Provides CRUD operations for a model defined by a schema.
 */
export class FlashcoreModel<T extends { id: string } = { id: string }> {
	readonly name: string
	readonly namespace?: string
	readonly schema: NormalizedSchema
	readonly hooks?: ModelHooks<T>

	/**
	 * Plugin metadata storage.
	 */
	readonly meta: Record<string, unknown> = {}

	// Internal state
	private adapter: FlashcoreAdapter
	private catalog: Catalog
	private chunkManager: ChunkManager
	private validator: RecordValidator
	private serializer: TypeSerializer
	private uniqueIndexManager: UniqueIndexManager
	private catalogLoaded = false

	/**
	 * Key used for locking and storage.
	 */
	private readonly modelKey: string

	/**
	 * Custom methods added to the model.
	 */
	private readonly customMethods: Record<string, (...args: unknown[]) => unknown>

	constructor(
		name: string,
		schemaFields: SchemaFields,
		adapter: FlashcoreAdapter,
		options?: FlashcoreModelOptions
	) {
		this.name = name
		this.namespace = options?.namespace
		this.adapter = adapter

		// Build model key for storage
		this.modelKey = this.namespace ? `${this.namespace}::${name}` : name

		// Normalize schema
		this.schema = normalizeSchema(schemaFields)

		// Create helpers
		this.catalog = Catalog.empty()
		this.chunkManager = new ChunkManager({
			adapter,
			modelName: name,
			namespace: this.namespace
		})
		this.validator = new RecordValidator(this.schema)
		this.serializer = new TypeSerializer(this.schema)
		this.uniqueIndexManager = new UniqueIndexManager(adapter)

		// Validate and store hooks
		if (options?.hooks) {
			validateHooks(options.hooks)
			this.hooks = options.hooks as ModelHooks<T>
		}

		// Store custom methods (bound to this model)
		this.customMethods = {}
		if (options?.methods) {
			for (const [methodName, method] of Object.entries(options.methods)) {
				this.customMethods[methodName] = method.bind(this)
			}
		}

		// Create proxy to expose custom methods
		return new Proxy(this, {
			get(target, prop, receiver) {
				// Check custom methods first
				if (typeof prop === 'string' && prop in target.customMethods) {
					return target.customMethods[prop]
				}
				return Reflect.get(target, prop, receiver)
			}
		})
	}

	/**
	 * Build the catalog storage key.
	 */
	private getCatalogKey(): string {
		return buildModelKey(this.name, 'catalog', this.namespace)
	}

	/**
	 * Ensure catalog is loaded from storage.
	 */
	private async ensureCatalogLoaded(): Promise<void> {
		if (this.catalogLoaded) {
			return
		}

		const catalogKey = this.getCatalogKey()
		const data = await this.adapter.get(catalogKey)

		if (data && typeof data === 'object') {
			this.catalog = Catalog.deserialize(data as {
				version: number
				entries: Array<{ id: string; chunkId: number }>
				chunkStats: Array<{ chunkId: number; count: number }>
				count: number
			})
		} else {
			this.catalog = Catalog.empty()
		}

		this.catalogLoaded = true
	}

	/**
	 * Persist catalog to storage.
	 */
	private async persistCatalog(): Promise<void> {
		const catalogKey = this.getCatalogKey()
		const data = this.catalog.serialize()
		await this.adapter.set(catalogKey, data)
	}

	// ========================================================================
	// CRUD Operations
	// ========================================================================

	/**
	 * Create a new record.
	 *
	 * @param data - Record data (id is auto-generated if not provided)
	 * @returns Created record
	 */
	async create(data: CreateInput<T>): Promise<T> {
		await this.ensureCatalogLoaded()

		const ctx: CreateContext<T> = {
			modelName: this.name,
			modelKey: this.modelKey,
			schema: this.schema,
			catalog: this.catalog,
			chunkManager: this.chunkManager,
			catalogLock: catalogLockManager,
			chunkLock: chunkLockManager,
			validator: this.validator,
			serializer: this.serializer,
			hooks: this.hooks,
			persistCatalog: () => this.persistCatalog(),
			uniqueIndexManager: this.uniqueIndexManager,
			namespace: this.namespace
		}

		return executeCreate(ctx, data)
	}

	/**
	 * Find a unique record by ID or unique field.
	 *
	 * @param args - Find arguments with where clause
	 * @returns Found record or null
	 */
	async findUnique(args: FindUniqueArgs<T>): Promise<T | null> {
		await this.ensureCatalogLoaded()

		const ctx: ReadContext<T> = {
			modelName: this.name,
			schema: this.schema,
			catalog: this.catalog,
			chunkManager: this.chunkManager,
			serializer: this.serializer,
			uniqueIndexManager: this.uniqueIndexManager,
			namespace: this.namespace
		}

		return executeFindUnique(ctx, args)
	}

	/**
	 * Update a record.
	 *
	 * @param args - Update arguments with where and data
	 * @returns Updated record or null if not found
	 */
	async update(args: UpdateArgs<T>): Promise<T | null> {
		await this.ensureCatalogLoaded()

		const ctx: UpdateContext<T> = {
			modelName: this.name,
			modelKey: this.modelKey,
			schema: this.schema,
			catalog: this.catalog,
			chunkManager: this.chunkManager,
			chunkLock: chunkLockManager,
			validator: this.validator,
			serializer: this.serializer,
			hooks: this.hooks,
			uniqueIndexManager: this.uniqueIndexManager,
			namespace: this.namespace
		}

		return executeUpdate(ctx, args)
	}

	/**
	 * Delete a record.
	 *
	 * @param args - Delete arguments with where clause
	 * @returns Deleted record or null if not found
	 */
	async delete(args: DeleteArgs<T>): Promise<T | null> {
		await this.ensureCatalogLoaded()

		const ctx: DeleteContext<T> = {
			modelName: this.name,
			modelKey: this.modelKey,
			schema: this.schema,
			catalog: this.catalog,
			chunkManager: this.chunkManager,
			catalogLock: catalogLockManager,
			chunkLock: chunkLockManager,
			serializer: this.serializer,
			hooks: this.hooks,
			persistCatalog: () => this.persistCatalog(),
			uniqueIndexManager: this.uniqueIndexManager,
			namespace: this.namespace
		}

		return executeDelete(ctx, args)
	}

	/**
	 * Find multiple records with filtering, ordering, and pagination.
	 *
	 * @param args - FindMany arguments
	 * @returns Array of matching records
	 */
	async findMany(args?: FindManyArgs<T>): Promise<T[]> {
		await this.ensureCatalogLoaded()

		const ctx: FindManyContext<T> = {
			modelName: this.name,
			schema: this.schema,
			catalog: this.catalog,
			chunkManager: this.chunkManager,
			serializer: this.serializer
		}

		return executeFindMany(ctx, args)
	}

	/**
	 * Find the first matching record.
	 *
	 * @param args - FindFirst arguments
	 * @returns First matching record or null
	 */
	async findFirst(args?: FindFirstArgs<T>): Promise<T | null> {
		await this.ensureCatalogLoaded()

		const ctx: FindManyContext<T> = {
			modelName: this.name,
			schema: this.schema,
			catalog: this.catalog,
			chunkManager: this.chunkManager,
			serializer: this.serializer
		}

		return executeFindFirst(ctx, args)
	}

	/**
	 * Stream records for memory-efficient processing.
	 *
	 * @param args - FindMany arguments
	 * @yields Records one by one
	 */
	async *findManyStream(args?: FindManyArgs<T>): AsyncGenerator<T, void, undefined> {
		await this.ensureCatalogLoaded()

		const ctx: FindManyContext<T> = {
			modelName: this.name,
			schema: this.schema,
			catalog: this.catalog,
			chunkManager: this.chunkManager,
			serializer: this.serializer
		}

		yield* executeFindManyStream(ctx, args)
	}

	// ========================================================================
	// Schema Accessors
	// ========================================================================

	/**
	 * Get the raw schema fields.
	 */
	getSchema(): Map<string, {
		name: string
		type: string
		optional: boolean
		unique: boolean
		indexed: boolean
		primaryKey: boolean
	}> {
		const result = new Map()
		for (const [name, field] of this.schema.fields) {
			result.set(name, {
				name: field.name,
				type: field.type,
				optional: field.optional,
				unique: field.unique,
				indexed: field.indexed,
				primaryKey: field.primaryKey
			})
		}
		return result
	}

	/**
	 * Get indexed field names.
	 */
	getIndexedFields(): string[] {
		return [...this.schema.indexedFields]
	}

	/**
	 * Get unique field names.
	 */
	getUniqueFields(): string[] {
		return [...this.schema.uniqueFields]
	}

	/**
	 * Get relation definitions.
	 */
	getRelations(): RelationDef[] {
		return Array.from(this.schema.relations.values())
	}

	/**
	 * Get the schema checksum.
	 */
	getSchemaChecksum(): string {
		return this.schema.checksum
	}

	/**
	 * Get the record count, optionally with filtering.
	 *
	 * @param args - Optional count arguments with where clause
	 * @returns Count of matching records
	 */
	async count(args?: CountArgs<T>): Promise<number> {
		await this.ensureCatalogLoaded()

		// No filter - use catalog count directly (O(1))
		if (!args?.where) {
			return this.catalog.getCount()
		}

		// With filter - delegate to executeCount
		const ctx: FindManyContext<T> = {
			modelName: this.name,
			schema: this.schema,
			catalog: this.catalog,
			chunkManager: this.chunkManager,
			serializer: this.serializer
		}

		return executeCount(ctx, args)
	}

	// ========================================================================
	// Internal Methods
	// ========================================================================

	/**
	 * Reload catalog from storage.
	 * @internal
	 */
	async _reloadCatalog(): Promise<void> {
		this.catalogLoaded = false
		await this.ensureCatalogLoaded()
	}

	/**
	 * Clear the chunk cache.
	 * @internal
	 */
	_clearCache(): void {
		this.chunkManager.clearCache()
	}

	/**
	 * Get the catalog for testing/debugging.
	 * @internal
	 */
	_getCatalog(): Catalog {
		return this.catalog
	}
}

/**
 * Create a FlashcoreModel instance.
 */
export function createModel<T extends { id: string }>(
	name: string,
	schemaFields: SchemaFields,
	adapter: FlashcoreAdapter,
	options?: FlashcoreModelOptions
): FlashcoreModel<T> {
	return new FlashcoreModel<T>(name, schemaFields, adapter, options)
}
