/**
 * Phase 10: Plugin Utilities Tests
 *
 * Tests utility functions for plugin authors:
 * - evaluateWhere() - where clause evaluation
 * - computePatches() - JSON Patch generation
 */

import { describe, test, expect } from '@jest/globals'
import { evaluateWhere, computePatches, applyPatches } from '../../../src/flashcore/plugin/utils.js'

describe('Phase 10: evaluateWhere', () => {
	test('returns true for empty where clause', () => {
		const record = { id: '1', name: 'Alice', age: 30 }
		expect(evaluateWhere(record, {})).toBe(true)
	})

	test('simple equality', () => {
		const record = { id: '1', name: 'Alice', age: 30 }

		expect(evaluateWhere(record, { name: 'Alice' })).toBe(true)
		expect(evaluateWhere(record, { name: 'Bob' })).toBe(false)
		expect(evaluateWhere(record, { age: 30 })).toBe(true)
		expect(evaluateWhere(record, { age: 25 })).toBe(false)
	})

	test('equals operator', () => {
		const record = { id: '1', name: 'Alice', age: 30 }

		expect(evaluateWhere(record, { name: { equals: 'Alice' } })).toBe(true)
		expect(evaluateWhere(record, { name: { eq: 'Alice' } })).toBe(true)
		expect(evaluateWhere(record, { name: { equals: 'Bob' } })).toBe(false)
	})

	test('not/ne/neq operators', () => {
		const record = { id: '1', name: 'Alice', age: 30 }

		expect(evaluateWhere(record, { name: { not: 'Bob' } })).toBe(true)
		expect(evaluateWhere(record, { name: { ne: 'Bob' } })).toBe(true)
		expect(evaluateWhere(record, { name: { neq: 'Bob' } })).toBe(true)
		expect(evaluateWhere(record, { name: { not: 'Alice' } })).toBe(false)
	})

	test('comparison operators (gt, gte, lt, lte)', () => {
		const record = { id: '1', name: 'Alice', age: 30 }

		expect(evaluateWhere(record, { age: { gt: 25 } })).toBe(true)
		expect(evaluateWhere(record, { age: { gt: 30 } })).toBe(false)
		expect(evaluateWhere(record, { age: { gte: 30 } })).toBe(true)
		expect(evaluateWhere(record, { age: { gte: 31 } })).toBe(false)

		expect(evaluateWhere(record, { age: { lt: 35 } })).toBe(true)
		expect(evaluateWhere(record, { age: { lt: 30 } })).toBe(false)
		expect(evaluateWhere(record, { age: { lte: 30 } })).toBe(true)
		expect(evaluateWhere(record, { age: { lte: 29 } })).toBe(false)
	})

	test('in/notIn operators', () => {
		const record = { id: '1', name: 'Alice', status: 'active' }

		expect(evaluateWhere(record, { status: { in: ['active', 'pending'] } })).toBe(true)
		expect(evaluateWhere(record, { status: { in: ['inactive', 'deleted'] } })).toBe(false)

		expect(evaluateWhere(record, { status: { notIn: ['inactive', 'deleted'] } })).toBe(true)
		expect(evaluateWhere(record, { status: { notIn: ['active', 'pending'] } })).toBe(false)
	})

	test('string operators (contains, startsWith, endsWith)', () => {
		const record = { id: '1', name: 'Alice Smith', email: 'alice@example.com' }

		expect(evaluateWhere(record, { name: { contains: 'ice' } })).toBe(true)
		expect(evaluateWhere(record, { name: { contains: 'Bob' } })).toBe(false)

		expect(evaluateWhere(record, { name: { startsWith: 'Alice' } })).toBe(true)
		expect(evaluateWhere(record, { name: { startsWith: 'Bob' } })).toBe(false)

		expect(evaluateWhere(record, { email: { endsWith: '.com' } })).toBe(true)
		expect(evaluateWhere(record, { email: { endsWith: '.org' } })).toBe(false)
	})

	test('AND logical operator', () => {
		const record = { id: '1', name: 'Alice', age: 30, status: 'active' }

		expect(
			evaluateWhere(record, {
				AND: [{ name: 'Alice' }, { age: 30 }]
			})
		).toBe(true)

		expect(
			evaluateWhere(record, {
				AND: [{ name: 'Alice' }, { age: 25 }]
			})
		).toBe(false)
	})

	test('OR logical operator', () => {
		const record = { id: '1', name: 'Alice', age: 30, status: 'active' }

		expect(
			evaluateWhere(record, {
				OR: [{ name: 'Bob' }, { age: 30 }]
			})
		).toBe(true)

		expect(
			evaluateWhere(record, {
				OR: [{ name: 'Bob' }, { age: 25 }]
			})
		).toBe(false)
	})

	test('NOT logical operator', () => {
		const record = { id: '1', name: 'Alice', age: 30 }

		expect(evaluateWhere(record, { NOT: { name: 'Bob' } })).toBe(true)
		expect(evaluateWhere(record, { NOT: { name: 'Alice' } })).toBe(false)
	})

	test('combined conditions', () => {
		const record = { id: '1', name: 'Alice', age: 30, status: 'active' }

		expect(
			evaluateWhere(record, {
				name: 'Alice',
				age: { gte: 18 },
				status: { in: ['active', 'pending'] }
			})
		).toBe(true)

		expect(
			evaluateWhere(record, {
				name: 'Alice',
				age: { gte: 35 }
			})
		).toBe(false)
	})
})

