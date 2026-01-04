/**
 * Subscription Record Limit Tests
 *
 * Tests that overly-broad subscriptions are rejected:
 * - maxRecordsPerSubscription enforcement
 */

import { describe, test, expect } from '@jest/globals'
import { createSubscriptionManager, SubscriptionLimitError } from '../../src/flashcore/subscription-manager.js'

describe('Subscription Record Limits', () => {
	test('rejects subscription with too many initial IDs', () => {
		const manager = createSubscriptionManager({
			maxRecordsPerSubscription: 5
		})

		// Create array of 10 IDs (exceeds limit of 5)
		const manyIds = Array.from({ length: 10 }, (_, i) => `id-${i}`)

		expect(() => {
			manager.register('User', {}, { onAdd: () => {} }, manyIds)
		}).toThrow(SubscriptionLimitError)
	})

	test('allows subscription within record limit', () => {
		const manager = createSubscriptionManager({
			maxRecordsPerSubscription: 10
		})

		const fewIds = ['id-1', 'id-2', 'id-3']

		// Should not throw
		const unsub = manager.register('User', {}, { onAdd: () => {} }, fewIds)
		expect(manager.count).toBe(1)
		unsub()
	})

	test('allows subscription with no initial IDs', () => {
		const manager = createSubscriptionManager({
			maxRecordsPerSubscription: 5
		})

		// Empty initial IDs should be fine
		const unsub = manager.register('User', {}, { onAdd: () => {} })
		expect(manager.count).toBe(1)
		unsub()
	})

	test('uses default maxRecordsPerSubscription of 10000', () => {
		const manager = createSubscriptionManager()

		// This is under the default limit
		const ids = Array.from({ length: 100 }, (_, i) => `id-${i}`)
		const unsub = manager.register('User', {}, { onAdd: () => {} }, ids)
		expect(manager.count).toBe(1)
		unsub()
	})
})
