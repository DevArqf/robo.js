/**
 * Flashcore v1 Plugin System Types (spec rev 4.3)
 *
 * Defines interfaces for the plugin system including middleware,
 * extensions, custom indexes, and query operators.
 */

import type { FlashcoreModel } from '../model/model.js'
import type { SchemaFields, FindManyArgs, NormalizedSchema } from '../schema/types.js'

// ============================================================================
// Plugin Core Interface
// ============================================================================

/**
 * Flashcore plugin definition.
 *
 * Plugins can extend Flashcore with:
 * - Middleware that intercepts CRUD operations
 * - Model extensions (methods added to all models)
 * - Client extensions (methods under Flashcore.$.{pluginName})
 * - Custom index providers (trie, fulltext, geo, etc.)
 * - Custom query operators
 */
export interface FlashcorePlugin<
	TClientExtensions = Record<string, unknown>,
	TModelExtensions = Record<string, unknown>,
	TState = Record<string, unknown>
> {
	/**
	 * Plugin name - used as namespace for client extensions.
	 * e.g., name: 'audit' → Flashcore.$.audit.*
	 */
	readonly name: string

	/**
	 * Called once when plugin is applied during Flashcore.$.init().
	 * Use to set up state, mark models with metadata, register indexes.
	 */
	setup?(ctx: PluginSetupContext<TState>): void | Promise<void>

	/**
	 * Called during Flashcore shutdown.
	 * Use to clean up resources (timers, subscriptions, etc.).
	 */
	shutdown?(): void | Promise<void>

	/**
	 * Model extensions - methods added directly to all models.
	 * e.g., user.restore(), user.subscribe()
	 */
	modelExtensions?: TModelExtensions & ThisType<FlashcoreModel<{ id: string }> & TModelExtensions>

	/**
	 * Client extensions - methods under Flashcore.$.{pluginName}.
	 * e.g., Flashcore.$.audit.history()
	 */
	clientExtensions?: TClientExtensions

	/**
	 * Middleware hooks - intercept CRUD operations.
	 */
	middleware?: PluginMiddleware

	/**
	 * Custom index providers (trie, fulltext, geo, etc.).
	 */
	indexProviders?: Record<string, IndexProvider>

	/**
	 * Custom query operators that work with custom indexes.
	 */
	queryOperators?: Record<string, QueryOperatorFn>

	/**
	 * Model-level query resolvers for complete control over query execution.
	 */
	queryResolvers?: Record<string, ModelQueryResolver>

	/**
	 * Private plugin methods - available via `this` in middleware.
	 */
	methods?: Record<string, (...args: unknown[]) => unknown>
}

// ============================================================================
// Plugin Setup Context
// ============================================================================

/**
 * Context passed to plugin setup() function.
 */
export interface PluginSetupContext<TState = Record<string, unknown>> {
	/**
	 * Information about all registered models.
	 */
	readonly models: ModelInfo[]

	/**
	 * Plugin state - persists across middleware calls.
	 * Initialized as empty object, can be mutated by plugin.
	 */
	state: TState

	/**
	 * Check if a model with the given name is registered.
	 */
	hasModel(name: string): boolean

	/**
	 * Get a model by name.
	 */
	getModel<T extends { id: string }>(name: string): FlashcoreModel<T> | undefined

	/**
	 * Register a new model (for plugins that create helper models, like audit).
	 */
	registerModel<T extends { id: string }>(name: string, schema: SchemaFields): FlashcoreModel<T>

	/**
	 * Mark a model with metadata (accessible via model.meta).
	 */
	markModel(name: string, key: string, value: unknown): void

	/**
	 * Register a custom index for a field.
	 */
	registerIndex(model: string, field: string, indexType: string): void
}

/**
 * Model information available in setup context.
 */
export interface ModelInfo {
	name: string
	namespace?: string
	schema: NormalizedSchema
	fields: string[]
	relations: string[]
	indexes: string[]
}

// ============================================================================
// Middleware Types
// ============================================================================

/**
 * Middleware hooks for each operation type.
 */
