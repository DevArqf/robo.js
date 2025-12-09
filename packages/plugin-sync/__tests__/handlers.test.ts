/**
 * Tests for @robojs/sync handler system
 *
 * Tests handler registration, pattern matching, validation, transform,
 * middleware, and RPC call handling.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import type { HandlerClient, SyncCallContext, SyncMiddlewareContext, BuiltInSchema } from '../src/server/types.js'

// Mock client for testing
function createMockClient(id = 'test-client-1', data?: unknown): HandlerClient {
	return { id, data }
}

// Mock zone for RPC tests
function createMockZone<T>(initialState?: T) {
	let state = initialState
	let hostId: string | undefined
	const clients: HandlerClient[] = []
	const broadcasts: unknown[] = []
	const sends: { clientId: string; data: unknown }[] = []

	return {
		getState: () => state,
		setState: (newState: T) => {
			state = newState
		},
		getClients: () => clients,
		getHost: () => hostId,
		setHost: (id: string | null) => {
			hostId = id || undefined
		},
		broadcast: (data: unknown) => broadcasts.push(data),
		send: (clientId: string, data: unknown) => sends.push({ clientId, data }),
		// Test helpers
		_broadcasts: broadcasts,
		_sends: sends,
		_addClient: (client: HandlerClient) => clients.push(client)
	}
}

describe('Handler Registration and Pattern Matching', () => {
	let handlers: typeof import('../src/server/handlers.js')

	beforeEach(async () => {
		jest.resetModules()
		handlers = await import('../src/server/handlers.js')
		handlers.clearHandlers()
	})

	afterEach(() => {
		handlers.clearHandlers()
	})

	test('registerHandler adds handler to registry', () => {
		expect(handlers.getHandlerCount()).toBe(0)

		handlers.registerHandler({
			key: 'game/position',
			path: '/test/handler.js',
			exports: { validate: true, named: [] }
		})

		expect(handlers.getHandlerCount()).toBe(1)
	})

	test('findHandler matches exact key', () => {
		handlers.registerHandler({
			key: 'game/position',
			path: '/test/handler.js',
			exports: { validate: true, named: [] }
		})

		const result = handlers.findHandler('game.position')
		expect(result).not.toBeNull()
		expect(result?.record.key).toBe('game/position')
		expect(result?.params).toEqual({})
	})

	test('findHandler matches dynamic segment', () => {
		handlers.registerHandler({
			key: 'game/[roomId]/position',
			path: '/test/handler.js',
			exports: { validate: true, named: [] }
		})

		const result = handlers.findHandler('game.room-123.position')
		expect(result).not.toBeNull()
		expect(result?.params).toEqual({ roomId: 'room-123' })
	})

	test('findHandler matches multiple dynamic segments', () => {
		handlers.registerHandler({
			key: 'game/[roomId]/player/[playerId]',
			path: '/test/handler.js',
			exports: { validate: true, named: [] }
		})

		const result = handlers.findHandler('game.lobby.player.user-456')
		expect(result).not.toBeNull()
		expect(result?.params).toEqual({ roomId: 'lobby', playerId: 'user-456' })
	})

	test('findHandler returns null for non-matching key', () => {
		handlers.registerHandler({
			key: 'game/position',
			path: '/test/handler.js',
			exports: { validate: true, named: [] }
		})

		const result = handlers.findHandler('other.key')
		expect(result).toBeNull()
	})

	test('findHandler handles special regex characters in key', () => {
		handlers.registerHandler({
			key: 'game/score.total',
			path: '/test/handler.js',
			exports: { validate: true, named: [] }
		})

		// Should not match (. is literal, not regex wildcard)
		const result = handlers.findHandler('game.scorextotal')
		expect(result).toBeNull()
	})
})

describe('Middleware Registration', () => {
	let handlers: typeof import('../src/server/handlers.js')

	beforeEach(async () => {
		jest.resetModules()
		handlers = await import('../src/server/handlers.js')
		handlers.clearHandlers()
	})

	afterEach(() => {
		handlers.clearHandlers()
	})

	test('registerMiddleware adds middleware to registry', () => {
		expect(handlers.getMiddlewareCount()).toBe(0)

		handlers.registerMiddleware({
			path: 'game',
			exports: { before: true, after: true }
		})

		expect(handlers.getMiddlewareCount()).toBe(1)
	})

	test('findMiddleware returns middleware in order (root to leaf)', () => {
		handlers.registerMiddleware({
			path: 'game',
			exports: { before: true }
		})
		handlers.registerMiddleware({
			path: 'game/room',
			exports: { before: true }
		})

		const result = handlers.findMiddleware('game.room.position')
		expect(result.length).toBe(2)
		expect(result[0].path).toBe('game')
		expect(result[1].path).toBe('game/room')
	})

	test('findMiddleware returns empty array for no matching middleware', () => {
		handlers.registerMiddleware({
			path: 'other',
			exports: { before: true }
		})

		const result = handlers.findMiddleware('game.room.position')
		expect(result.length).toBe(0)
	})
})

describe('Schema Validation', () => {
	let schema: typeof import('../src/server/schema.js')

	beforeEach(async () => {
		jest.resetModules()
		schema = await import('../src/server/schema.js')
	})

	describe('Built-in Schema', () => {
		test('validates required string field', () => {
			const testSchema: BuiltInSchema = {
				name: { type: 'string' }
			}

			expect(schema.validateSchema(testSchema, { name: 'test' }).success).toBe(true)
			expect(schema.validateSchema(testSchema, { name: 123 }).success).toBe(false)
			expect(schema.validateSchema(testSchema, {}).success).toBe(false)
		})

		test('validates required number field', () => {
			const testSchema: BuiltInSchema = {
				score: { type: 'number' }
			}

			expect(schema.validateSchema(testSchema, { score: 100 }).success).toBe(true)
			expect(schema.validateSchema(testSchema, { score: 'hundred' }).success).toBe(false)
		})

		test('validates number min/max constraints', () => {
			const testSchema: BuiltInSchema = {
				x: { type: 'number', min: 0, max: 1 }
			}

			expect(schema.validateSchema(testSchema, { x: 0.5 }).success).toBe(true)
			expect(schema.validateSchema(testSchema, { x: 0 }).success).toBe(true)
			expect(schema.validateSchema(testSchema, { x: 1 }).success).toBe(true)
			expect(schema.validateSchema(testSchema, { x: -0.1 }).success).toBe(false)
			expect(schema.validateSchema(testSchema, { x: 1.1 }).success).toBe(false)
		})

		test('validates string minLength/maxLength constraints', () => {
			const testSchema: BuiltInSchema = {
				username: { type: 'string', minLength: 3, maxLength: 20 }
			}

			expect(schema.validateSchema(testSchema, { username: 'john' }).success).toBe(true)
			expect(schema.validateSchema(testSchema, { username: 'ab' }).success).toBe(false)
			expect(schema.validateSchema(testSchema, { username: 'a'.repeat(21) }).success).toBe(false)
		})

		test('validates boolean field', () => {
			const testSchema: BuiltInSchema = {
				active: { type: 'boolean' }
			}

			expect(schema.validateSchema(testSchema, { active: true }).success).toBe(true)
			expect(schema.validateSchema(testSchema, { active: false }).success).toBe(true)
			expect(schema.validateSchema(testSchema, { active: 'true' }).success).toBe(false)
		})

		test('validates nullable field', () => {
			const testSchema: BuiltInSchema = {
				lockedBy: { type: 'string', nullable: true }
			}

			expect(schema.validateSchema(testSchema, { lockedBy: 'user-1' }).success).toBe(true)
			expect(schema.validateSchema(testSchema, { lockedBy: null }).success).toBe(true)
			expect(schema.validateSchema(testSchema, {}).success).toBe(false) // Still required, just nullable
		})

		test('validates optional field', () => {
			const testSchema: BuiltInSchema = {
				nickname: { type: 'string', optional: true }
			}

			expect(schema.validateSchema(testSchema, { nickname: 'test' }).success).toBe(true)
			expect(schema.validateSchema(testSchema, {}).success).toBe(true)
			expect(schema.validateSchema(testSchema, { nickname: 123 }).success).toBe(false)
		})

		test('validates array field', () => {
			const testSchema: BuiltInSchema = {
				tags: { type: 'array' }
			}

			expect(schema.validateSchema(testSchema, { tags: ['a', 'b'] }).success).toBe(true)
			expect(schema.validateSchema(testSchema, { tags: [] }).success).toBe(true)
			expect(schema.validateSchema(testSchema, { tags: 'not-array' }).success).toBe(false)
		})

		test('validates object field', () => {
			const testSchema: BuiltInSchema = {
				metadata: { type: 'object' }
			}

			expect(schema.validateSchema(testSchema, { metadata: { foo: 'bar' } }).success).toBe(true)
			expect(schema.validateSchema(testSchema, { metadata: {} }).success).toBe(true)
			expect(schema.validateSchema(testSchema, { metadata: [] }).success).toBe(false) // Arrays are not plain objects
		})

		test('returns error details on failure', () => {
			const testSchema: BuiltInSchema = {
				x: { type: 'number', min: 0 },
				y: { type: 'number', max: 100 }
			}

			const result = schema.validateSchema(testSchema, { x: -1, y: 150 })
			expect(result.success).toBe(false)
			expect(result.errors?.length).toBe(2)
			expect(result.errors?.[0].path).toBe('x')
			expect(result.errors?.[1].path).toBe('y')
		})
	})

	describe('Zod Schema Detection', () => {
		test('detects Zod schema by _def property', () => {
			const safeParseFn = jest.fn(() => ({ success: true, data: {} }))
			const fakeZodSchema = {
				_def: { typeName: 'ZodObject' },
				safeParse: safeParseFn
			}

			// Should use Zod's safeParse
			schema.validateSchema(fakeZodSchema, { test: true })
			expect(safeParseFn).toHaveBeenCalled()
			expect(safeParseFn.mock.calls[0]).toEqual([{ test: true }])
		})

		test('handles Zod validation failure', () => {
			const fakeZodSchema = {
				_def: { typeName: 'ZodObject' },
				safeParse: jest.fn(() => ({
					success: false,
					error: {
						errors: [{ path: ['field'], message: 'Required' }]
					}
				}))
			}

			const result = schema.validateSchema(fakeZodSchema, {})
			expect(result.success).toBe(false)
			expect(result.errors?.[0]).toEqual({ path: 'field', message: 'Required' })
		})
	})
})

describe('Update Processing', () => {
	let handlers: typeof import('../src/server/handlers.js')

	beforeEach(async () => {
		jest.resetModules()
		handlers = await import('../src/server/handlers.js')
		handlers.clearHandlers()
	})

	afterEach(() => {
		handlers.clearHandlers()
	})

	test('processUpdate returns accepted for key without handler', async () => {
		const result = await handlers.processUpdate(
			'unhandled.key',
			['unhandled', 'key'],
			{ value: 42 },
			undefined,
			createMockClient()
		)

		expect(result.accepted).toBe(true)
		expect(result.state).toEqual({ value: 42 })
	})

	test('processUpdate runs validate function', async () => {
		const validateFn = jest.fn(() => true)

		handlers.registerHandler({
			key: 'game/score',
			path: '/test/handler.js',
			exports: { validate: true, named: [] },
			handler: { validate: validateFn }
		})

		await handlers.processUpdate('game.score', ['game', 'score'], { score: 100 }, { score: 50 }, createMockClient())

		expect(validateFn).toHaveBeenCalled()
		const callArg = (validateFn.mock.calls[0] as unknown[])[0] as Record<string, unknown>
		expect(callArg.newState).toEqual({ score: 100 })
		expect(callArg.oldState).toEqual({ score: 50 })
	})

	test('processUpdate rejects when validate returns false', async () => {
		handlers.registerHandler({
			key: 'game/score',
			path: '/test/handler.js',
			exports: { validate: true, named: [] },
			handler: { validate: () => false }
		})

		const result = await handlers.processUpdate(
			'game.score',
			['game', 'score'],
			{ score: 100 },
			undefined,
			createMockClient()
		)

		expect(result.accepted).toBe(false)
		expect(result.reason).toBe('validation_failed')
	})

	test('processUpdate rejects with custom reason when validate returns string', async () => {
		handlers.registerHandler({
			key: 'game/score',
			path: '/test/handler.js',
			exports: { validate: true, named: [] },
			handler: { validate: () => 'invalid_score' }
		})

		const result = await handlers.processUpdate(
			'game.score',
			['game', 'score'],
			{ score: -1 },
			undefined,
			createMockClient()
		)

		expect(result.accepted).toBe(false)
		expect(result.reason).toBe('invalid_score')
	})

	test('processUpdate runs transform function', async () => {
		handlers.registerHandler({
			key: 'game/position',
			path: '/test/handler.js',
			exports: { transform: true, named: [] },
			handler: {
				transform: (context: { newState: unknown; client: HandlerClient }) => {
					const newState = context.newState as { x: number; y: number }
					return {
						...newState,
						lastUpdatedBy: context.client.id,
						timestamp: 12345
					}
				}
			}
		})

		const result = await handlers.processUpdate(
			'game.position',
			['game', 'position'],
			{ x: 0.5, y: 0.5 },
			undefined,
			createMockClient('user-1')
		)

		expect(result.accepted).toBe(true)
		expect(result.state).toEqual({
			x: 0.5,
			y: 0.5,
			lastUpdatedBy: 'user-1',
			timestamp: 12345
		})
	})

	test('processUpdate runs schema validation before custom validate', async () => {
		const validateFn = jest.fn(() => true)

		handlers.registerHandler({
			key: 'game/position',
			path: '/test/handler.js',
			exports: { schema: true, validate: true, named: [] },
			handler: {
				schema: {
					x: { type: 'number', min: 0, max: 1 },
					y: { type: 'number', min: 0, max: 1 }
				} as BuiltInSchema,
				validate: validateFn
			}
		})

		// Invalid schema - should reject before validate is called
		const result = await handlers.processUpdate(
			'game.position',
			['game', 'position'],
			{ x: 2, y: 0.5 },
			undefined,
			createMockClient()
		)

		expect(result.accepted).toBe(false)
		expect(result.reason).toBe('schema_validation_failed')
		expect(validateFn).not.toHaveBeenCalled()
	})

	test('processUpdate provides params from dynamic segments', async () => {
		const validateFn = jest.fn(() => true)

		handlers.registerHandler({
			key: 'game/[roomId]/player/[playerId]',
			path: '/test/handler.js',
			exports: { validate: true, named: [] },
			handler: { validate: validateFn }
		})

		await handlers.processUpdate(
			'game.room-1.player.user-2',
			['game', 'room-1', 'player', 'user-2'],
			{ health: 100 },
			undefined,
			createMockClient()
		)

		expect(validateFn).toHaveBeenCalled()
		const callArg = (validateFn.mock.calls[0] as unknown[])[0] as Record<string, unknown>
		expect(callArg.params).toEqual({ roomId: 'room-1', playerId: 'user-2' })
	})
})

describe('RPC Call Processing', () => {
	let handlers: typeof import('../src/server/handlers.js')

	beforeEach(async () => {
		jest.resetModules()
		handlers = await import('../src/server/handlers.js')
		handlers.clearHandlers()
	})

	afterEach(() => {
		handlers.clearHandlers()
	})

	test('processCall returns error for key without handler', async () => {
		const zone = createMockZone()
		const result = await handlers.processCall(
			'unhandled.key',
			['unhandled', 'key'],
			'testMethod',
			{},
			createMockClient(),
			zone
		)

		expect(result.success).toBe(false)
		expect(result.error).toBe('no_handler')
	})

	test('processCall returns error for non-existent method', async () => {
		handlers.registerHandler({
			key: 'game/room',
			path: '/test/handler.js',
			exports: { named: ['move'] },
			handler: {
				move: jest.fn()
			}
		})

		const zone = createMockZone()
		const result = await handlers.processCall(
			'game.room',
			['game', 'room'],
			'nonExistentMethod',
			{},
			createMockClient(),
			zone
		)

		expect(result.success).toBe(false)
		expect(result.error).toBe('method_not_found')
	})

	test('processCall executes RPC method and returns result', async () => {
		const moveFn = jest.fn(async (payload: { x: number; y: number }) => {
			return { moved: true, newPosition: payload }
		})

		handlers.registerHandler({
			key: 'game/[roomId]',
			path: '/test/handler.js',
			exports: { named: ['move'] },
			handler: { move: moveFn }
		})

		const zone = createMockZone({ players: {} })
		const result = await handlers.processCall(
			'game.room-1',
			['game', 'room-1'],
			'move',
			{ x: 0.5, y: 0.5 },
			createMockClient('user-1'),
			zone
		)

		expect(result.success).toBe(true)
		expect(result.result).toEqual({ moved: true, newPosition: { x: 0.5, y: 0.5 } })
		expect(moveFn).toHaveBeenCalled()
		const callArgs = moveFn.mock.calls[0] as unknown as [unknown, Record<string, unknown>]
		expect(callArgs[0]).toEqual({ x: 0.5, y: 0.5 })
		expect((callArgs[1].client as HandlerClient).id).toBe('user-1')
		expect(callArgs[1].params).toEqual({ roomId: 'room-1' })
	})

	test('processCall context provides state access', async () => {
		const collectCoin = jest.fn(async (payload: { coinId: string }, context: SyncCallContext) => {
			const state = context.getState() as { coins: Record<string, { collected: boolean }> }
			const coin = state.coins[payload.coinId]

			if (!coin || coin.collected) {
				return { success: false, error: 'coin_unavailable' }
			}

			context.setState({
				...state,
				coins: { ...state.coins, [payload.coinId]: { collected: true } }
			})

			return { success: true }
		})

		handlers.registerHandler({
			key: 'game/[roomId]',
			path: '/test/handler.js',
			exports: { named: ['collectCoin'] },
			handler: { collectCoin }
		})

		const zone = createMockZone({
			coins: { 'coin-1': { collected: false } }
		})

		const result = await handlers.processCall(
			'game.room-1',
			['game', 'room-1'],
			'collectCoin',
			{ coinId: 'coin-1' },
			createMockClient(),
			zone
		)

		expect(result.success).toBe(true)
		expect(zone.getState()).toEqual({
			coins: { 'coin-1': { collected: true } }
		})
	})

	test('processCall handles RPC method throwing error', async () => {
		handlers.registerHandler({
			key: 'game/room',
			path: '/test/handler.js',
			exports: { named: ['failingMethod'] },
			handler: {
				failingMethod: async () => {
					throw new Error('Something went wrong')
				}
			}
		})

		const zone = createMockZone()
		const result = await handlers.processCall(
			'game.room',
			['game', 'room'],
			'failingMethod',
			{},
			createMockClient(),
			zone
		)

		expect(result.success).toBe(false)
		expect(result.error).toBe('Something went wrong')
	})
})

describe('Middleware Execution', () => {
	let handlers: typeof import('../src/server/handlers.js')

	beforeEach(async () => {
		jest.resetModules()
		handlers = await import('../src/server/handlers.js')
		handlers.clearHandlers()
	})

	afterEach(() => {
		handlers.clearHandlers()
	})

	test('middleware before hook can reject updates', async () => {
		handlers.registerMiddleware({
			path: 'game',
			exports: { before: true },
			handler: {
				before: () => ({ reject: true, reason: 'rate_limited' })
			}
		})

		handlers.registerHandler({
			key: 'game/score',
			path: '/test/handler.js',
			exports: { named: [] },
			handler: {}
		})

		const result = await handlers.processUpdate(
			'game.score',
			['game', 'score'],
			{ score: 100 },
			undefined,
			createMockClient()
		)

		expect(result.accepted).toBe(false)
		expect(result.reason).toBe('rate_limited')
	})

	test('middleware before hook runs before handler validate', async () => {
		const order: string[] = []

		handlers.registerMiddleware({
			path: 'game',
			exports: { before: true },
			handler: {
				before: () => {
					order.push('middleware')
					return { continue: true }
				}
			}
		})

		handlers.registerHandler({
			key: 'game/score',
			path: '/test/handler.js',
			exports: { validate: true, named: [] },
			handler: {
				validate: () => {
					order.push('validate')
					return true
				}
			}
		})

		await handlers.processUpdate('game.score', ['game', 'score'], { score: 100 }, undefined, createMockClient())

		expect(order).toEqual(['middleware', 'validate'])
	})

	test('middleware runs in order from root to leaf', async () => {
		const order: string[] = []

		handlers.registerMiddleware({
			path: 'game',
			exports: { before: true },
			handler: {
				before: () => {
					order.push('root')
					return { continue: true }
				}
			}
		})

		handlers.registerMiddleware({
			path: 'game/room',
			exports: { before: true },
			handler: {
				before: () => {
					order.push('child')
					return { continue: true }
				}
			}
		})

		handlers.registerHandler({
			key: 'game/room/position',
			path: '/test/handler.js',
			exports: { named: [] },
			handler: {}
		})

		await handlers.processUpdate(
			'game.room.position',
			['game', 'room', 'position'],
			{ x: 0.5 },
			undefined,
			createMockClient()
		)

		expect(order).toEqual(['root', 'child'])
	})

	test('middleware can reject RPC calls', async () => {
		handlers.registerMiddleware({
			path: 'game',
			exports: { before: true },
			handler: {
				before: (ctx: SyncMiddlewareContext) => {
					if (ctx.messageType === 'call') {
						return { reject: true, reason: 'calls_disabled' }
					}
					return { continue: true }
				}
			}
		})

		handlers.registerHandler({
			key: 'game/room',
			path: '/test/handler.js',
			exports: { named: ['testCall'] },
			handler: {
				testCall: jest.fn()
			}
		})

		const zone = createMockZone()
		const result = await handlers.processCall(
			'game.room',
			['game', 'room'],
			'testCall',
			{},
			createMockClient(),
			zone
		)

		expect(result.success).toBe(false)
		expect(result.error).toBe('calls_disabled')
	})
})

describe('Integration: Handler + Server', () => {
	// These tests would require mocking the server, but demonstrate the flow

	test('client context contains id and metadata', () => {
		const client = createMockClient('user-123', { name: 'Test User' })

		expect(client.id).toBe('user-123')
		expect(client.data).toEqual({ name: 'Test User' })
	})

	test('zone API provides full state management', () => {
		const zone = createMockZone<{ count: number }>({ count: 0 })

		// State access
		expect(zone.getState()).toEqual({ count: 0 })

		// State update
		zone.setState({ count: 5 })
		expect(zone.getState()).toEqual({ count: 5 })

		// Client management
		zone._addClient(createMockClient('client-1'))
		zone._addClient(createMockClient('client-2'))
		expect(zone.getClients()).toHaveLength(2)

		// Broadcasting
		zone.broadcast({ event: 'test' })
		expect(zone._broadcasts).toEqual([{ event: 'test' }])

		// Targeted sending
		zone.send('client-1', { message: 'hello' })
		expect(zone._sends).toEqual([{ clientId: 'client-1', data: { message: 'hello' } }])
	})
})
