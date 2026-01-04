/**
 * Flashcore v1 (spec rev 4.3) Ordering
 *
 * Implements sorting with stable tie-break by id.
 */

import type { OrderBy, OrderDirection } from '../schema/types.js'

/**
 * Sort records by orderBy clause.
 *
 * @param records - Records to sort
 * @param orderBy - Order by clause (single or array)
 * @returns Sorted records (new array)
 */
export function sortRecords<T extends { id: string }>(
	records: T[],
	orderBy?: OrderBy<T> | OrderBy<T>[]
): T[] {
	if (!orderBy) {
		// Default: sort by id ascending for determinism
		return [...records].sort((a, b) => a.id.localeCompare(b.id))
	}

	// Normalize to array
	const orderClauses = Array.isArray(orderBy) ? orderBy : [orderBy]

	// Build sort fields list
	const sortFields: Array<{ field: string; direction: OrderDirection }> = []

	for (const clause of orderClauses) {
		for (const [field, direction] of Object.entries(clause)) {
			if (direction) {
				sortFields.push({ field, direction })
			}
		}
	}

	// Add id as final tie-breaker if not already present
	if (!sortFields.some((f) => f.field === 'id')) {
		sortFields.push({ field: 'id', direction: 'asc' })
	}

	// Sort
	return [...records].sort((a, b) => {
		for (const { field, direction } of sortFields) {
			const result = compareValues(
				(a as Record<string, unknown>)[field],
				(b as Record<string, unknown>)[field],
				direction
			)
			if (result !== 0) {
				return result
			}
		}
		return 0
	})
}

/**
 * Compare two values for sorting.
 *
 * Null/undefined handling:
 * - asc: nulls last
 * - desc: nulls first
 */
function compareValues(a: unknown, b: unknown, direction: OrderDirection): number {
	const multiplier = direction === 'desc' ? -1 : 1

	// Handle null/undefined
	const aIsNullish = a === null || a === undefined
	const bIsNullish = b === null || b === undefined

	if (aIsNullish && bIsNullish) {
		return 0
	}

	if (aIsNullish) {
		// nulls last for asc, first for desc
		return direction === 'asc' ? 1 : -1
	}

	if (bIsNullish) {
		// nulls last for asc, first for desc
		return direction === 'asc' ? -1 : 1
	}

	// Compare by type
	if (typeof a === 'number' && typeof b === 'number') {
		return (a - b) * multiplier
	}

	if (typeof a === 'string' && typeof b === 'string') {
		return a.localeCompare(b) * multiplier
	}

	if (a instanceof Date && b instanceof Date) {
		return (a.getTime() - b.getTime()) * multiplier
	}

	if (typeof a === 'boolean' && typeof b === 'boolean') {
		return ((a ? 1 : 0) - (b ? 1 : 0)) * multiplier
	}

	// Mixed types - convert to string
	const aStr = String(a)
	const bStr = String(b)
	return aStr.localeCompare(bStr) * multiplier
}