export interface PluginMiddleware {
	create?: MiddlewareFn<'create'>
	update?: MiddlewareFn<'update'>
	delete?: MiddlewareFn<'delete'>
	findUnique?: MiddlewareFn<'findUnique'>
	findMany?: MiddlewareFn<'findMany'>
	findFirst?: MiddlewareFn<'findFirst'>
	count?: MiddlewareFn<'count'>
	createMany?: MiddlewareFn<'createMany'>
	updateMany?: MiddlewareFn<'updateMany'>
	deleteMany?: MiddlewareFn<'deleteMany'>
	upsert?: MiddlewareFn<'upsert'>
}

/**
 * Operation types that can be intercepted by middleware.
 */
export type OperationType =
	| 'create'
	| 'update'
	| 'delete'
	| 'findUnique'
	| 'findMany'
	| 'findFirst'
	| 'count'
	| 'createMany'
	| 'updateMany'
	| 'deleteMany'
	| 'upsert'

/**
 * Middleware function signature - Express/Koa style.
 *
 * @param params - Operation parameters including model and args
 * @param next - Call to invoke next middleware or actual operation
 */
export type MiddlewareFn<Op extends OperationType> = (
	params: OperationParams<Op>,
	next: () => Promise<OperationResult<Op>>
) => Promise<OperationResult<Op>>

/**
 * Parameters passed to middleware functions.
 */
export interface OperationParams<Op extends OperationType> {
	/**
	 * The model being operated on.
	 */
	model: FlashcoreModel<{ id: string }>

	/**
	 * The operation type.
	 */
	operation: Op

	/**
	 * Operation arguments (mutable - can be modified by middleware).
	 */
	args: OperationArgs<Op>

	/**
	 * Plugin context for accessing state and methods.
	 */
	context: PluginContext
}

/**
 * Plugin context available in middleware and extensions.
 */
export interface PluginContext {
	/**
	 * Plugin name.
	 */
	name: string

	/**
	 * Plugin state.
	 */
	state: Record<string, unknown>

	/**
	 * Plugin methods.
	 */
	methods: Record<string, (...args: unknown[]) => unknown>
}

/**
 * Operation arguments by type.
 */
export type OperationArgs<Op extends OperationType> = Op extends 'create'
	? CreateArgs
	: Op extends 'update'
		? UpdateArgs
		: Op extends 'delete'
			? DeleteArgs
			: Op extends 'findUnique'
				? FindUniqueArgs
				: Op extends 'findMany'
					? FindManyArgs<{ id: string }>
					: Op extends 'findFirst'
						? FindManyArgs<{ id: string }>
						: Op extends 'count'
							? CountArgs
							: Op extends 'createMany'
								? CreateManyArgs
								: Op extends 'updateMany'
									? UpdateManyArgs
									: Op extends 'deleteMany'
										? DeleteManyArgs
										: Op extends 'upsert'
											? UpsertArgs
											: never

/**
 * Operation result by type.
 */
export type OperationResult<Op extends OperationType> = Op extends 'create'
	? { id: string }
	: Op extends 'update'
		? { id: string } | null
		: Op extends 'delete'
			? { id: string } | null
			: Op extends 'findUnique'
				? { id: string } | null
				: Op extends 'findMany'
					? Array<{ id: string }>
					: Op extends 'findFirst'
						? { id: string } | null
						: Op extends 'count'
							? number
							: Op extends 'createMany'
								? { records: Array<{ id: string }>; count: number }
								: Op extends 'updateMany'
									? { count: number }
									: Op extends 'deleteMany'
										? { count: number }
										: Op extends 'upsert'
											? { id: string }
											: never

// Operation argument types
export interface CreateArgs {
	data: Record<string, unknown>
}

export interface UpdateArgs {
	where: Record<string, unknown>
	data: Record<string, unknown>
}

export interface DeleteArgs {
	where: Record<string, unknown>
}

export interface FindUniqueArgs {
	where: Record<string, unknown>
	include?: Record<string, boolean | object>
}

