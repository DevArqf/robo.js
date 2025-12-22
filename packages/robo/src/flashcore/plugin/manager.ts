/**
 * Flashcore v1 Plugin Manager (spec rev 4.3)
 *
 * Manages plugin registration, state, middleware chains, and extensions.
 */

import type { FlashcoreModel } from '../model/model.js'
import type { SchemaFields, NormalizedSchema } from '../schema/types.js'
import type {
	FlashcorePlugin,
	PluginSetupContext,
	ModelInfo,
	PluginMiddleware,
	MiddlewareFn,
	OperationType,
	IndexProvider,
	QueryOperatorFn,
	PluginContext
} from './types.js'
import { logger as flashcoreLogger } from '../core/logger.js'

/**
 * Internal plugin state.
 */
interface PluginState {
	plugin: FlashcorePlugin
	state: Record<string, unknown>
	context: PluginContext
}

/**
 * Custom index registration.
 */
interface CustomIndexRegistration {
	model: string
	field: string
	indexType: string
	provider: IndexProvider
}

/**
 * Plugin Manager - handles plugin lifecycle, middleware, and extensions.
 */
export class PluginManager {
	private plugins: PluginState[] = []
	private middlewareChains = new Map<OperationType, Array<{ plugin: PluginState; fn: MiddlewareFn<OperationType> }>>()
	private indexProviders = new Map<string, IndexProvider>()
	private queryOperators = new Map<string, { plugin: PluginState; fn: QueryOperatorFn }>()
	private customIndexes: CustomIndexRegistration[] = []
	private pendingMarks = new Map<string, Map<string, unknown>>()

	// Model registry access (set during init)
	private getModel?: <T extends { id: string }>(name: string) => FlashcoreModel<T> | undefined
	private registerModelFn?: <T extends { id: string }>(name: string, schema: SchemaFields) => FlashcoreModel<T>
	private models?: Map<string, FlashcoreModel<{ id: string }>>

	/**
	 * Initialize the plugin manager with model access functions.
	 */
	init(options: {
		getModel: <T extends { id: string }>(name: string) => FlashcoreModel<T> | undefined
		registerModel: <T extends { id: string }>(name: string, schema: SchemaFields) => FlashcoreModel<T>
		models: Map<string, FlashcoreModel<{ id: string }>>
	}): void {
		this.getModel = options.getModel
		this.registerModelFn = options.registerModel
		this.models = options.models
	}

	/**
	 * Register a plugin.
	 */
	register(plugin: FlashcorePlugin): void {
		// Check for duplicate plugin names
		if (this.plugins.some((p) => p.plugin.name === plugin.name)) {
			throw new Error(`Plugin '${plugin.name}' is already registered`)
		}

		// Create plugin state
		const state: Record<string, unknown> = {}
		const context: PluginContext = {
			name: plugin.name,
			state,
			methods: plugin.methods ?? {}
		}

		const pluginState: PluginState = {
			plugin,
			state,
			context
		}

		this.plugins.push(pluginState)

		// Register index providers
		if (plugin.indexProviders) {
			for (const [indexType, provider] of Object.entries(plugin.indexProviders)) {
				if (this.indexProviders.has(indexType)) {
					throw new Error(`Index type '${indexType}' is already registered by another plugin`)
				}
				this.indexProviders.set(indexType, provider)
			}
		}

		// Register query operators
		if (plugin.queryOperators) {
			for (const [operator, fn] of Object.entries(plugin.queryOperators)) {
				if (this.queryOperators.has(operator)) {
					throw new Error(`Query operator '${operator}' is already registered by another plugin`)
				}
				this.queryOperators.set(operator, { plugin: pluginState, fn })
			}
		}

		// Register middleware
		if (plugin.middleware) {
			this.registerMiddleware(pluginState, plugin.middleware)
		}

		flashcoreLogger.debug(`Registered plugin: ${plugin.name}`)
	}

	/**
	 * Run setup() for all registered plugins.
	 */
	async setup(): Promise<void> {
		for (const pluginState of this.plugins) {
			if (pluginState.plugin.setup) {
				const ctx = this.createSetupContext<Record<string, unknown>>(pluginState)
				await pluginState.plugin.setup(ctx as PluginSetupContext<Record<string, unknown>>)
				flashcoreLogger.debug(`Plugin setup complete: ${pluginState.plugin.name}`)
			}
		}
	}