describe('Phase 10: computePatches', () => {
	test('detects added fields', () => {
		const before = { id: '1', name: 'Alice' }
		const after = { id: '1', name: 'Alice', age: 30 }

		const patches = computePatches(before, after)

		expect(patches).toEqual([{ op: 'add', path: '/age', value: 30 }])
	})

	test('detects removed fields', () => {
		const before = { id: '1', name: 'Alice', age: 30 }
		const after = { id: '1', name: 'Alice' }

		const patches = computePatches(before, after)

		expect(patches).toEqual([{ op: 'remove', path: '/age' }])
	})

	test('detects replaced fields', () => {
		const before = { id: '1', name: 'Alice', age: 30 }
		const after = { id: '1', name: 'Alice', age: 31 }

		const patches = computePatches(before, after)

		expect(patches).toEqual([{ op: 'replace', path: '/age', value: 31 }])
	})

	test('handles nested objects', () => {
		const before = { id: '1', profile: { name: 'Alice', bio: 'Hello' } }
		const after = { id: '1', profile: { name: 'Alice', bio: 'Updated bio' } }

		const patches = computePatches(before, after)

		expect(patches).toEqual([{ op: 'replace', path: '/profile/bio', value: 'Updated bio' }])
	})

	test('handles multiple changes', () => {
		const before = { id: '1', name: 'Alice', age: 30, status: 'active' }
		const after = { id: '1', name: 'Bob', age: 31, email: 'bob@example.com' }

		const patches = computePatches(before, after)

		expect(patches).toContainEqual({ op: 'remove', path: '/status' })
		expect(patches).toContainEqual({ op: 'replace', path: '/name', value: 'Bob' })
		expect(patches).toContainEqual({ op: 'replace', path: '/age', value: 31 })
		expect(patches).toContainEqual({ op: 'add', path: '/email', value: 'bob@example.com' })
	})

	test('returns empty array for no changes', () => {
		const before = { id: '1', name: 'Alice', age: 30 }
		const after = { id: '1', name: 'Alice', age: 30 }

		const patches = computePatches(before, after)

		expect(patches).toEqual([])
	})
})

describe('Phase 10: applyPatches', () => {
	test('applies add operation', () => {
		const obj = { id: '1', name: 'Alice' }
		const patched = applyPatches(obj, [{ op: 'add', path: '/age', value: 30 }])

		expect(patched).toEqual({ id: '1', name: 'Alice', age: 30 })
		expect(obj).toEqual({ id: '1', name: 'Alice' }) // Original unchanged
	})

	test('applies remove operation', () => {
		const obj = { id: '1', name: 'Alice', age: 30 }
		const patched = applyPatches(obj, [{ op: 'remove', path: '/age' }])

		expect(patched).toEqual({ id: '1', name: 'Alice' })
	})

	test('applies replace operation', () => {
		const obj = { id: '1', name: 'Alice', age: 30 }
		const patched = applyPatches(obj, [{ op: 'replace', path: '/age', value: 31 }])

		expect(patched).toEqual({ id: '1', name: 'Alice', age: 31 })
	})

	test('applies multiple operations in order', () => {
		const obj = { id: '1', name: 'Alice', age: 30 }
		const patched = applyPatches(obj, [
			{ op: 'replace', path: '/name', value: 'Bob' },
			{ op: 'add', path: '/email', value: 'bob@example.com' },
			{ op: 'remove', path: '/age' }
		])

		expect(patched).toEqual({ id: '1', name: 'Bob', email: 'bob@example.com' })
	})
})

