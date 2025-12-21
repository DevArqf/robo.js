/**
 * Flashcore v1 (spec rev 4.3) Phase 3 - FileAdapter Tests
 *
 * Tests specific to the v4 FileAdapter implementation.
 */

import { FileAdapter, createFileAdapter } from '../../../src/flashcore/adapter/builtins/file.js'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rm, readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

describe('FileAdapter', () => {
	const testDir = join(tmpdir(), `flashcore-file-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
	let adapter: FileAdapter

	beforeEach(async () => {
		adapter = new FileAdapter({ baseDir: testDir })
		await adapter.init()
	})

	afterEach(async () => {
		await adapter.shutdown()
		try {
			await rm(testDir, { recursive: true, force: true })
		} catch {
			// Ignore
		}
	})

	describe('Directory Initialization', () => {
		it('should create base directory on init', async () => {
			expect(existsSync(testDir)).toBe(true)
		})

		it('should create directory on first write if not exists', async () => {
			const freshDir = join(tmpdir(), `flashcore-fresh-${Date.now()}`)
			const freshAdapter = new FileAdapter({ baseDir: freshDir })

			// Don't call init - should create on first write
			await freshAdapter.set('key', 'value')

			expect(existsSync(freshDir)).toBe(true)

			await rm(freshDir, { recursive: true, force: true })
		})
	})

	describe('Key Encoding', () => {
		it('should handle simple alphanumeric keys', async () => {
			const key = 'simple-key_123'
			await adapter.set(key, 'value')
			expect(await adapter.get(key)).toBe('value')
		})

		it('should encode keys with special characters', async () => {
			const specialKeys = [
				'key/with/slashes',
				'key:with:colons',
				'key with spaces',
				'key<with>special&chars?',
				'key\\with\\backslashes',
				'unicode:日本語:🚀'
			]

			for (const key of specialKeys) {
				await adapter.set(key, { key })
				const result = await adapter.get(key)
				expect(result).toEqual({ key })
			}
		})

		it('should handle very long keys', async () => {
			// Use 100 chars - base64url encoding will expand but stay within filesystem limits
			const longKey = 'x'.repeat(100)
			await adapter.set(longKey, 'value')
			expect(await adapter.get(longKey)).toBe('value')
		})

		it('should handle empty-ish keys after encoding', async () => {
			const key = '...'
			await adapter.set(key, 'value')
			expect(await adapter.get(key)).toBe('value')
		})
	})

	describe('Atomic Writes', () => {
		it('should use atomic write (temp file + rename)', async () => {
			// Write a value
			await adapter.set('atomic-test', { data: 'test' })

			// Verify the final file exists
			const result = await adapter.get('atomic-test')
			expect(result).toEqual({ data: 'test' })

			// Verify no temp files remain
			const files = await readdir(testDir)
			const tempFiles = files.filter(f => f.includes('.tmp.'))
			expect(tempFiles).toHaveLength(0)
		})

		it('should handle concurrent writes to same key', async () => {
			const key = 'concurrent-key'

			// Start multiple writes concurrently
			await Promise.all([
				adapter.set(key, { value: 1 }),
				adapter.set(key, { value: 2 }),
				adapter.set(key, { value: 3 })
			])

			// One of the values should have won
			const result = await adapter.get(key)
			expect([1, 2, 3]).toContain((result as { value: number }).value)
		})

		it('should handle concurrent writes to different keys', async () => {
			const writes = Array.from({ length: 10 }, (_, i) => ({
				key: `concurrent-${i}`,
				value: { index: i }
			}))

			await Promise.all(writes.map(w => adapter.set(w.key, w.value)))

			// All writes should succeed
			for (const w of writes) {
				const result = await adapter.get(w.key)
				expect(result).toEqual(w.value)
			}
		})
	})

	describe('Scan Operation', () => {
		it('should scan by prefix correctly', async () => {
			await adapter.set('user:1', { id: 1 })
			await adapter.set('user:2', { id: 2 })
			await adapter.set('user:10', { id: 10 })
			await adapter.set('post:1', { id: 1 })

			const userKeys = await adapter.scan('user:')
			expect(userKeys.sort()).toEqual(['user:1', 'user:10', 'user:2'].sort())
		})

		it('should handle encoded keys in scan', async () => {
			await adapter.set('path/to/item1', 1)
			await adapter.set('path/to/item2', 2)
			await adapter.set('other/item', 3)

			const keys = await adapter.scan('path/')
			expect(keys.sort()).toEqual(['path/to/item1', 'path/to/item2'].sort())
		})

		it('should return empty for non-matching prefix', async () => {
			await adapter.set('key1', 'value')
			const result = await adapter.scan('nonexistent:')
			expect(result).toEqual([])
		})

		it('should scan all keys with empty prefix', async () => {
			await adapter.set('a', 1)
			await adapter.set('b', 2)
			await adapter.set('c', 3)

			const allKeys = await adapter.scan('')
			expect(allKeys.sort()).toEqual(['a', 'b', 'c'])
		})
	})

	describe('setIfNotExists', () => {
		it('should use exclusive file creation', async () => {
			// First call should succeed
			const result1 = await adapter.setIfNotExists('exclusive', 'first')
			expect(result1).toBe(true)
			expect(await adapter.get('exclusive')).toBe('first')

			// Second call should fail
			const result2 = await adapter.setIfNotExists('exclusive', 'second')
			expect(result2).toBe(false)
			expect(await adapter.get('exclusive')).toBe('first')
		})

		it('should handle concurrent setIfNotExists', async () => {
			const key = 'race-key'

			// Start multiple setIfNotExists concurrently
			const results = await Promise.all([
				adapter.setIfNotExists(key, 'winner1'),
				adapter.setIfNotExists(key, 'winner2'),
				adapter.setIfNotExists(key, 'winner3')
			])

			// Exactly one should succeed
			const successes = results.filter(r => r === true)
			expect(successes.length).toBe(1)
		})
	})

	describe('File Format', () => {
		it('should store JSON data', async () => {
			const key = 'json-test'
			const value = { complex: { nested: { data: true } } }

			await adapter.set(key, value)

			// Read raw file
			const files = await readdir(testDir)
			const jsonFile = files.find(f => f.endsWith('.json'))
			expect(jsonFile).toBeDefined()

			const content = await readFile(join(testDir, jsonFile!), 'utf-8')
			const parsed = JSON.parse(content)
			expect(parsed).toEqual(value)
		})

		it('should support pretty printing', async () => {
			const prettyAdapter = new FileAdapter({
				baseDir: join(testDir, 'pretty'),
				pretty: true
			})
			await prettyAdapter.init()

			await prettyAdapter.set('test', { a: 1, b: 2 })

			const files = await readdir(join(testDir, 'pretty'))
			const content = await readFile(join(testDir, 'pretty', files[0]), 'utf-8')

			// Pretty printed should have newlines
			expect(content).toContain('\n')

			await prettyAdapter.shutdown()
		})
	})

	describe('Error Handling', () => {
		it('should handle read of non-existent file gracefully', async () => {
			const result = await adapter.get('does-not-exist')
			expect(result).toBeUndefined()
		})

		it('should handle has() for non-existent file', async () => {
			const result = await adapter.has('does-not-exist')
			expect(result).toBe(false)
		})

		it('should handle delete of non-existent file', async () => {
			const result = await adapter.delete('does-not-exist')
			expect(result).toBe(false)
		})
	})

	describe('Factory Function', () => {
		it('should create adapter with createFileAdapter', async () => {
			const factoryAdapter = createFileAdapter({
				baseDir: join(testDir, 'factory')
			})

			await factoryAdapter.init()
			await factoryAdapter.set('test', 'value')
			expect(await factoryAdapter.get('test')).toBe('value')
			await factoryAdapter.shutdown()
		})
	})

	describe('Utilities', () => {
		it('should return base directory path', () => {
			expect(adapter.getBaseDir()).toBe(testDir)
		})

		it('should return all keys with keys()', async () => {
			await adapter.set('a', 1)
			await adapter.set('b', 2)
			await adapter.set('c', 3)

			const keys = await adapter.keys()
			expect(keys.sort()).toEqual(['a', 'b', 'c'])
		})

		it('should return correct size', async () => {
			expect(await adapter.size()).toBe(0)

			await adapter.set('a', 1)
			await adapter.set('b', 2)

			expect(await adapter.size()).toBe(2)

			await adapter.delete('a')
			expect(await adapter.size()).toBe(1)
		})
	})
})
