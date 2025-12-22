/**
 * Flashcore v1 Plugin System (spec rev 4.3)
 *
 * Re-exports all plugin system components.
 */

// Types
export type {
	FlashcorePlugin,
	PluginSetupContext,
	ModelInfo,
	PluginMiddleware,
	OperationType,
	MiddlewareFn,
	OperationParams,
	OperationResult,
	PluginContext,
	OperationArgs,
	CreateArgs,
	UpdateArgs,
	DeleteArgs,
	FindUniqueArgs,
	CountArgs,
	CreateManyArgs,
	UpdateManyArgs,
	DeleteManyArgs,
	UpsertArgs,
	IndexProvider,
	IndexOptions,
	Index,
	QueryContext,
	QueryOperatorFn,
	ModelQueryResolver,
	FieldQueryResolver,
	JSONPatch
} from './types.js'

// Manager
export {
	PluginManager,
	getPluginManager,
	setPluginManager,
	createPluginManager
} from './manager.js'

// Middleware
export {
	executeWithMiddleware,
	createLoggingMiddleware,
	createValidationMiddleware,
	createErrorHandlerMiddleware,
	createConditionalMiddleware,
	composeMiddleware,
	forModels,
	forOperations
} from './middleware.js'

// Define factories
export {
	definePlugin,
	defineIndex,
	createSimpleIndex,
	createTrieIndex,
	createFullTextIndex,
	trieIndexProvider,
	fullTextIndexProvider
} from './define.js'

// Context
export {
	getPluginContext,
	hasPlugin,
	getPluginNames,
	createBoundContext,
	applyModelExtensions,
	createClientExtensions,
	wrapModelWithPluginAccess
} from './context.js'

export type { WithPluginExtensions, WithClientExtensions } from './context.js'

// Utilities
export { evaluateWhere, computePatches, applyPatches } from './utils.js'
