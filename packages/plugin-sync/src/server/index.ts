// Server-side exports for @robojs/sync/server
export { SyncServer } from '../core/server.js'

// Handler registration (used by build system)
export { registerHandler, registerMiddleware, clearHandlers, getHandlerCount, getMiddlewareCount } from './handlers.js'

// Types for handler authors
export type {
	// Context types
	SyncUpdateContext,
	SyncMiddlewareContext,
	SyncCallContext,
	HandlerClient,

	// Handler function types
	ValidateHandler,
	TransformHandler,
	OnUpdateHandler,
	MiddlewareBeforeHandler,
	MiddlewareAfterHandler,
	CallHandler,
	MiddlewareResult,

	// Module types
	SyncHandlerModule,
	SyncMiddlewareModule,
	SyncHandlerRecord,
	SyncMiddlewareRecord,

	// Schema types
	BuiltInSchema,
	SchemaField,
	SchemaValidationResult
} from './types.js'