	/**
	 * Run setup() for a single plugin.
	 * Used for runtime plugin registration via Flashcore.extend().
	 */
	async setupPlugin(plugin: FlashcorePlugin): Promise<void> {
		const pluginState = this.plugins.find((p) => p.plugin.name === plugin.name)
		if (!pluginState) {
			throw new Error(`Plugin '${plugin.name}' is not registered`)
		}

		if (pluginState.plugin.setup) {
			const ctx = this.createSetupContext<Record<string, unknown>>(pluginState)
			await pluginState.plugin.setup(ctx as PluginSetupContext<Record<string, unknown>>)
			flashcoreLogger.debug(`Plugin setup complete: ${pluginState.plugin.name}`)
		}
	}

	/**
	 * Run shutdown() for all registered plugins.
	 */
	async shutdown(): Promise<void> {
		// Shutdown in reverse order
		for (let i = this.plugins.length - 1; i >= 0; i--) {
			const pluginState = this.plugins[i]
			if (pluginState.plugin.shutdown) {
				try {
					await pluginState.plugin.shutdown.call(pluginState.context)
					flashcoreLogger.debug(`Plugin shutdown complete: ${pluginState.plugin.name}`)
				} catch (error) {
					flashcoreLogger.warn(`Plugin shutdown error (${pluginState.plugin.name}): ${error}`)
				}
			}
		}
	}

	/**
	 * Get all registered plugin names.
	 */
	getPluginNames(): string[] {
		return this.plugins.map((p) => p.plugin.name)
	}

	/**
	 * Get plugin context by name.
	 */
	getPluginContext(name: string): PluginContext | undefined {
		const pluginState = this.plugins.find((p) => p.plugin.name === name)
		return pluginState?.context
	}

	/**
	 * Get client extensions for a plugin.
	 */
	getClientExtensions(name: string): Record<string, unknown> | undefined {
		const pluginState = this.plugins.find((p) => p.plugin.name === name)
		return pluginState?.plugin.clientExtensions as Record<string, unknown> | undefined
	}

	/**
	 * Get all client extensions (for Flashcore.$).
	 */
	getAllClientExtensions(): Record<string, Record<string, unknown>> {
		const extensions: Record<string, Record<string, unknown>> = {}
		for (const pluginState of this.plugins) {
			if (pluginState.plugin.clientExtensions) {
				extensions[pluginState.plugin.name] = pluginState.plugin.clientExtensions as Record<string, unknown>
			}
		}
		return extensions
	}

	/**
	 * Get model extensions from all plugins.
	 */
	getModelExtensions(): Record<string, unknown> {
		const extensions: Record<string, unknown> = {}
		for (const pluginState of this.plugins) {
			if (pluginState.plugin.modelExtensions) {
				Object.assign(extensions, pluginState.plugin.modelExtensions)
			}
		}
		return extensions
	}

	/**
	 * Get middleware chain for an operation.
	 */
	getMiddlewareChain<Op extends OperationType>(
		operation: Op
	): Array<{ plugin: PluginContext; fn: MiddlewareFn<Op> }> {
		const chain = this.middlewareChains.get(operation) ?? []
		return chain.map((entry) => ({
			plugin: entry.plugin.context,
			fn: entry.fn as MiddlewareFn<Op>
		}))
	}

	/**
	 * Check if an operation has middleware.
	 */
	hasMiddleware(operation: OperationType): boolean {
		return (this.middlewareChains.get(operation)?.length ?? 0) > 0
	}

	/**
	 * Get an index provider by type.
	 */
	getIndexProvider(indexType: string): IndexProvider | undefined {
		return this.indexProviders.get(indexType)
	}

	/**
	 * Get a query operator.
	 */
	getQueryOperator(operator: string): { context: PluginContext; fn: QueryOperatorFn } | undefined {
		const entry = this.queryOperators.get(operator)
		if (!entry) return undefined
		return { context: entry.plugin.context, fn: entry.fn }
	}

