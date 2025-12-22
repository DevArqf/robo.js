/**
 * Flashcore v1 Plugin Utilities (spec rev 4.3)
 *
 * Helper functions for plugin authors:
 * - evaluateWhere() - Evaluate where clauses against records
 * - computePatches() - Generate JSON Patch from before/after
 */

import type { JSONPatch } from './types.js'

// ============================================================================
// Where Clause Evaluation
// ============================================================================

/**
 * Evaluate a where clause against a record.
 *
 * Supports operators: equals, gt, gte, lt, lte, not, in, notIn,
 * contains, startsWith, endsWith, AND, OR, NOT.
 *
 * @param record - The record to evaluate
 * @param where - The where clause
 * @returns True if record matches where clause
 */
export function evaluateWhere(record: Record<string, unknown>, where: Record<string, unknown>): boolean {
	if (!where || Object.keys(where).length === 0) {
		return true
	}

	for (const [key, condition] of Object.entries(where)) {
		// Handle logical operators
		if (key === 'AND') {
			const conditions = condition as Array<Record<string, unknown>>
			if (!conditions.every((c) => evaluateWhere(record, c))) {
				return false
			}
			continue
		}

		if (key === 'OR') {
			const conditions = condition as Array<Record<string, unknown>>
			if (!conditions.some((c) => evaluateWhere(record, c))) {
				return false
			}
			continue
		}

		if (key === 'NOT') {
			const conditions = condition as Record<string, unknown>
			if (evaluateWhere(record, conditions)) {
				return false
			}
			continue
		}

		// Get field value
		const fieldValue = record[key]

		// Simple equality
		if (condition === null || typeof condition !== 'object') {
			if (fieldValue !== condition) {
				return false
			}
			continue
		}

		// Operator-based conditions
		const operators = condition as Record<string, unknown>
		for (const [op, operand] of Object.entries(operators)) {
			if (!evaluateOperator(fieldValue, op, operand)) {
				return false
			}
		}
	}

	return true
}

/**
 * Evaluate a single operator against a field value.
 */
function evaluateOperator(fieldValue: unknown, operator: string, operand: unknown): boolean {
	switch (operator) {
		case 'equals':
		case 'eq':
			return fieldValue === operand

		case 'not':
		case 'ne':
		case 'neq':
			return fieldValue !== operand

		case 'gt':
			return typeof fieldValue === 'number' && typeof operand === 'number' && fieldValue > operand

		case 'gte':
			return typeof fieldValue === 'number' && typeof operand === 'number' && fieldValue >= operand

		case 'lt':
			return typeof fieldValue === 'number' && typeof operand === 'number' && fieldValue < operand

		case 'lte':
			return typeof fieldValue === 'number' && typeof operand === 'number' && fieldValue <= operand

		case 'in':
			return Array.isArray(operand) && operand.includes(fieldValue)

		case 'notIn':
			return Array.isArray(operand) && !operand.includes(fieldValue)

		case 'contains':
			return typeof fieldValue === 'string' && typeof operand === 'string' && fieldValue.includes(operand)

		case 'startsWith':
			return typeof fieldValue === 'string' && typeof operand === 'string' && fieldValue.startsWith(operand)

		case 'endsWith':
			return typeof fieldValue === 'string' && typeof operand === 'string' && fieldValue.endsWith(operand)

		case 'mode':
			// 'mode' is a modifier, not a comparison operator
			return true

		default:
			// Unknown operator - treat as equality
			return fieldValue === operand
	}
}

// ============================================================================
// JSON Patch Generation
// ============================================================================

/**
 * Compute JSON Patch (RFC 6902) between two objects.
 *
 * @param before - Original object
 * @param after - Modified object
 * @returns Array of JSON Patch operations
 */
