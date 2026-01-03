/**
 * Flashcore v1 (spec rev 4.3) Model Hooks
 *
 * Lifecycle hooks for model operations.
 */

import type { ModelHooks } from '../schema/types.js'

/**
 * Hook execution context.
 */
export interface HookContext<T = unknown> {
	model: string
	operation: 'create' | 'update' | 'delete'
	data?: unknown
	existing?: T
	record?: T
}

/**
 * Execute before-create hook.
 *
 * @param hooks - Model hooks
 * @param data - Input data
 * @returns Possibly modified data
 */
export async function executeBeforeCreate<T>(
	hooks: ModelHooks<T> | undefined,
	data: unknown
): Promise<unknown> {
	if (!hooks?.beforeCreate) {
		return data
	}

	const result = await hooks.beforeCreate(data)
	return result ?? data
}

/**
 * Execute after-create hook.
 *
 * @param hooks - Model hooks
 * @param record - Created record
 */
export async function executeAfterCreate<T>(
	hooks: ModelHooks<T> | undefined,
	record: T
): Promise<void> {
	if (!hooks?.afterCreate) {
		return
	}

	await hooks.afterCreate(record)
}

/**
 * Execute before-update hook.
 *
 * @param hooks - Model hooks
 * @param data - Update data
 * @param existing - Existing record
 * @returns Possibly modified data
 */
export async function executeBeforeUpdate<T>(
	hooks: ModelHooks<T> | undefined,
	data: unknown,
	existing: T
): Promise<unknown> {
	if (!hooks?.beforeUpdate) {
		return data
	}

	const result = await hooks.beforeUpdate(data, existing)
	return result ?? data
}

/**
 * Execute after-update hook.
 *
 * @param hooks - Model hooks
 * @param record - Updated record
 */
export async function executeAfterUpdate<T>(
	hooks: ModelHooks<T> | undefined,
	record: T
): Promise<void> {
	if (!hooks?.afterUpdate) {
		return
	}

	await hooks.afterUpdate(record)
}

/**
 * Execute before-delete hook.
 *
 * @param hooks - Model hooks
 * @param record - Record about to be deleted
 */
export async function executeBeforeDelete<T>(
	hooks: ModelHooks<T> | undefined,
	record: T
): Promise<void> {
	if (!hooks?.beforeDelete) {
		return
	}

	await hooks.beforeDelete(record)
}

/**
 * Execute after-delete hook.
 *
 * @param hooks - Model hooks
 * @param record - Deleted record
 */
export async function executeAfterDelete<T>(
	hooks: ModelHooks<T> | undefined,
	record: T
): Promise<void> {
	if (!hooks?.afterDelete) {
		return
	}

	await hooks.afterDelete(record)
}

/**
 * Validate hooks object structure.
 *
 * @param hooks - Hooks to validate
 * @throws Error if hooks are invalid
 */
export function validateHooks<T>(hooks: unknown): asserts hooks is ModelHooks<T> | undefined {
	if (hooks === undefined || hooks === null) {
		return
	}

	if (typeof hooks !== 'object') {
		throw new Error('Hooks must be an object')
	}

	const validHookNames = [
		'beforeCreate',
		'afterCreate',
		'beforeUpdate',
		'afterUpdate',
		'beforeDelete',
		'afterDelete'
	]

	const hookObj = hooks as Record<string, unknown>

	for (const [name, value] of Object.entries(hookObj)) {
		if (!validHookNames.includes(name)) {
			throw new Error(`Unknown hook: ${name}. Valid hooks are: ${validHookNames.join(', ')}`)
		}

		if (typeof value !== 'function') {
			throw new Error(`Hook ${name} must be a function`)
		}
	}
}

/**
 * Merge hook objects.
 *
 * Later hooks wrap earlier hooks.
 *
 * @param hooksList - List of hooks to merge
 * @returns Merged hooks
 */
export function mergeHooks<T>(
	...hooksList: Array<ModelHooks<T> | undefined>
): ModelHooks<T> {
	const result: ModelHooks<T> = {}

	for (const hooks of hooksList) {
		if (!hooks) continue

		if (hooks.beforeCreate) {
			const existing = result.beforeCreate
			result.beforeCreate = existing
				? async (data) => {
						const modified = await existing(data)
						return hooks.beforeCreate!(modified)
					}
				: hooks.beforeCreate
		}

		if (hooks.afterCreate) {
			const existing = result.afterCreate
			result.afterCreate = existing
				? async (record) => {
						await existing(record)
						await hooks.afterCreate!(record)
					}
				: hooks.afterCreate
		}

		if (hooks.beforeUpdate) {
			const existing = result.beforeUpdate
			result.beforeUpdate = existing
				? async (data, record) => {
						const modified = await existing(data, record)
						return hooks.beforeUpdate!(modified, record)
					}
				: hooks.beforeUpdate
		}

		if (hooks.afterUpdate) {
			const existing = result.afterUpdate
			result.afterUpdate = existing
				? async (record) => {
						await existing(record)
						await hooks.afterUpdate!(record)
					}
				: hooks.afterUpdate
		}

		if (hooks.beforeDelete) {
			const existing = result.beforeDelete
			result.beforeDelete = existing
				? async (record) => {
						await existing(record)
						await hooks.beforeDelete!(record)
					}
				: hooks.beforeDelete
		}

		if (hooks.afterDelete) {
			const existing = result.afterDelete
			result.afterDelete = existing
				? async (record) => {
						await existing(record)
						await hooks.afterDelete!(record)
					}
				: hooks.afterDelete
		}
	}

	return result
}
