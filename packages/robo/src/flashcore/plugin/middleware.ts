/**
 * Flashcore v1 Middleware Pipeline (spec rev 4.3)
 *
 * Executes plugin middleware in Express/Koa style:
 * - Plugins execute in config order
 * - Each middleware can modify args and results
 * - Errors propagate through the stack
 * - Cleanup happens even on error
 */

import type { FlashcoreModel } from '../model/model.js'
import type {
	OperationType,
	OperationParams,
	OperationResult,
	MiddlewareFn,
	PluginContext
} from './types.js'
import { getPluginManager } from './manager.js'
import { logger as flashcoreLogger } from '../core/logger.js'

/**
 * Middleware entry in the chain.
 */
interface MiddlewareEntry<Op extends OperationType> {
	plugin: PluginContext
	fn: MiddlewareFn<Op>
}

/**
 * Execute operation through middleware pipeline.
 *
 * Middleware executes in config order (outermost first/last):
 * 1. Plugin A before
 * 2.   Plugin B before
 * 3.     Actual operation
 * 4.   Plugin B after
 * 5. Plugin A after
 *
 * @param operation - Operation type (create, update, delete, etc.)
 * @param model - The model being operated on
 * @param args - Operation arguments (can be mutated by middleware)
 * @param execute - The actual operation function
 * @returns Operation result (possibly modified by middleware)
 */
export async function executeWithMiddleware<Op extends OperationType>(
	operation: Op,
	model: FlashcoreModel<{ id: string }>,
	args: OperationParams<Op>['args'],
	execute: () => Promise<OperationResult<Op>>
): Promise<OperationResult<Op>> {
	const manager = getPluginManager()
	if (!manager || !manager.hasMiddleware(operation)) {
		// No middleware - execute directly
		return execute()
	}

	const chain = manager.getMiddlewareChain(operation)
	if (chain.length === 0) {
		return execute()
	}

	// Build the middleware chain
	return executeChain(chain, 0, operation, model, args, execute)
}

/**
 * Recursively execute middleware chain.
 */
async function executeChain<Op extends OperationType>(
	chain: Array<MiddlewareEntry<Op>>,
	index: number,
	operation: Op,
	model: FlashcoreModel<{ id: string }>,
	args: OperationParams<Op>['args'],
	execute: () => Promise<OperationResult<Op>>
): Promise<OperationResult<Op>> {
	// If we've exhausted the chain, execute the actual operation
	if (index >= chain.length) {
		return execute()
	}

	const entry = chain[index]

	// Build params for this middleware
	const params: OperationParams<Op> = {
		model,
		operation,
		args,
		context: entry.plugin
	}

	// Build next function that continues the chain
	const next = async (): Promise<OperationResult<Op>> => {
		return executeChain(chain, index + 1, operation, model, args, execute)
	}

	// Execute middleware with bound context (methods available via this)
	const boundFn = entry.fn.bind({
		...entry.plugin.methods,
		state: entry.plugin.state,
		name: entry.plugin.name
	})

	return boundFn(params, next)
}

/**
 * Create a simple middleware that logs operations.
 * Useful for debugging.
 */
export function createLoggingMiddleware(
	logger: (message: string, ...args: unknown[]) => void = (message, ...args) => {
		flashcoreLogger.info(message, ...args)
	}
): MiddlewareFn<OperationType> {
	return async (params, next) => {
		const startTime = Date.now()
		logger(`[Flashcore] ${params.operation} on ${params.model.name}`, params.args)

		try {
			const result = await next()
			const duration = Date.now() - startTime
			logger(`[Flashcore] ${params.operation} complete (${duration}ms)`, result)
			return result
		} catch (error) {
			const duration = Date.now() - startTime
			logger(`[Flashcore] ${params.operation} failed (${duration}ms)`, error)
			throw error
		}
	}
}

/**
 * Create a middleware that validates args before passing to next.
 */
export function createValidationMiddleware(
	validate: (operation: OperationType, args: unknown) => void | never
): MiddlewareFn<OperationType> {
	return async (params, next) => {
		validate(params.operation, params.args)
		return next()
	}
}

/**
 * Compose multiple middleware functions into one.
 */
export function composeMiddleware<Op extends OperationType>(
	...middlewares: Array<MiddlewareFn<Op>>
): MiddlewareFn<Op> {
	if (middlewares.length === 0) {
		return async (_, next) => next()
	}

	if (middlewares.length === 1) {
		return middlewares[0]
	}

	return async (params, next) => {
		// Build the chain in reverse (so first middleware is outermost)
		let chain = next
		for (let i = middlewares.length - 1; i >= 0; i--) {
			const middleware = middlewares[i]
			const prevChain = chain
			chain = () => middleware(params, prevChain)
		}
		return chain()
	}
}

/**
 * Create a middleware that wraps the operation in a try-catch.
 * Useful for error handling/transformation.
 */
export function createErrorHandlerMiddleware(
	handler: (error: unknown, params: OperationParams<OperationType>) => unknown | never
): MiddlewareFn<OperationType> {
	return async (params, next) => {
		try {
			return await next()
		} catch (error) {
			const result = handler(error, params)
			if (result !== undefined) {
				return result as OperationResult<OperationType>
			}
			throw error
		}
	}
}

/**
 * Create a middleware that conditionally executes based on model name.
 */
export function createConditionalMiddleware<Op extends OperationType>(
	condition: (params: OperationParams<Op>) => boolean,
	middleware: MiddlewareFn<Op>
): MiddlewareFn<Op> {
	return async (params, next) => {
		if (condition(params)) {
			return middleware(params, next)
		}
		return next()
	}
}

/**
 * Create a middleware that only runs for specific models.
 */
export function forModels<Op extends OperationType>(
	modelNames: string[],
	middleware: MiddlewareFn<Op>
): MiddlewareFn<Op> {
	const modelSet = new Set(modelNames)
	return createConditionalMiddleware((params) => modelSet.has(params.model.name), middleware)
}

/**
 * Create a middleware that only runs for specific operations.
 */
export function forOperations<Op extends OperationType>(
	operations: OperationType[],
	middleware: MiddlewareFn<Op>
): MiddlewareFn<Op> {
	const opSet = new Set(operations)
	return createConditionalMiddleware((params) => opSet.has(params.operation), middleware)
}
