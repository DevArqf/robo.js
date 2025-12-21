/**
 * Flashcore v4.3 KV Client
 *
 * Provides the main Flashcore API for key-value operations.
 * Handles backward compatibility with legacy key formats.
 */

import type { FlashcoreGetOptions, FlashcoreKVOptions, WatcherCallback } from '../adapter/types.js'
import { composeLegacyKey, composeV4Key, normalizeNamespace, validateNotReserved } from './keys.js'
import { FlashcoreSystem } from './system.js'

/**
 * Watchers registry for KV change notifications.
 * Keys are composed storage keys.
 */
const watchers = new Map<string, Set<WatcherCallback>>()

/**
 * Get the composed key(s) for a logical KV key.
 *
 * Returns both legacy and v4 physical keys based on current config.
 */
function getPhysicalKeys(
	key: string,
	namespace?: string | string[]
): { legacy: string; v4: string } {
	const config = FlashcoreSystem.config
	const separator = config.namespaceSeparator ?? '/'
	const ns = normalizeNamespace(namespace, separator)

	return {
		legacy: composeLegacyKey(key, ns, separator),
		v4: composeV4Key(key, ns)
	}
}

/**
 * Resolve a value from storage using dual-key resolution.
 *
 * Checks preferred key first, then falls back to the other.
 */
async function resolveValue<V>(
	legacyKey: string,
	v4Key: string
): Promise<V | undefined> {
	const adapter = FlashcoreSystem.adapter
	const preference = FlashcoreSystem.config.kvReadPreference ?? 'legacy'

	if (preference === 'legacy') {
		// Try legacy key first
		const value = await adapter.get(legacyKey)
		if (value !== undefined) {
			return value as V
		}
		// Fall back to v4 key
		return adapter.get(v4Key) as Promise<V | undefined>
	} else {
		// Try v4 key first
		const value = await adapter.get(v4Key)
		if (value !== undefined) {
			return value as V
		}
		// Fall back to legacy key
		return adapter.get(legacyKey) as Promise<V | undefined>
	}
}

/**
 * Check if a value exists using dual-key resolution.
 */
async function hasValue(legacyKey: string, v4Key: string): Promise<boolean> {
	const adapter = FlashcoreSystem.adapter
	const preference = FlashcoreSystem.config.kvReadPreference ?? 'legacy'

	if (preference === 'legacy') {
		if (await adapter.has(legacyKey)) return true
		return adapter.has(v4Key)
	} else {
		if (await adapter.has(v4Key)) return true
		return adapter.has(legacyKey)
	}
}

/**
 * Write a value using the configured write mode.
 */
async function writeValue<V>(
	legacyKey: string,
	v4Key: string,
	value: V
): Promise<boolean> {
	const adapter = FlashcoreSystem.adapter
	const writeMode = FlashcoreSystem.config.kvWriteMode ?? 'legacy'

	switch (writeMode) {
		case 'legacy':
			return adapter.set(legacyKey, value)

		case 'v4':
			return adapter.set(v4Key, value)

		case 'dual':
			// Write to both keys
			const [legacyResult, v4Result] = await Promise.all([
				adapter.set(legacyKey, value),
				adapter.set(v4Key, value)
			])
			return legacyResult && v4Result

		default:
			return adapter.set(legacyKey, value)
	}
}

/**
 * Delete a value from BOTH physical keys.
 *
 * Always deletes both to prevent "ghost values" from surviving
 * under the non-preferred key.
 */
async function deleteValue(legacyKey: string, v4Key: string): Promise<boolean> {
	const adapter = FlashcoreSystem.adapter

	// Delete both keys regardless of write mode
	const [legacyResult, v4Result] = await Promise.all([
		adapter.delete(legacyKey),
		adapter.delete(v4Key)
	])

	// Return true if either key existed
	return legacyResult || v4Result
}

/**
 * Fire watchers for a key change.
 */
function fireWatchers<V>(key: string, oldValue: V | undefined, newValue: V | undefined): void {
	const keyWatchers = watchers.get(key)
	if (keyWatchers) {
		for (const callback of keyWatchers) {
			// Fire asynchronously to avoid blocking
			Promise.resolve().then(() => callback(oldValue, newValue)).catch(console.error)
		}
	}
}

/**
 * Flashcore v4.3 Client
 *
 * Provides the main API for key-value operations with backward
 * compatibility for existing Robo.js projects.
 */
