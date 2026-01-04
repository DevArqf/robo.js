/**
 * HMR Subscription API Tests
 *
 * Tests for the hmr.subscribe() imperative API for receiving HMR events.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import {
	createContext,
	createFullContext,
	HmrEnvHelper,
	clearGlobalHmrState,
	importHmrFresh
} from '../utils/hmr-test-helpers.js'
import type { HmrEventContext } from '../../src/core/hmr.js'

describe('HMR Subscription API', () => {
	const envHelper = new HmrEnvHelper()

	beforeEach(() => {
		envHelper.enableHmr()
		clearGlobalHmrState()
	})

	afterEach(() => {
		envHelper.restore()
		clearGlobalHmrState()
	})

	describe('subscribe()', () => {
		it('registers a callback', async () => {
			const { hmr, getSubscriberCount } = await importHmrFresh()
			const callback = jest.fn()

			hmr.subscribe(callback)

			expect(getSubscriberCount()).toBe(1)
		})

		it('returns unsubscribe handle', async () => {
			const { hmr } = await importHmrFresh()
			const callback = jest.fn()

			const sub = hmr.subscribe(callback)

			expect(sub.unsubscribe).toBeDefined()
			expect(typeof sub.unsubscribe).toBe('function')
		})

		it('removes callback on unsubscribe', async () => {
			const { hmr, getSubscriberCount } = await importHmrFresh()
			const callback = jest.fn()

			const sub = hmr.subscribe(callback)
			expect(getSubscriberCount()).toBe(1)

			sub.unsubscribe()
			expect(getSubscriberCount()).toBe(0)
		})

		it('allows multiple subscriptions', async () => {
			const { hmr, getSubscriberCount } = await importHmrFresh()

			hmr.subscribe(jest.fn())
			hmr.subscribe(jest.fn())
			hmr.subscribe(jest.fn())

			expect(getSubscriberCount()).toBe(3)
		})

		it('is no-op when HMR disabled', async () => {
			envHelper.disableHmr()
			clearGlobalHmrState()

			const { hmr } = await importHmrFresh()
			const callback = jest.fn()

			// Should not throw
			const sub = hmr.subscribe(callback)
			expect(sub.unsubscribe).toBeDefined()

			// Unsubscribe should also be no-op
			expect(() => sub.unsubscribe()).not.toThrow()
		})
	})

	describe('Filter Options', () => {
		it('filters by namespace', async () => {
			const { hmr, dispatchHmrEvent } = await importHmrFresh()
			const callback = jest.fn()

			hmr.subscribe(callback, { namespaces: ['server'] })

			// Should be called for server namespace
			await dispatchHmrEvent(createContext({ namespace: 'server', route: 'api' }))
			expect(callback).toHaveBeenCalledTimes(1)

			// Should NOT be called for discordjs namespace
			await dispatchHmrEvent(createContext({ namespace: 'discordjs', route: 'commands' }))
			expect(callback).toHaveBeenCalledTimes(1) // Still 1, not called again
		})

		it('filters by route', async () => {
			const { hmr, dispatchHmrEvent } = await importHmrFresh()
			const callback = jest.fn()

			hmr.subscribe(callback, { routes: ['api'] })

			// Should be called for api route
			await dispatchHmrEvent(createContext({ namespace: 'server', route: 'api' }))
			expect(callback).toHaveBeenCalledTimes(1)

			// Should NOT be called for websocket route
			await dispatchHmrEvent(createContext({ namespace: 'server', route: 'websocket' }))
			expect(callback).toHaveBeenCalledTimes(1)
		})

		it('filters by changeType', async () => {
			const { hmr, dispatchHmrEvent } = await importHmrFresh()
			const callback = jest.fn()

			hmr.subscribe(callback, { changeTypes: ['add', 'remove'] })

			// Should be called for 'add'
			await dispatchHmrEvent(createContext({ changeType: 'add' }))
			expect(callback).toHaveBeenCalledTimes(1)

			// Should NOT be called for 'change'
			await dispatchHmrEvent(createContext({ changeType: 'change' }))
			expect(callback).toHaveBeenCalledTimes(1)

			// Should be called for 'remove'
			await dispatchHmrEvent(createContext({ changeType: 'remove' }))
			expect(callback).toHaveBeenCalledTimes(2)
		})

		it('combines multiple filters with AND logic', async () => {
			const { hmr, dispatchHmrEvent } = await importHmrFresh()
			const callback = jest.fn()

			hmr.subscribe(callback, {
				namespaces: ['server'],
				routes: ['api'],
				changeTypes: ['change']
			})

			// Should be called - all filters match
			await dispatchHmrEvent(
				createContext({
					namespace: 'server',
					route: 'api',
					changeType: 'change'
				})
			)
			expect(callback).toHaveBeenCalledTimes(1)

			// Should NOT be called - fails namespace filter
			await dispatchHmrEvent(
				createContext({
					namespace: 'discordjs',
					route: 'api',
					changeType: 'change'
				})
			)
			expect(callback).toHaveBeenCalledTimes(1)

			// Should NOT be called - fails route filter
			await dispatchHmrEvent(
				createContext({
					namespace: 'server',
					route: 'websocket',
					changeType: 'change'
				})
			)
			expect(callback).toHaveBeenCalledTimes(1)

			// Should NOT be called - fails changeType filter
			await dispatchHmrEvent(
				createContext({
					namespace: 'server',
					route: 'api',
					changeType: 'add'
				})
			)
			expect(callback).toHaveBeenCalledTimes(1)
		})

		it('receives all events when no filter specified', async () => {
			const { hmr, dispatchHmrEvent } = await importHmrFresh()
			const callback = jest.fn()

			hmr.subscribe(callback)

			await dispatchHmrEvent(createContext({ namespace: 'server', route: 'api' }))
			await dispatchHmrEvent(createContext({ namespace: 'discordjs', route: 'commands' }))
			await dispatchHmrEvent(createContext({ namespace: 'custom', route: 'events' }))

			expect(callback).toHaveBeenCalledTimes(3)
		})

		it('provides filtered routes in context', async () => {
			const { hmr, dispatchHmrEvent } = await importHmrFresh()
			let receivedContext: HmrEventContext | null = null

			hmr.subscribe((ctx: HmrEventContext) => {
				receivedContext = ctx
			}, { namespaces: ['server'] })

			await dispatchHmrEvent(createFullContext([
				{ namespace: 'server', route: 'api', handlers: [] },
				{ namespace: 'discordjs', route: 'commands', handlers: [] }
			]))

			expect(receivedContext).not.toBeNull()
			expect(receivedContext!.routes).toHaveLength(1)
			expect(receivedContext!.routes[0].namespace).toBe('server')
		})
	})

	describe('Callback Execution', () => {
		it('passes HmrEventContext to callback', async () => {
			const { hmr, dispatchHmrEvent } = await importHmrFresh()
			const callback = jest.fn()

			hmr.subscribe(callback)

			const context = createContext({
				changeType: 'change',
				files: ['src/api/users.ts'],
				namespace: 'server',
				route: 'api'
			})
			await dispatchHmrEvent(context)

			expect(callback).toHaveBeenCalledWith(
				expect.objectContaining({
					changeType: 'change',
					files: ['src/api/users.ts'],
					routes: expect.arrayContaining([
						expect.objectContaining({ namespace: 'server', route: 'api' })
					])
				})
			)
		})

		it('handles sync callbacks', async () => {
			const { hmr, dispatchHmrEvent } = await importHmrFresh()
			let called = false

			hmr.subscribe(() => {
				called = true
			})

			await dispatchHmrEvent(createContext({}))
			expect(called).toBe(true)
		})

		it('handles async callbacks', async () => {
			const { hmr, dispatchHmrEvent } = await importHmrFresh()
			let called = false

			hmr.subscribe(async () => {
				await new Promise((r) => setTimeout(r, 10))
				called = true
			})

			await dispatchHmrEvent(createContext({}))
			expect(called).toBe(true)
		})

		it('continues on callback error', async () => {
			const { hmr, dispatchHmrEvent } = await importHmrFresh()
			const callback1 = jest.fn(() => {
				throw new Error('fail')
			})
			const callback2 = jest.fn()

			// Suppress expected error output
			const originalError = console.error
			console.error = jest.fn()

			hmr.subscribe(callback1)
			hmr.subscribe(callback2)

			await dispatchHmrEvent(createContext({}))

			expect(callback1).toHaveBeenCalled()
			expect(callback2).toHaveBeenCalled() // Still called despite error

			console.error = originalError
		})

		it('logs error but does not throw', async () => {
			const { hmr, dispatchHmrEvent } = await importHmrFresh()
			const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

			hmr.subscribe(() => {
				throw new Error('test error')
			})

			await expect(dispatchHmrEvent(createContext({}))).resolves.not.toThrow()

			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[HMR]'), expect.any(Error))

			consoleErrorSpy.mockRestore()
		})

		it('handles async callback rejection', async () => {
			const { hmr, dispatchHmrEvent } = await importHmrFresh()
			const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

			hmr.subscribe(async () => {
				throw new Error('async error')
			})

			await dispatchHmrEvent(createContext({}))

			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[HMR]'), expect.any(Error))

			consoleErrorSpy.mockRestore()
		})
	})

	describe('dispatchHmrEvent()', () => {
		it('is no-op when HMR disabled', async () => {
			envHelper.disableHmr()
			clearGlobalHmrState()

			const { dispatchHmrEvent } = await importHmrFresh()

			// dispatch shouldn't work when HMR is disabled
			await expect(dispatchHmrEvent(createContext({}))).resolves.not.toThrow()
		})

		it('dispatches to all subscribers', async () => {
			const { hmr, dispatchHmrEvent } = await importHmrFresh()
			const callbacks = [jest.fn(), jest.fn(), jest.fn()]

			for (const cb of callbacks) {
				hmr.subscribe(cb)
			}

			await dispatchHmrEvent(createContext({}))

			for (const cb of callbacks) {
				expect(cb).toHaveBeenCalledTimes(1)
			}
		})

		it('does not call unsubscribed callbacks', async () => {
			const { hmr, dispatchHmrEvent } = await importHmrFresh()
			const callback = jest.fn()

			const sub = hmr.subscribe(callback)
			sub.unsubscribe()

			await dispatchHmrEvent(createContext({}))

			expect(callback).not.toHaveBeenCalled()
		})
	})

	describe('getSubscriberCount()', () => {
		it('returns 0 when no subscribers', async () => {
			const { getSubscriberCount } = await importHmrFresh()
			expect(getSubscriberCount()).toBe(0)
		})

		it('returns correct count after subscriptions', async () => {
			const { hmr, getSubscriberCount } = await importHmrFresh()

			hmr.subscribe(jest.fn())
			expect(getSubscriberCount()).toBe(1)

			hmr.subscribe(jest.fn())
			expect(getSubscriberCount()).toBe(2)
		})

		it('returns correct count after unsubscribe', async () => {
			const { hmr, getSubscriberCount } = await importHmrFresh()

			const sub1 = hmr.subscribe(jest.fn())
			const sub2 = hmr.subscribe(jest.fn())
			expect(getSubscriberCount()).toBe(2)

			sub1.unsubscribe()
			expect(getSubscriberCount()).toBe(1)

			sub2.unsubscribe()
			expect(getSubscriberCount()).toBe(0)
		})
	})

	describe('clearHmrSubscribers()', () => {
		it('removes all subscribers', async () => {
			const { hmr, getSubscriberCount, clearHmrSubscribers } = await importHmrFresh()

			hmr.subscribe(jest.fn())
			hmr.subscribe(jest.fn())
			hmr.subscribe(jest.fn())
			expect(getSubscriberCount()).toBe(3)

			clearHmrSubscribers()
			expect(getSubscriberCount()).toBe(0)
		})

		it('is safe to call when no subscribers', async () => {
			const { clearHmrSubscribers, getSubscriberCount } = await importHmrFresh()

			expect(() => clearHmrSubscribers()).not.toThrow()
			expect(getSubscriberCount()).toBe(0)
		})

		it('is safe to call multiple times', async () => {
			const { hmr, clearHmrSubscribers, getSubscriberCount } = await importHmrFresh()

			hmr.subscribe(jest.fn())
			clearHmrSubscribers()
			clearHmrSubscribers()
			clearHmrSubscribers()

			expect(getSubscriberCount()).toBe(0)
		})
	})

	describe('Multiple Namespaces and Routes', () => {
		it('allows subscribing to multiple namespaces', async () => {
			const { hmr, dispatchHmrEvent } = await importHmrFresh()
			const callback = jest.fn()

			hmr.subscribe(callback, { namespaces: ['server', 'discordjs'] })

			await dispatchHmrEvent(createContext({ namespace: 'server', route: 'api' }))
			expect(callback).toHaveBeenCalledTimes(1)

			await dispatchHmrEvent(createContext({ namespace: 'discordjs', route: 'commands' }))
			expect(callback).toHaveBeenCalledTimes(2)

			// Should not be called for other namespaces
			await dispatchHmrEvent(createContext({ namespace: 'custom', route: 'events' }))
			expect(callback).toHaveBeenCalledTimes(2)
		})

		it('allows subscribing to multiple routes', async () => {
			const { hmr, dispatchHmrEvent } = await importHmrFresh()
			const callback = jest.fn()

			hmr.subscribe(callback, { routes: ['api', 'websocket'] })

			await dispatchHmrEvent(createContext({ namespace: 'server', route: 'api' }))
			expect(callback).toHaveBeenCalledTimes(1)

			await dispatchHmrEvent(createContext({ namespace: 'server', route: 'websocket' }))
			expect(callback).toHaveBeenCalledTimes(2)

			// Should not be called for other routes
			await dispatchHmrEvent(createContext({ namespace: 'server', route: 'events' }))
			expect(callback).toHaveBeenCalledTimes(2)
		})
	})
})
