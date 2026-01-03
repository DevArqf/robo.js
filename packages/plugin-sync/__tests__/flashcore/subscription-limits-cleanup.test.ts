/**
 * Subscription Limits and Cleanup Tests
 *
 * Tests subscription resource management:
 * - Per-model limits
 * - Total subscription limits
 * - Idle timeout cleanup
 * - Shutdown cleanup
 */

import { describe, test, expect } from '@jest/globals'
import { createSubscriptionManager, SubscriptionLimitError } from '../../src/flashcore/subscription-manager.js'

describe('Subscription Limits', () => {
	test('enforces per-model subscription limit', () => {
		const manager = createSubscriptionManager({
			maxSubscriptionsPerModel: 2
		})

		manager.register('User', {}, { onAdd: () => {} })
		manager.register('User', {}, { onAdd: () => {} })

		expect(() => {
			manager.register('User', {}, { onAdd: () => {} })
		}).toThrow(SubscriptionLimitError)
	})

	test('enforces total subscription limit', () => {
		const manager = createSubscriptionManager({
			maxTotalSubscriptions: 3
		})

		manager.register('User', {}, { onAdd: () => {} })
		manager.register('Post', {}, { onAdd: () => {} })
		manager.register('Comment', {}, { onAdd: () => {} })

		expect(() => {
			manager.register('Tag', {}, { onAdd: () => {} })
		}).toThrow(SubscriptionLimitError)
	})

	test('separate model limits are independent', () => {
		const manager = createSubscriptionManager({
			maxSubscriptionsPerModel: 2
		})

		// Both models can have their own subscriptions
		manager.register('User', {}, { onAdd: () => {} })
		manager.register('User', {}, { onAdd: () => {} })
		manager.register('Post', {}, { onAdd: () => {} })
		manager.register('Post', {}, { onAdd: () => {} })

		expect(manager.getModelCount('User')).toBe(2)
		expect(manager.getModelCount('Post')).toBe(2)
		expect(manager.count).toBe(4)
	})

	test('unsubscribe frees slot for new subscription', () => {
		const manager = createSubscriptionManager({
			maxSubscriptionsPerModel: 1
		})

		const unsub = manager.register('User', {}, { onAdd: () => {} })

		expect(() => {
			manager.register('User', {}, { onAdd: () => {} })
		}).toThrow(SubscriptionLimitError)

		unsub()

		// Should work now
		manager.register('User', {}, { onAdd: () => {} })
		expect(manager.count).toBe(1)
	})
})

describe('Subscription Cleanup', () => {
	test('shutdown calls onComplete for all subscriptions', () => {
		const manager = createSubscriptionManager()
		const completed: string[] = []

		manager.register('User', {}, { onComplete: () => completed.push('user1') })
		manager.register('User', {}, { onComplete: () => completed.push('user2') })
		manager.register('Post', {}, { onComplete: () => completed.push('post1') })

		manager.shutdown()

		expect(completed).toHaveLength(3)
		expect(manager.count).toBe(0)
	})

	test('shutdown clears all subscriptions', () => {
		const manager = createSubscriptionManager()

		manager.register('User', {}, { onAdd: () => {} })
		manager.register('Post', {}, { onAdd: () => {} })

		expect(manager.count).toBe(2)

		manager.shutdown()

		expect(manager.count).toBe(0)
		expect(manager.getModelCount('User')).toBe(0)
		expect(manager.getModelCount('Post')).toBe(0)
	})

	test('can register new subscriptions after shutdown', () => {
		const manager = createSubscriptionManager()

		manager.register('User', {}, { onAdd: () => {} })
		manager.shutdown()

		// Should be able to register again
		manager.register('User', {}, { onAdd: () => {} })
		expect(manager.count).toBe(1)
	})
})
