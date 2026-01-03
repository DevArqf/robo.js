/**
 * Unit tests for fingerprint computation
 */

import { describe, it, expect } from '@jest/globals'
import {
	computeFingerprint,
	computeFileFingerprint,
	computeQuickFingerprint,
	hashContent,
	hasFingerprintChanged,
	type FileFingerprint
} from '../../src/project/fingerprint.js'

describe('hashContent', () => {
	it('should produce consistent hashes for same content', () => {
		const content = 'Hello, World!'
		const hash1 = hashContent(content)
		const hash2 = hashContent(content)
		expect(hash1).toBe(hash2)
	})

	it('should produce different hashes for different content', () => {
		const hash1 = hashContent('Hello')
		const hash2 = hashContent('World')
		expect(hash1).not.toBe(hash2)
	})

	it('should handle empty string', () => {
		const hash = hashContent('')
		expect(hash).toBeTruthy()
		expect(hash.length).toBe(16) // 8 + 8 hex chars
	})

	it('should handle unicode content', () => {
		const hash = hashContent('Hello 🌍 世界')
		expect(hash).toBeTruthy()
		expect(hash.length).toBe(16)
	})

	it('should handle large content', () => {
		const content = 'x'.repeat(100000)
		const hash = hashContent(content)
		expect(hash).toBeTruthy()
	})
})

describe('computeFingerprint', () => {
	it('should produce stable fingerprint for same file set', () => {
		const files: FileFingerprint[] = [
			{ path: '/src/index.ts', size: 100, contentHash: 'abc123' },
			{ path: '/package.json', size: 500, contentHash: 'def456' }
		]

		const fp1 = computeFingerprint(files)
		const fp2 = computeFingerprint(files)
		expect(fp1).toBe(fp2)
	})

	it('should produce stable fingerprint regardless of input order', () => {
		const files1: FileFingerprint[] = [
			{ path: '/a.ts', size: 10, contentHash: 'a' },
			{ path: '/b.ts', size: 20, contentHash: 'b' }
		]
		const files2: FileFingerprint[] = [
			{ path: '/b.ts', size: 20, contentHash: 'b' },
			{ path: '/a.ts', size: 10, contentHash: 'a' }
		]

		expect(computeFingerprint(files1)).toBe(computeFingerprint(files2))
	})

	it('should change when file is added', () => {
		const files1: FileFingerprint[] = [{ path: '/a.ts', size: 10, contentHash: 'a' }]
		const files2: FileFingerprint[] = [
			{ path: '/a.ts', size: 10, contentHash: 'a' },
			{ path: '/b.ts', size: 20, contentHash: 'b' }
		]

		expect(computeFingerprint(files1)).not.toBe(computeFingerprint(files2))
	})

	it('should change when file is removed', () => {
		const files1: FileFingerprint[] = [
			{ path: '/a.ts', size: 10, contentHash: 'a' },
			{ path: '/b.ts', size: 20, contentHash: 'b' }
		]
		const files2: FileFingerprint[] = [{ path: '/a.ts', size: 10, contentHash: 'a' }]

		expect(computeFingerprint(files1)).not.toBe(computeFingerprint(files2))
	})

	it('should change when file size changes', () => {
		const files1: FileFingerprint[] = [{ path: '/a.ts', size: 10, contentHash: 'a' }]
		const files2: FileFingerprint[] = [{ path: '/a.ts', size: 20, contentHash: 'a' }]

		expect(computeFingerprint(files1)).not.toBe(computeFingerprint(files2))
	})

	it('should change when content hash changes', () => {
		const files1: FileFingerprint[] = [{ path: '/a.ts', size: 10, contentHash: 'a' }]
		const files2: FileFingerprint[] = [{ path: '/a.ts', size: 10, contentHash: 'b' }]

		expect(computeFingerprint(files1)).not.toBe(computeFingerprint(files2))
	})

	it('should change when mtime changes (for files without content hash)', () => {
		const files1: FileFingerprint[] = [{ path: '/a.ts', size: 10, mtimeMs: 1000 }]
		const files2: FileFingerprint[] = [{ path: '/a.ts', size: 10, mtimeMs: 2000 }]

		expect(computeFingerprint(files1)).not.toBe(computeFingerprint(files2))
	})

	it('should handle empty project', () => {
		const fp = computeFingerprint([])
		expect(fp).toBeTruthy()
		expect(fp.length).toBeGreaterThan(0)
	})

	it('should produce valid fingerprint for project with many files', () => {
		const files: FileFingerprint[] = []
		for (let i = 0; i < 1000; i++) {
			files.push({ path: `/file${i}.ts`, size: i * 10, contentHash: `hash${i}` })
		}

		const fp = computeFingerprint(files)
		expect(fp).toBeTruthy()
		expect(fp.length).toBe(16)
	})
})

