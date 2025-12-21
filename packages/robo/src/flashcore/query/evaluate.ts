/**
 * Flashcore v4.3 Where Clause Evaluation
 *
 * Evaluates where clauses against records for filtering.
 */

import type { WhereClause, WhereOperators } from '../schema/types.js'

/**
 * Evaluate a where clause against a record.
 *
 * @param record - Record to test
 * @param where - Where clause
 * @returns True if record matches
 */
export function evaluateWhere<T extends Record<string, unknown>>(
	record: T,
	where: WhereClause<T>
): boolean {
	// Handle logical operators
	if ('AND' in where && Array.isArray(where.AND)) {
		if (!where.AND.every((clause) => evaluateWhere(record, clause as WhereClause<T>))) {
			return false
		}
	}

	if ('OR' in where && Array.isArray(where.OR)) {
		if (!where.OR.some((clause) => evaluateWhere(record, clause as WhereClause<T>))) {
			return false
		}
	}

	if ('NOT' in where && where.NOT) {
		if (evaluateWhere(record, where.NOT as WhereClause<T>)) {
			return false
		}
	}

	// Handle field conditions
	for (const [field, condition] of Object.entries(where)) {
		// Skip logical operators
		if (field === 'AND' || field === 'OR' || field === 'NOT') {
			continue
		}

		const fieldValue = record[field]

		// Direct value comparison (equals shorthand)
		if (!isOperatorObject(condition)) {
			if (!evaluateEquals(fieldValue, condition)) {
				return false
			}
			continue
		}

		// Operator object
		if (!evaluateOperators(fieldValue, condition as WhereOperators<unknown>)) {
			return false
		}
	}

	return true
}

/**
 * Check if a condition is an operator object.
 */
function isOperatorObject(condition: unknown): boolean {
	if (condition === null || condition === undefined) {
		return false
	}

	if (typeof condition !== 'object') {
		return false
	}

	// Check for known operator keys
	const operatorKeys = ['equals', 'not', 'gt', 'gte', 'lt', 'lte', 'in', 'contains', 'startsWith', 'endsWith']
	const keys = Object.keys(condition as object)

	return keys.length > 0 && keys.every((key) => operatorKeys.includes(key))
}

/**
 * Evaluate operators against a field value.
 */
function evaluateOperators<V>(value: V, operators: WhereOperators<V>): boolean {
	// equals
	if ('equals' in operators) {
		if (!evaluateEquals(value, operators.equals)) {
			return false
		}
	}

	// not
	if ('not' in operators) {
		if (evaluateEquals(value, operators.not)) {
			return false
		}
	}

	// gt (greater than)
	if ('gt' in operators) {
		if (!evaluateComparison(value, operators.gt, 'gt')) {
			return false
		}
	}

	// gte (greater than or equal)
	if ('gte' in operators) {
		if (!evaluateComparison(value, operators.gte, 'gte')) {
			return false
		}
	}

	// lt (less than)
	if ('lt' in operators) {
		if (!evaluateComparison(value, operators.lt, 'lt')) {
			return false
		}
	}

	// lte (less than or equal)
	if ('lte' in operators) {
		if (!evaluateComparison(value, operators.lte, 'lte')) {
			return false
		}
	}

	// in (array membership)
	if ('in' in operators && Array.isArray(operators.in)) {
		if (!evaluateIn(value, operators.in)) {
			return false
		}
	}

	// contains (string)
	if ('contains' in operators && typeof operators.contains === 'string') {
		if (!evaluateContains(value, operators.contains)) {
			return false
		}
	}

	// startsWith (string)
	if ('startsWith' in operators && typeof operators.startsWith === 'string') {
		if (!evaluateStartsWith(value, operators.startsWith)) {
			return false
		}
	}

	// endsWith (string)
	if ('endsWith' in operators && typeof operators.endsWith === 'string') {
		if (!evaluateEndsWith(value, operators.endsWith)) {
			return false
		}
	}

	return true
}

/**
 * Evaluate equality (strict).
 */
function evaluateEquals(value: unknown, target: unknown): boolean {
	// Handle Date comparison
	if (value instanceof Date && target instanceof Date) {
		return value.getTime() === target.getTime()
	}

	// Handle Date vs string comparison
	if (value instanceof Date && typeof target === 'string') {
		return value.toISOString() === target
	}

	if (typeof value === 'string' && target instanceof Date) {
		return value === target.toISOString()
	}

	// Strict equality for everything else
	return value === target
}

/**
 * Evaluate comparison operators (gt, gte, lt, lte).
 */
function evaluateComparison(
	value: unknown,
	target: unknown,
	operator: 'gt' | 'gte' | 'lt' | 'lte'
): boolean {
	// Handle null/undefined
	if (value === null || value === undefined || target === null || target === undefined) {
		return false
	}

	// Handle Date comparison
	let valueNum: number
	let targetNum: number

	if (value instanceof Date) {
		valueNum = value.getTime()
	} else if (typeof value === 'number') {
		valueNum = value
	} else if (typeof value === 'string') {
		// Try to parse as number for string comparison
		const parsed = parseFloat(value)
		if (!isNaN(parsed)) {
			valueNum = parsed
		} else {
			// String comparison (lexicographic)
			return evaluateStringComparison(value, target as string, operator)
		}
	} else {
		return false
	}

	if (target instanceof Date) {
		targetNum = target.getTime()
	} else if (typeof target === 'number') {
		targetNum = target
	} else if (typeof target === 'string') {
		const parsed = parseFloat(target)
		if (!isNaN(parsed)) {
			targetNum = parsed
		} else {
			// String comparison (lexicographic)
			return evaluateStringComparison(value as string, target, operator)
		}
	} else {
		return false
	}

	switch (operator) {
		case 'gt':
			return valueNum > targetNum
		case 'gte':
			return valueNum >= targetNum
		case 'lt':
			return valueNum < targetNum
		case 'lte':
			return valueNum <= targetNum
	}
}

/**
 * Evaluate string comparison (lexicographic).
 */
function evaluateStringComparison(
	value: string,
	target: string,
	operator: 'gt' | 'gte' | 'lt' | 'lte'
): boolean {
	switch (operator) {
		case 'gt':
			return value > target
		case 'gte':
			return value >= target
		case 'lt':
			return value < target
		case 'lte':
			return value <= target
	}
}

/**
 * Evaluate IN operator (array membership).
 */
function evaluateIn(value: unknown, targets: unknown[]): boolean {
	return targets.some((target) => evaluateEquals(value, target))
}

/**
 * Evaluate contains (string).
 */
function evaluateContains(value: unknown, target: string): boolean {
	if (typeof value !== 'string') {
		return false
	}
	return value.includes(target)
}

/**
 * Evaluate startsWith (string).
 */
function evaluateStartsWith(value: unknown, target: string): boolean {
	if (typeof value !== 'string') {
		return false
	}
	return value.startsWith(target)
}

/**
 * Evaluate endsWith (string).
 */
function evaluateEndsWith(value: unknown, target: string): boolean {
	if (typeof value !== 'string') {
		return false
	}
	return value.endsWith(target)
}