const FlashcoreBase = {
	/**
	 * Get a value by key.
	 *
	 * @param key - The key to retrieve
	 * @param options - Options including namespace and default value
	 * @returns The value, default, or undefined
	 */
	async get<V>(key: string, options?: FlashcoreGetOptions): Promise<V | undefined> {
		const { legacy, v4 } = getPhysicalKeys(key, options?.namespace)
		const value = await resolveValue<V>(legacy, v4)

		// Return default if value is undefined
		// This fixes the async adapter bug in the original implementation
		if (value === undefined && options?.default !== undefined) {
			return options.default as V
		}

		return value
	},

	/**
	 * Set a key-value pair.
	 *
	 * Supports both direct values and updater functions.
	 *
	 * @param key - The key to set
	 * @param value - The value or updater function
	 * @param options - Options including namespace
	 * @returns True if successful
	 */
	async set<V>(
		key: string,
		value: V | ((oldValue: V | undefined) => V),
		options?: FlashcoreKVOptions
	): Promise<boolean> {
		const { legacy, v4 } = getPhysicalKeys(key, options?.namespace)
		const preference = FlashcoreSystem.config.kvReadPreference ?? 'legacy'
		const primaryKey = preference === 'legacy' ? legacy : v4

		// Validate not a reserved prefix
		validateNotReserved(primaryKey, 'set')

		// Handle updater function
		let newValue: V
		let oldValue: V | undefined

		if (typeof value === 'function') {
			const updater = value as (oldValue: V | undefined) => V
			oldValue = await resolveValue<V>(legacy, v4)
			newValue = updater(oldValue)
		} else {
			newValue = value
			// Only fetch old value if we have watchers
			if (watchers.has(primaryKey)) {
				oldValue = await resolveValue<V>(legacy, v4)
			}
		}

		// Write the value
		const result = await writeValue(legacy, v4, newValue)

		// Fire watchers
		if (result) {
			fireWatchers(primaryKey, oldValue, newValue)
		}

		return result
	},

	/**
	 * Delete a key.
	 *
	 * Removes the key from BOTH legacy and v4 physical keys to prevent
	 * ghost values from surviving under the non-preferred key.
	 *
	 * @param key - The key to delete
	 * @param options - Options including namespace
	 * @returns True if the key existed
	 */
	async delete(key: string, options?: FlashcoreKVOptions): Promise<boolean> {
		const { legacy, v4 } = getPhysicalKeys(key, options?.namespace)
		const preference = FlashcoreSystem.config.kvReadPreference ?? 'legacy'
		const primaryKey = preference === 'legacy' ? legacy : v4

		// Validate not a reserved prefix
		validateNotReserved(primaryKey, 'delete')

		// Get old value for watchers if needed
		let oldValue: unknown
		if (watchers.has(primaryKey)) {
			oldValue = await resolveValue(legacy, v4)
		}

		// Delete from both keys
		const result = await deleteValue(legacy, v4)

		// Fire watchers with undefined as new value
		if (result) {
			fireWatchers(primaryKey, oldValue, undefined)
		}

		return result
	},

	/**
	 * Check if a key exists.
	 *
	 * Returns true even for falsy stored values (0, false, '', null).
	 * This fixes the truthiness bug in the original implementation.
	 *
	 * @param key - The key to check
	 * @param options - Options including namespace
	 * @returns True if the key exists
	 */
	async has(key: string, options?: FlashcoreKVOptions): Promise<boolean> {
		const { legacy, v4 } = getPhysicalKeys(key, options?.namespace)
		return hasValue(legacy, v4)
	},

	/**
	 * Clear all data from the store.
	 *
	 * @returns True if successful
	 */
	async clear(): Promise<boolean | void> {
		const adapter = FlashcoreSystem.adapter
		const result = await adapter.clear()

		// Clear all watchers
		watchers.clear()

		return result
	},

	/**
	 * Register a watcher for key changes.
	 *
	 * The callback receives (oldValue, newValue) for compatibility
	 * with existing code.
	 *
	 * @param key - The key to watch
	 * @param callback - Callback function (oldValue, newValue)
	 * @param options - Options including namespace
	 */
	on<V = unknown>(
		key: string,
		callback: WatcherCallback<V>,
		options?: FlashcoreKVOptions
	): void {
		const { legacy, v4 } = getPhysicalKeys(key, options?.namespace)
		const preference = FlashcoreSystem.config?.kvReadPreference ?? 'legacy'
		const primaryKey = preference === 'legacy' ? legacy : v4

		if (!watchers.has(primaryKey)) {
			watchers.set(primaryKey, new Set())
		}

		watchers.get(primaryKey)!.add(callback as WatcherCallback)
	},

	/**
	 * Unregister a watcher for key changes.
	 *
	 * If no callback is provided, all watchers for the key are removed.
	 *
	 * @param key - The key to stop watching
	 * @param callback - Optional specific callback to remove
	 * @param options - Options including namespace
	 */
	off<V = unknown>(
		key: string,
		callback?: WatcherCallback<V>,
		options?: FlashcoreKVOptions
	): void {
		const { legacy, v4 } = getPhysicalKeys(key, options?.namespace)
		const preference = FlashcoreSystem.config?.kvReadPreference ?? 'legacy'
		const primaryKey = preference === 'legacy' ? legacy : v4

		if (!watchers.has(primaryKey)) {
			return
		}

		if (callback) {
			watchers.get(primaryKey)!.delete(callback as WatcherCallback)

			// Clean up empty sets
			if (watchers.get(primaryKey)!.size === 0) {
				watchers.delete(primaryKey)
			}
		} else {
			// Remove all watchers for this key
			watchers.delete(primaryKey)
		}
	},

	/**
	 * System API for initialization, configuration, and introspection.
	 */
	$: FlashcoreSystem
}

/**
 * Proxy wrapper to enable dynamic model access on Flashcore.
 *
 * Allows accessing models via `Flashcore.modelName` for convenience.
 * Example: `Flashcore.user.findUnique({ where: { id } })`
 */
export const Flashcore = new Proxy(FlashcoreBase, {
	get(target, prop, receiver) {
		// Check if property exists on the base object
		if (prop in target) {
			return Reflect.get(target, prop, receiver)
		}

		// Check if it's a registered model
		if (typeof prop === 'string') {
			const model = FlashcoreSystem.getModel(prop)
			if (model) {
				return model
			}
		}

		return undefined
	}
})

/**
 * Type helper for the Flashcore client.
 */
export type FlashcoreClient = typeof FlashcoreBase & {
	[modelName: string]: unknown
}