export function computePatches(before: Record<string, unknown>, after: Record<string, unknown>): JSONPatch[] {
	const patches: JSONPatch[] = []
	const beforeKeys = new Set(Object.keys(before))
	const afterKeys = new Set(Object.keys(after))

	// Find removed keys
	for (const key of beforeKeys) {
		if (!afterKeys.has(key)) {
			patches.push({
				op: 'remove',
				path: `/${escapeJsonPointer(key)}`
			})
		}
	}

	// Find added or changed keys
	for (const key of afterKeys) {
		const path = `/${escapeJsonPointer(key)}`
		const beforeValue = before[key]
		const afterValue = after[key]

		if (!beforeKeys.has(key)) {
			// Added
			patches.push({
				op: 'add',
				path,
				value: afterValue
			})
		} else if (!deepEqual(beforeValue, afterValue)) {
			// Changed
			if (
				typeof beforeValue === 'object' &&
				beforeValue !== null &&
				typeof afterValue === 'object' &&
				afterValue !== null &&
				!Array.isArray(beforeValue) &&
				!Array.isArray(afterValue)
			) {
				// Nested object - recurse
				const nestedPatches = computePatches(
					beforeValue as Record<string, unknown>,
					afterValue as Record<string, unknown>
				)
				for (const nestedPatch of nestedPatches) {
					patches.push({
						...nestedPatch,
						path: path + nestedPatch.path
					})
				}
			} else {
				// Replace
				patches.push({
					op: 'replace',
					path,
					value: afterValue
				})
			}
		}
	}

	return patches
}

/**
 * Escape JSON Pointer special characters.
 */
function escapeJsonPointer(key: string): string {
	return key.replace(/~/g, '~0').replace(/\//g, '~1')
}

/**
 * Deep equality check.
 */
function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true
	if (a === null || b === null) return a === b
	if (typeof a !== typeof b) return false

	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false
		return a.every((item, index) => deepEqual(item, b[index]))
	}

	if (typeof a === 'object' && typeof b === 'object') {
		const aObj = a as Record<string, unknown>
		const bObj = b as Record<string, unknown>
		const aKeys = Object.keys(aObj)
		const bKeys = Object.keys(bObj)

		if (aKeys.length !== bKeys.length) return false
		return aKeys.every((key) => deepEqual(aObj[key], bObj[key]))
	}

	return false
}

/**
 * Apply JSON Patch operations to an object.
 *
 * @param obj - Object to patch (not mutated)
 * @param patches - Array of patch operations
 * @returns New patched object
 */
export function applyPatches<T extends Record<string, unknown>>(obj: T, patches: JSONPatch[]): T {
	let result = { ...obj }

	for (const patch of patches) {
		result = applyPatch(result, patch) as T
	}

	return result
}

/**
 * Apply a single JSON Patch operation.
 */
function applyPatch(obj: Record<string, unknown>, patch: JSONPatch): Record<string, unknown> {
	const path = patch.path.split('/').slice(1).map(unescapeJsonPointer)
	const result = { ...obj }

	if (path.length === 0) {
		throw new Error('Invalid JSON Patch path')
	}

	if (path.length === 1) {
		const key = path[0]
		switch (patch.op) {
			case 'add':
			case 'replace':
				result[key] = patch.value
				break
			case 'remove':
				delete result[key]
				break
			case 'test':
				if (!deepEqual(result[key], patch.value)) {
					throw new Error(`Test failed: ${patch.path}`)
				}
				break
			default:
				throw new Error(`Unsupported patch operation: ${patch.op}`)
		}
		return result
	}

	// Nested path - recurse
	const key = path[0]
	const nestedPath = '/' + path.slice(1).map(escapeJsonPointer).join('/')
	const nestedPatch: JSONPatch = { ...patch, path: nestedPath }

	if (typeof result[key] !== 'object' || result[key] === null) {
		if (patch.op === 'add') {
			result[key] = {}
		} else {
			throw new Error(`Cannot ${patch.op} on non-object at ${key}`)
		}
	}

	result[key] = applyPatch(result[key] as Record<string, unknown>, nestedPatch)
	return result
}

/**
 * Unescape JSON Pointer special characters.
 */
function unescapeJsonPointer(key: string): string {
	return key.replace(/~1/g, '/').replace(/~0/g, '~')
}
