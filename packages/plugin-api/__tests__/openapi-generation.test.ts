import { describe, expect, it, beforeEach, afterEach } from '@jest/globals'
import { convertRouteToOpenAPIPath, generateOpenAPISpec } from '../src/core/openapi-generator.js'
import { readFile, rm, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('convertRouteToOpenAPIPath()', () => {
	it('converts single params', () => {
		expect(convertRouteToOpenAPIPath('users/[id]')).toBe('/users/{id}')
	})

	it('converts multiple params', () => {
		expect(convertRouteToOpenAPIPath('users/[userId]/posts/[postId]')).toBe('/users/{userId}/posts/{postId}')
	})

	it('converts catch-all params', () => {
		expect(convertRouteToOpenAPIPath('docs/[...slug]')).toBe('/docs/{slug}')
	})

	it('converts optional catch-all params', () => {
		expect(convertRouteToOpenAPIPath('docs/[[...slug]]')).toBe('/docs/{slug}')
	})

	it('handles plain routes', () => {
		expect(convertRouteToOpenAPIPath('users')).toBe('/users')
	})

	it('handles nested routes', () => {
		expect(convertRouteToOpenAPIPath('api/v1/users')).toBe('/api/v1/users')
	})
})

describe('generateOpenAPISpec()', () => {
	const testDir = path.join(__dirname, '.test-output')
	const testBuildDir = path.join(testDir, 'build')

	beforeEach(async () => {
		await mkdir(testBuildDir, { recursive: true })
	})

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true })
	})

	it('generates valid OpenAPI 3.1 spec', async () => {
		// Use the test fixture instead of dynamically creating a module
		const fixturesDir = path.join(__dirname, 'fixtures')

		const entries = [
			{
				key: 'test-route',
				path: path.relative(fixturesDir, path.join(fixturesDir, 'test-route.ts'))
			}
		]

		const outputPath = path.join(testDir, 'openapi.json')

		await generateOpenAPISpec(entries, fixturesDir, { outputPath })

		const content = await readFile(outputPath, 'utf-8')
		const spec = JSON.parse(content)

		expect(spec.openapi).toBe('3.1.0')
		expect(spec.info).toBeDefined()
		expect(spec.info.title).toBe('API')
		expect(spec.info.version).toBe('1.0.0')
		expect(spec.paths).toBeDefined()
		expect(spec.paths['/test-route']).toBeDefined()
		expect(spec.paths['/test-route'].post).toBeDefined()
		expect(spec.paths['/test-route'].post.summary).toBe('Test endpoint')
		expect(spec.paths['/test-route'].post.tags).toEqual(['test'])
	})

	it('skips generation when no entries', async () => {
		const outputPath = path.join(testDir, 'openapi.json')

		await generateOpenAPISpec([], testBuildDir, { outputPath })

		// File should not be created
		try {
			await readFile(outputPath, 'utf-8')
			throw new Error('File should not exist')
		} catch (error: any) {
			expect(error.code).toBe('ENOENT')
		}
	})

	it('accepts custom info fields', async () => {
		const entries = [] as any[]
		const outputPath = path.join(testDir, 'openapi.json')

		await generateOpenAPISpec(entries, testBuildDir, {
			outputPath,
			title: 'Custom API',
			version: '2.0.0',
			description: 'Test description',
			contact: { name: 'Test', email: 'test@example.com' },
			license: { name: 'MIT' }
		})

		// Should still not generate without entries
		try {
			await readFile(outputPath, 'utf-8')
			throw new Error('File should not exist without entries')
		} catch (error: any) {
			expect(error.code).toBe('ENOENT')
		}
	})
})