	/**
	 * Get custom indexes registered for a model.
	 */
	getCustomIndexes(model: string): Array<{ field: string; indexType: string; provider: IndexProvider }> {
		return this.customIndexes
			.filter((idx) => idx.model === model)
			.map((idx) => ({
				field: idx.field,
				indexType: idx.indexType,
				provider: idx.provider
			}))
	}

	/**
	 * Apply pending model marks to a newly registered model.
	 */
	applyPendingMarks(model: FlashcoreModel<{ id: string }>): void {
		const marks = this.pendingMarks.get(model.name)
		if (marks) {
			for (const [key, value] of marks) {
				model.meta[key] = value
			}
			this.pendingMarks.delete(model.name)
		}
	}

	/**
	 * Clear all plugins (for testing).
	 */
	clear(): void {
		this.plugins = []
		this.middlewareChains.clear()
		this.indexProviders.clear()
		this.queryOperators.clear()
		this.customIndexes = []
		this.pendingMarks.clear()
	}

	/**
	 * Register middleware from a plugin.
	 */
	private registerMiddleware(pluginState: PluginState, middleware: PluginMiddleware): void {
		const operations: OperationType[] = [
			'create',
			'update',
			'delete',
			'findUnique',
			'findMany',
			'findFirst',
			'count',
			'createMany',
			'updateMany',
			'deleteMany',
			'upsert'
		]

		for (const op of operations) {
			const fn = middleware[op]
			if (fn) {
				if (!this.middlewareChains.has(op)) {
					this.middlewareChains.set(op, [])
				}
				this.middlewareChains.get(op)!.push({
					plugin: pluginState,
					fn: fn as MiddlewareFn<OperationType>
				})
			}
		}
	}

	/**
	 * Create setup context for a plugin.
	 */
	private createSetupContext<TState>(pluginState: PluginState): PluginSetupContext<TState> {
		const self = this
		return {
			models: this.getModelInfos(),
			state: pluginState.state as TState,

			hasModel(name: string): boolean {
				return self.models?.has(name) ?? false
			},

			getModel<T extends { id: string }>(name: string): FlashcoreModel<T> | undefined {
				return self.getModel?.<T>(name)
			},

			registerModel<T extends { id: string }>(name: string, schema: SchemaFields): FlashcoreModel<T> {
				if (!self.registerModelFn) {
					throw new Error('Model registration not available during plugin setup')
				}
				return self.registerModelFn<T>(name, schema)
			},

			markModel(name: string, key: string, value: unknown): void {
				const model = self.models?.get(name)
				if (model) {
					model.meta[key] = value
				} else {
					// Queue for when model is registered
					if (!self.pendingMarks.has(name)) {
						self.pendingMarks.set(name, new Map())
					}
					self.pendingMarks.get(name)!.set(key, value)
				}
			},

			registerIndex(model: string, field: string, indexType: string): void {
				const provider = self.indexProviders.get(indexType)
				if (!provider) {
					throw new Error(`Unknown index type: ${indexType}`)
				}
				self.customIndexes.push({ model, field, indexType, provider })
			}
		}
	}

	/**
	 * Get model information for setup context.
	 */
	private getModelInfos(): ModelInfo[] {
		if (!this.models) return []

		const infos: ModelInfo[] = []
		for (const model of this.models.values()) {
			const schema = model.schema as NormalizedSchema
			infos.push({
				name: model.name,
				namespace: model.namespace,
				schema,
				fields: Array.from(schema.fields.keys()),
				relations: model.getRelations().map((r) => r.model),
				indexes: model.getIndexedFields()
			})
		}
		return infos
	}
}

/**
 * Global plugin manager instance.
 */
let globalPluginManager: PluginManager | null = null

/**
 * Get the global plugin manager.
 */
export function getPluginManager(): PluginManager | null {
	return globalPluginManager
}

/**
 * Set the global plugin manager.
 */
export function setPluginManager(manager: PluginManager | null): void {
	globalPluginManager = manager
}

/**
 * Create a new plugin manager.
 */
export function createPluginManager(): PluginManager {
	return new PluginManager()
}
