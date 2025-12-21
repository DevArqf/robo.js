/**
 * Flashcore v1 (spec rev 4.3) Model
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
	CountArgs,
	CatalogData
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
import { CuckooFilter, type CuckooFilterData } from '../index/filter.js'
import { SortedIndex, type SortedIndexData } from '../index/sorted.js'
import { getIndexPersistenceManager } from '../index/persistence.js'
import { getWALManager } from '../wal/manager.js'
import { FILTER_KEY_SUFFIX, INDEX_KEY_PREFIX } from '../core/constants.js'

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

	// Index state (Phase 6)
	private _filter: CuckooFilter | null = null
	private _sortedIndexes: Map<string, SortedIndex> = new Map()
	private _indexesLoaded = false
	private _needsRebuild = false

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
			// Catalog.deserialize supports legacy v1 entries (missing `kind`) at runtime.
			// Treat stored catalog data as opaque and let the catalog module handle migration.
			this.catalog = Catalog.deserialize(data as unknown as CatalogData)
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

		// Build index callbacks for derived writes
		const indexCallbacks = await this._buildCreateIndexCallbacks()

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
			namespace: this.namespace,
			wal: getWALManager() ?? undefined,
			indexCallbacks
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

		// Build index callbacks for derived writes
		const indexCallbacks = await this._buildUpdateIndexCallbacks()

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
			namespace: this.namespace,
			persistCatalog: () => this.persistCatalog(),
			wal: getWALManager() ?? undefined,
			indexCallbacks
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

		// Build index callbacks for derived writes
		const indexCallbacks = await this._buildDeleteIndexCallbacks()

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
			namespace: this.namespace,
			wal: getWALManager() ?? undefined,
			indexCallbacks
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
		await this._ensureIndexesLoaded()

		const ctx: FindManyContext<T> = {
			modelName: this.name,
			schema: this.schema,
			catalog: this.catalog,
			chunkManager: this.chunkManager,
			serializer: this.serializer,
			filter: this._filter ?? undefined,
			sortedIndexes: this._sortedIndexes
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
		await this._ensureIndexesLoaded()

		const ctx: FindManyContext<T> = {
			modelName: this.name,
			schema: this.schema,
			catalog: this.catalog,
			chunkManager: this.chunkManager,
			serializer: this.serializer,
			filter: this._filter ?? undefined,
			sortedIndexes: this._sortedIndexes
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
		await this._ensureIndexesLoaded()

		const ctx: FindManyContext<T> = {
			modelName: this.name,
			schema: this.schema,
			catalog: this.catalog,
			chunkManager: this.chunkManager,
			serializer: this.serializer,
			filter: this._filter ?? undefined,
			sortedIndexes: this._sortedIndexes
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

	/**
	 * Get the chunk manager for repair operations.
	 * @internal
	 */
	_getChunkManager(): ChunkManager {
		return this.chunkManager
	}

	/**
	 * Get the adapter for repair operations.
	 * @internal
	 */
	_getAdapter(): FlashcoreAdapter {
		return this.adapter
	}

	// ========================================================================
	// Index Methods (Phase 6)
	// ========================================================================

	/**
	 * Build index callbacks for create operations.
	 * @internal
	 */
	private async _buildCreateIndexCallbacks() {
		await this._ensureIndexesLoaded()

		return {
			addToFilter: (id: string) => {
				if (!this._filter) {
					this._filter = CuckooFilter.empty()
				}
				this._filter.add(id)
			},
			addToSortedIndex: (field: string, value: unknown, id: string) => {
				let index = this._sortedIndexes.get(field)
				if (!index) {
					index = new SortedIndex(field)
					this._sortedIndexes.set(field, index)
				}
				index.insert(value, id)
			},
			markDirty: () => {
				const pm = getIndexPersistenceManager()
				if (pm) {
					pm.markFilterDirty(this.name, this.namespace)
					for (const field of this.schema.indexedFields) {
						pm.markIndexDirty(this.name, field, this.namespace)
					}
				}
			}
		}
	}

	/**
	 * Build index callbacks for update operations.
	 * @internal
	 */
	private async _buildUpdateIndexCallbacks() {
		await this._ensureIndexesLoaded()

		return {
			removeFromSortedIndex: (field: string, value: unknown, id: string) => {
				const index = this._sortedIndexes.get(field)
				if (index) {
					index.remove(value, id)
				}
			},
			addToSortedIndex: (field: string, value: unknown, id: string) => {
				let index = this._sortedIndexes.get(field)
				if (!index) {
					index = new SortedIndex(field)
					this._sortedIndexes.set(field, index)
				}
				index.insert(value, id)
			},
			markDirty: (field?: string) => {
				const pm = getIndexPersistenceManager()
				if (pm) {
					if (field) {
						pm.markIndexDirty(this.name, field, this.namespace)
					} else {
						// Mark all indexed fields
						for (const f of this.schema.indexedFields) {
							pm.markIndexDirty(this.name, f, this.namespace)
						}
					}
				}
			}
		}
	}

	/**
	 * Build index callbacks for delete operations.
	 * @internal
	 */
	private async _buildDeleteIndexCallbacks() {
		await this._ensureIndexesLoaded()

		return {
			removeFromFilter: (id: string) => {
				if (this._filter) {
					this._filter.remove(id)
				}
			},
			removeFromSortedIndex: (field: string, value: unknown, id: string) => {
				const index = this._sortedIndexes.get(field)
				if (index) {
					index.remove(value, id)
				}
			},
			markDirty: () => {
				const pm = getIndexPersistenceManager()
				if (pm) {
					pm.markFilterDirty(this.name, this.namespace)
					for (const field of this.schema.indexedFields) {
						pm.markIndexDirty(this.name, field, this.namespace)
					}
				}
			}
		}
	}

	/**
	 * Get the filter, loading from storage if needed.
	 * @internal
	 */
	async _getFilter(): Promise<CuckooFilter> {
		await this._ensureIndexesLoaded()
		if (!this._filter) {
			// Create empty filter if not loaded
			this._filter = CuckooFilter.empty()
		}
		return this._filter
	}

	/**
	 * Get a sorted index for a field, loading from storage if needed.
	 * Returns null if the field is not indexed.
	 * @internal
	 */
	async _getSortedIndex(field: string): Promise<SortedIndex | null> {
		// Only return indexes for fields marked as indexed in schema
		if (!this.schema.indexedFields.includes(field)) {
			return null
		}

		await this._ensureIndexesLoaded()
		return this._sortedIndexes.get(field) ?? null
	}

	/**
	 * Get all sorted indexes.
	 * @internal
	 */
	async _getSortedIndexes(): Promise<Map<string, SortedIndex>> {
		await this._ensureIndexesLoaded()
		return this._sortedIndexes
	}

	/**
	 * Load indexes from storage.
	 * @internal
	 */
	async _loadIndexes(): Promise<void> {
		if (this._indexesLoaded) {
			return
		}

		// Load filter
		const filterKey = buildModelKey(this.name, FILTER_KEY_SUFFIX, this.namespace)
		const filterData = await this.adapter.get(filterKey)

		if (filterData && typeof filterData === 'object' && 'version' in filterData) {
			try {
				this._filter = CuckooFilter.deserialize(filterData as CuckooFilterData)
			} catch {
				// Invalid filter data - will rebuild on demand
				this._filter = null
				this._needsRebuild = true
			}
		}

		// Load sorted indexes for each indexed field
		for (const field of this.schema.indexedFields) {
			const indexKey = buildModelKey(this.name, `${INDEX_KEY_PREFIX}${field}`, this.namespace)
			const indexData = await this.adapter.get(indexKey)

			if (indexData && typeof indexData === 'object' && 'version' in indexData) {
				try {
					const index = SortedIndex.deserialize(indexData as SortedIndexData)
					this._sortedIndexes.set(field, index)
				} catch {
					// Invalid index data - will rebuild on demand
					this._needsRebuild = true
				}
			}
		}

		this._indexesLoaded = true
	}

	/**
	 * Ensure indexes are loaded from storage.
	 * @internal
	 */
	private async _ensureIndexesLoaded(): Promise<void> {
		if (!this._indexesLoaded) {
			await this._loadIndexes()
		}
	}

	/**
	 * Mark that indexes need rebuilding.
	 * @internal
	 */
	_markNeedsRebuild(): void {
		this._needsRebuild = true
	}

	/**
	 * Check if indexes need rebuilding.
	 * @internal
	 */
	_needsIndexRebuild(): boolean {
		return this._needsRebuild
	}

	/**
	 * Set the filter directly (used by repair/rebuild).
	 * @internal
	 */
	_setFilter(filter: CuckooFilter): void {
		this._filter = filter
		this._needsRebuild = false
	}

	/**
	 * Set a sorted index directly (used by repair/rebuild).
	 * @internal
	 */
	_setSortedIndex(field: string, index: SortedIndex): void {
		this._sortedIndexes.set(field, index)
	}

	/**
	 * Set all sorted indexes directly (used by repair/rebuild).
	 * @internal
	 */
	_setSortedIndexes(indexes: Map<string, SortedIndex>): void {
		this._sortedIndexes = indexes
		this._needsRebuild = false
	}

	/**
	 * Clear all indexes (used by repair/rebuild).
	 * @internal
	 */
	_clearIndexes(): void {
		this._filter = null
		this._sortedIndexes.clear()
		this._indexesLoaded = false
		this._needsRebuild = true
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
