import { describe, expect, it } from '@jest/globals'
import { extractSchema, hasSchema } from '../src/core/schema-extractor.js'
import { define } from '../src/core/typed-endpoint.js'
import { z } from 'zod'

describe('extractSchema()', () => {
	it('extracts metadata from defined handler', async () => {
		const handler = define(
			{
				summary: 'Test endpoint',
				tags: ['test'],
				body: z.object({ name: z.string() })
			},
			async () => ({})
		)

		const extracted = await extractSchema(handler)

		expect(extracted?.summary).toBe('Test endpoint')
		expect(extracted?.tags).toEqual(['test'])
		expect(extracted?.body).toBeDefined()
	})

	it('returns null for plain handlers', async () => {
		const handler = async () => ({})
		const result = await extractSchema(handler)
		expect(result).toBeNull()
	})

	it('hasSchema returns true for defined handlers', () => {
		const defined = define({}, async () => ({}))
		const plain = async () => ({})

		expect(hasSchema(defined)).toBe(true)
		expect(hasSchema(plain)).toBe(false)
	})

	it('handles schema without zod-to-json-schema gracefully', async () => {
		const handler = define(
			{
				summary: 'Test',
				description: 'Description'
			},
			async () => ({})
		)

		const extracted = await extractSchema(handler)

		// Should return metadata even without zod-to-json-schema
		expect(extracted?.summary).toBe('Test')
		expect(extracted?.description).toBe('Description')
	})
})