describe('computeFileFingerprint', () => {
	it('should compute content hash for small files', () => {
		const content = 'console.log("hello")'
		const result = computeFileFingerprint('/test.ts', content, content.length)

		expect(result.path).toBe('/test.ts')
		expect(result.size).toBe(content.length)
		expect(result.contentHash).toBeTruthy()
	})

	it('should not compute content hash for large files', () => {
		const largeContent = 'x'.repeat(300000) // > 256KB threshold
		const result = computeFileFingerprint('/large.ts', largeContent, largeContent.length, 1234567890)

		expect(result.path).toBe('/large.ts')
		expect(result.size).toBe(largeContent.length)
		expect(result.contentHash).toBeUndefined()
		expect(result.mtimeMs).toBe(1234567890)
	})

	it('should use custom threshold', () => {
		const content = 'small content'
		const result = computeFileFingerprint('/test.ts', content, content.length, undefined, 5) // threshold of 5 bytes

		expect(result.contentHash).toBeUndefined() // content.length > 5
	})

	it('should handle null content (for large files)', () => {
		const result = computeFileFingerprint('/big.ts', null, 1000000, 1234567890)

		expect(result.contentHash).toBeUndefined()
		expect(result.mtimeMs).toBe(1234567890)
	})
})

describe('computeQuickFingerprint', () => {
	it('should produce fingerprint from paths and sizes only', () => {
		const files = [
			{ path: '/a.ts', size: 100 },
			{ path: '/b.ts', size: 200 }
		]

		const fp = computeQuickFingerprint(files)
		expect(fp).toBeTruthy()
		expect(fp.startsWith('q-')).toBe(true)
	})

	it('should be stable for same file set', () => {
		const files = [
			{ path: '/a.ts', size: 100 },
			{ path: '/b.ts', size: 200 }
		]

		expect(computeQuickFingerprint(files)).toBe(computeQuickFingerprint(files))
	})

	it('should be order-independent', () => {
		const files1 = [
			{ path: '/a.ts', size: 100 },
			{ path: '/b.ts', size: 200 }
		]
		const files2 = [
			{ path: '/b.ts', size: 200 },
			{ path: '/a.ts', size: 100 }
		]

		expect(computeQuickFingerprint(files1)).toBe(computeQuickFingerprint(files2))
	})

	it('should handle empty project', () => {
		const fp = computeQuickFingerprint([])
		expect(fp).toBeTruthy()
	})
})

describe('hasFingerprintChanged', () => {
	it('should return false for identical fingerprints', () => {
		expect(hasFingerprintChanged('abc123', 'abc123')).toBe(false)
	})

	it('should return true for different fingerprints', () => {
		expect(hasFingerprintChanged('abc123', 'def456')).toBe(true)
	})

	it('should work with actual computed fingerprints', () => {
		const files: FileFingerprint[] = [{ path: '/test.ts', size: 100, contentHash: 'test' }]
		const fp = computeFingerprint(files)

		expect(hasFingerprintChanged(fp, fp)).toBe(false)
		expect(hasFingerprintChanged(fp, 'different')).toBe(true)
	})
})
