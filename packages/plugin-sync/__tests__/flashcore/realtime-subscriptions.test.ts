/**
 * Realtime Subscriptions Tests
 *
 * Tests that realtime subscriptions work correctly:
 * - Register and unregister subscriptions
 * - Notify on create/update/delete
 * - Filter matching with where clauses
 */

import { describe, test, expect } from '@jest/globals'
import { createSubscriptionManager } from '../../src/flashcore/subscription-manager.js'

describe('Realtime Subscriptions', () => {
	test('register and unregister subscription', () => {
		const manager = createSubscriptionManager()

		const unsubscribe = manager.register('User', {}, { onAdd: () => {} })
		expect(manager.count).toBe(1)

		unsubscribe()
		expect(manager.count).toBe(0)
	})

	test('notifies on create when record matches filter', () => {
		const manager = createSubscriptionManager()
		const added: Array<{ id: string }> = []

		manager.register('User', { status: 'active' }, {
			onAdd: (record) => added.push(record)
		})

		// Matching record
		manager.notifyCreate('User', { id: '1', status: 'active' })
		expect(added).toHaveLength(1)

		// Non-matching record
		manager.notifyCreate('User', { id: '2', status: 'inactive' })
		expect(added).toHaveLength(1) // Still 1
	})

	test('notifies on delete when record was tracked', () => {
		const manager = createSubscriptionManager()
		const removed: Array<{ id: string }> = []

		// Register with initial tracked ID
		manager.register('User', {}, {
			onRemove: (record) => removed.push(record)
		}, ['1'])

		manager.notifyDelete('User', { id: '1' })
		expect(removed).toHaveLength(1)
		expect(removed[0].id).toBe('1')
	})

	test('notifies on update with patches', () => {
		const manager = createSubscriptionManager()
		const updates: Array<{ record: unknown; patches: unknown }> = []

		manager.register('User', {}, {
			onChange: (record, patches) => updates.push({ record, patches })
		}, ['1'])

		manager.notifyUpdate('User',
			{ id: '1', name: 'Alice' },
			{ id: '1', name: 'Bob' },
			[{ op: 'replace', path: '/name', value: 'Bob' }]
		)

		expect(updates).toHaveLength(1)
		expect(updates[0].patches).toEqual([{ op: 'replace', path: '/name', value: 'Bob' }])
	})

	test('filters notifications to subscribed model only', () => {
		const manager = createSubscriptionManager()
		const userAdded: string[] = []
		const postAdded: string[] = []

		manager.register('User', {}, { onAdd: (r) => userAdded.push(r.id) })
		manager.register('Post', {}, { onAdd: (r) => postAdded.push(r.id) })

		manager.notifyCreate('User', { id: 'u1' })
		manager.notifyCreate('Post', { id: 'p1' })

		expect(userAdded).toEqual(['u1'])
		expect(postAdded).toEqual(['p1'])
	})
})
