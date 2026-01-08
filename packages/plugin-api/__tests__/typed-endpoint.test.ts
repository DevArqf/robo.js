import { describe, expect, it, jest } from '@jest/globals'
import type { RoboReply } from '../src/core/types.js'
import { RoboRequest } from '../src/core/robo-request.js'
import { define, SCHEMA_SYMBOL } from '../src/core/typed-endpoint.js'
import { z } from 'zod'

function createMockReply(): RoboReply {
	const reply = {
		raw: {} as RoboReply['raw'],
		hasSent: false,
		code: jest.fn(),
		header: jest.fn(),
		json: jest.fn(),
		send: jest.fn()
	} as any

	reply.code = jest.fn(() => reply)
	reply.header = jest.fn(() => reply)
	reply.json = jest.fn(() => reply)
	reply.send = jest.fn(() => reply)

	return reply as RoboReply
}

describe('define()', () => {
	it('attaches schema symbol to handler', () => {
		const schema = { body: z.object({ name: z.string() }) }
		const handler = define(schema, async () => ({ ok: true }))

		expect(handler[SCHEMA_SYMBOL]).toBe(schema)
	})

	it('keeps handler callable', async () => {
		const handler = define({}, async () => ({ called: true }))
		const request = RoboRequest.forTesting({ method: 'GET' })

		const result = await handler(request, createMockReply())

		expect(result).toEqual({ called: true })
	})

	it('provides a header accessor backed by request headers', async () => {
		const handler = define(
			{
				headers: z.object({ 'x-api-key': z.string() })
			},
			async (request) => ({
				key: request.header('x-api-key'),
				missing: request.header('x-missing')
			})
		)

		const request = RoboRequest.forTesting({
			headers: { 'x-api-key': 'secret123' }
		})

		const result = await handler(request, createMockReply())

		expect(result).toEqual({ key: 'secret123', missing: null })
	})

	it('does not pre-parse the request body', async () => {
		const handler = define(
			{
				body: z.object({ name: z.string() })
			},
			async (request) => {
				const before = request.bodyUsed
				const body = await request.json()

				return { before, body }
			}
		)

		const request = RoboRequest.forTesting({
			method: 'POST',
			body: { name: 'Robo' }
		})

		const result = await handler(request, createMockReply())

		expect(result).toEqual({ before: false, body: { name: 'Robo' } })
	})
})
