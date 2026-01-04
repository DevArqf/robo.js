/**
 * Flashcore v1 Plugin Context (spec rev 4.3)
 *
 * Manages plugin contexts for models, providing access to
 * plugin state and methods from within model operations.
 */

import type { PluginContext, FlashcorePlugin } from './types.js'
import { getPluginManager } from './manager.js'

/**
 * Get plugin context for a model.
 *
 * Used by model.pluginContext(pluginName) to access plugin state and methods.
 *
 * @param pluginName - Name of the plugin
 * @returns Plugin context or throws if plugin not found
 */
export function getPluginContext(pluginName: string): PluginContext {
	const manager = getPluginManager()
	if (!manager) {
		throw new Error(`Plugin '${pluginName}' not found (no plugin manager)`)
	}

	const context = manager.getPluginContext(pluginName)
	if (!context) {
		throw new Error(`Plugin '${pluginName}' not found`)
	}

	return context
}

/**
 * Check if a plugin is registered.
 *
 * @param pluginName - Name of the plugin
 * @returns True if plugin is registered
 */
export function hasPlugin(pluginName: string): boolean {
	const manager = getPluginManager()
	if (!manager) return false
	return manager.getPluginContext(pluginName) !== undefined
}

/**
 * Get all registered plugin names.
 *
 * @returns Array of plugin names
 */
export function getPluginNames(): string[] {
	const manager = getPluginManager()
	if (!manager) return []
	return manager.getPluginNames()
}

/**
 * Create a bound context for a plugin that can be used in middleware.
 *
 * This creates an object with the plugin's methods bound to the plugin context,
 * allowing middleware to use `this.methodName()` syntax.
 *
 * @param context - Plugin context
 * @returns Bound context object
 */
export function createBoundContext(context: PluginContext): Record<string, unknown> & PluginContext {
	const bound: Record<string, unknown> = {
		name: context.name,
		state: context.state,
		methods: context.methods
	}

	// Bind all methods to the context
	for (const [name, method] of Object.entries(context.methods)) {
		if (typeof method === 'function') {
			bound[name] = method.bind(bound)
		}
	}

	return bound as Record<string, unknown> & PluginContext
}

/**
 * Apply model extensions from all plugins to a model instance.
 *
 * This is called when a model is created to add plugin-provided methods.
 *
 * @param model - The model instance to extend
 * @returns The extended model (same reference, mutated)
 */
export function applyModelExtensions<T extends object>(model: T): T {
	const manager = getPluginManager()
	if (!manager) return model

	const extensions = manager.getModelExtensions()
	if (Object.keys(extensions).length === 0) return model

	// Add each extension method to the model
	for (const [name, method] of Object.entries(extensions)) {
		if (typeof method === 'function') {
			// Bind the method to the model instance
			;(model as Record<string, unknown>)[name] = method.bind(model)
		}
	}

	return model
}

/**
 * Create client extensions object for Flashcore.$.
 *
 * Returns an object where each plugin's client extensions are
 * namespaced under the plugin name.
 *
 * @example
 * ```typescript
 * // If audit plugin has clientExtensions: { history() }
 * // Then Flashcore.$.audit.history() is available
 * ```
 */
export function createClientExtensions(): Record<string, Record<string, unknown>> {
	const manager = getPluginManager()
	if (!manager) return {}

	return manager.getAllClientExtensions()
}

/**
 * Wrap a model proxy to include plugin context access.
 *
 * This allows models to access plugin contexts via model.pluginContext(name).
 */
export function wrapModelWithPluginAccess<T extends { id: string }>(
	model: T & { pluginContext?: (name: string) => PluginContext }
): T & { pluginContext: (name: string) => PluginContext } {
	// Add pluginContext method if not already present
	if (!model.pluginContext) {
		;(model as unknown as { pluginContext: (name: string) => PluginContext }).pluginContext = getPluginContext
	}

	return model as T & { pluginContext: (name: string) => PluginContext }
}

/**
 * Plugin extension type helper.
 *
 * Use this to type model instances that have plugin extensions.
 *
 * @example
 * ```typescript
 * type UserWithPlugins = WithPluginExtensions<User, typeof softDelete & typeof realtime>
 * ```
 */
export type WithPluginExtensions<TModel, TPlugins extends FlashcorePlugin<unknown, unknown, unknown>> =
	TModel & TPlugins['modelExtensions']

/**
 * Client extension type helper.
 *
 * Use this to type Flashcore.$ with plugin client extensions.
 *
 * @example
 * ```typescript
 * type FlashcoreWithAudit = WithClientExtensions<typeof Flashcore.$, typeof auditPlugin>
 * // Flashcore.$.audit.history() is now typed
 * ```
 */
export type WithClientExtensions<
	TClient,
	TPlugins extends FlashcorePlugin<unknown, unknown, unknown>
> = TClient & {
	[K in TPlugins['name']]: TPlugins['clientExtensions']
}