export interface CountArgs {
	where?: Record<string, unknown>
}

export interface CreateManyArgs {
	data: Array<Record<string, unknown>>
	skipDuplicates?: boolean
}

export interface UpdateManyArgs {
	where?: Record<string, unknown>
	data: Record<string, unknown>
}

export interface DeleteManyArgs {
	where?: Record<string, unknown>
}

export interface UpsertArgs {
	where: Record<string, unknown>
	create: Record<string, unknown>
	update: Record<string, unknown>
}

// ============================================================================
// Custom Index Types
// ============================================================================

/**
 * Custom index provider - creates and manages indexes.
 */
export interface IndexProvider<T = unknown> {
	/**
	 * Create a new index instance.
	 */
	create(options?: IndexOptions): Index<T>

	/**
	 * Query operators supported by this index.
	 */
	operators: string[]
}

/**
 * Options for creating a custom index.
 */
export interface IndexOptions {
	/**
	 * Model name the index belongs to.
	 */
	model?: string

	/**
	 * Field name being indexed.
	 */
	field?: string

	/**
	 * Custom options from indexedWith() call.
	 */
	[key: string]: unknown
}

/**
 * Custom index instance - manages indexed data.
 */
export interface Index<T = unknown> {
	/**
	 * Insert a value into the index.
	 */
	insert(id: string, value: T): void

	/**
	 * Update a value in the index.
	 */
	update(id: string, oldValue: T, newValue: T): void

	/**
	 * Remove a value from the index.
	 */
	remove(id: string, value: T): void

	/**
	 * Clear all entries from the index.
	 */
	clear(): void

	/**
	 * Query the index - returns matching IDs.
	 */
	query(operator: string, operand: unknown): string[]

	/**
	 * Serialize index for persistence.
	 */
	serialize(): unknown

	/**
	 * Deserialize index from persisted data.
	 */
	deserialize(data: unknown): void
}

/**
 * Context passed to custom query operators.
 */
export interface QueryContext {
	/**
	 * The model being queried.
	 */
	model: FlashcoreModel<{ id: string }>

	/**
	 * The plugin that provides this operator.
	 */
	plugin: PluginContext

	/**
	 * Field being queried.
	 */
	field: string

	/**
	 * Custom index for the field (if any).
	 */
	index?: Index<unknown>
}

/**
 * Custom query operator function.
 */
export type QueryOperatorFn = (
	index: Index<unknown> | undefined,
	operand: unknown,
	context: QueryContext
) => string[] | Promise<string[]>

// ============================================================================
// Query Resolver Types
// ============================================================================

/**
 * Model-level query resolver for complete control over queries.
 */
export interface ModelQueryResolver {
	/**
	 * Called before default query resolution.
	 * Can modify args or short-circuit.
	 */
	beforeResolve?(args: FindManyArgs<{ id: string }>): FindManyArgs<{ id: string }> | Promise<FindManyArgs<{ id: string }>>

	/**
	 * Replace default resolution entirely.
	 * Returns IDs of matching records.
	 */
	resolve?(args: FindManyArgs<{ id: string }>): string[] | Promise<string[]>

	/**
	 * Called after default resolution.
	 * Can filter or reorder results.
	 */
	afterResolve?(ids: string[], args: FindManyArgs<{ id: string }>): string[] | Promise<string[]>

	/**
	 * Field-specific resolvers.
	 */
	fields?: Record<string, FieldQueryResolver>
}

/**
 * Field-level query resolver for specific operators.
 */
export interface FieldQueryResolver {
	/**
	 * Handle specific operators for this field.
	 * Returns matching IDs or null to fall through to default.
	 */
	resolve(operator: string, operand: unknown, context: QueryContext): string[] | null | Promise<string[] | null>
}

// ============================================================================
// JSON Patch Types (RFC 6902)
// ============================================================================

/**
 * JSON Patch operation (RFC 6902).
 */
export interface JSONPatch {
	op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test'
	path: string
	value?: unknown
	from?: string
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type { FindManyArgs } from '../schema/types.js'
