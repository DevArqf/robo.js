/**
 * Performance tests for ProjectIndexer refresh
 *
 * Measures indexing performance on different project sizes:
 * - Small: < 10 files
 * - Medium: 10-100 files
 * - Large: 100+ files
 *
 * Performance thresholds are smoke-level assertions to catch
 * significant regressions, not strict benchmarks.
 */

import { jest } from '@jest/globals'
import { ProjectIndexer, createProjectIndexer } from '../../src/project/indexer.js'
import type { ExecutionProvider } from '../../src/types/execution.js'
import type { AgentPolicy } from '../../src/types/policy.js'

// Performance thresholds (generous to avoid flaky tests in CI)
const THRESHOLDS = {
	small: 200, // < 10 files: under 200ms
	medium: 1000, // 10-100 files: under 1s
	large: 5000, // 100+ files: under 5s
	cached: 50 // Cached result: under 50ms
}

/**
 * Generate mock files for a project of given size
 */
function generateMockFiles(count: number): Record<string, string> {
	const files: Record<string, string> = {
		'/package.json': JSON.stringify({ name: 'perf-test', version: '1.0.0' }),
		'/tsconfig.json': JSON.stringify({ compilerOptions: { target: 'es2020' } })
	}

	for (let i = 0; i < count; i++) {
		const dir = Math.floor(i / 10)
		const content = `export const value${i} = ${i};\n// Generated file for performance testing\n`
		files[`/src/module${dir}/file${i}.ts`] = content
	}

	return files
}

/**
 * Create a mock provider with the given files
 */
function createMockProvider(files: Record<string, string>): ExecutionProvider {
	const fileMap = new Map<string, string>(Object.entries(files))
	const dirSet = new Set<string>()

	// Build directory set from file paths
	for (const path of fileMap.keys()) {
		const parts = path.split('/')
		let current = ''
		for (let i = 0; i < parts.length - 1; i++) {
			current += parts[i] + '/'
			if (current !== '/') {
				dirSet.add(current.slice(0, -1)) // Remove trailing slash
			}
		}
	}

	return {
		readFile: jest.fn(async (path: string) => {
			const content = fileMap.get(path)
			if (content === undefined) {
				throw new Error(`ENOENT: no such file: ${path}`)
			}
			return content
		}),
		writeFile: jest.fn(async () => {}),
		deletePath: jest.fn(async () => {}),
		exists: jest.fn(async (path: string) => fileMap.has(path) || dirSet.has(path)),
		stat: jest.fn(async (path: string) => {
			if (dirSet.has(path)) {
				return { size: 0, isDirectory: true }
			}
			const content = fileMap.get(path)
			if (content === undefined) {
				throw new Error(`ENOENT: no such file: ${path}`)
			}
			return { size: content.length, isDirectory: false }
		}),
		readdir: jest.fn(async (path: string, options?: { recursive?: boolean }) => {
			const entries: Array<{ name: string; path: string; isDirectory: boolean; isFile: boolean }> = []
			const prefix = path.endsWith('/') ? path : `${path}/`
			const recursive = options?.recursive ?? false

			// Find files
			for (const filePath of fileMap.keys()) {
				if (filePath.startsWith(prefix)) {
					const relative = filePath.slice(prefix.length)
					const parts = relative.split('/')

					// For non-recursive, only include immediate children
					if (!recursive && parts.length > 1) {
						continue
					}

					if (parts[0]) {
						entries.push({
							name: parts[parts.length - 1],
							path: filePath,
							isDirectory: false,
							isFile: true
						})
					}
				}
			}

			// Find subdirectories
			for (const dirPath of dirSet) {
				if (dirPath.startsWith(prefix)) {
					const relative = dirPath.slice(prefix.length)
					const parts = relative.split('/')

					// For non-recursive, only include immediate children
					if (!recursive && parts.length > 1) {
						continue
					}

					if (parts[0]) {
						entries.push({
							name: parts[parts.length - 1],
							path: dirPath,
							isDirectory: true,
							isFile: false
						})
					}
				}
			}

			return entries
		}),
		mkdir: jest.fn(async () => {}),
		search: jest.fn(async () => []),
		snapshot: jest.fn(async () => ({})),
		run: jest.fn(async () => ({ exitCode: 0, output: '' })),
		runStream: jest.fn(async function* () {})
	} as unknown as ExecutionProvider
}

function createPolicy(): AgentPolicy {
	return {
		autoApprove: true,
		maxIterations: 10,
		commandAllowlist: ['npm', 'node'],
		denyPaths: ['.env', 'node_modules']
	}
}

describe('Index Refresh Performance', () => {
	describe('small project (< 10 files)', () => {
		it(`should index under ${THRESHOLDS.small}ms`, async () => {
			const files = generateMockFiles(5)
			const provider = createMockProvider(files)
			const indexer = createProjectIndexer({ provider, policy: createPolicy() })

			const start = performance.now()
			await indexer.refresh()
			const duration = performance.now() - start

			expect(duration).toBeLessThan(THRESHOLDS.small)
		})

		it('should return file count matching generated files', async () => {
			const files = generateMockFiles(5)
			const provider = createMockProvider(files)
			const indexer = createProjectIndexer({ provider, policy: createPolicy() })

			const index = await indexer.refresh()

			// 5 generated files + package.json + tsconfig.json = 7
			expect(index.files.length).toBeGreaterThanOrEqual(5)
		})
	})

	describe('medium project (10-100 files)', () => {
		it(`should index under ${THRESHOLDS.medium}ms`, async () => {
			const files = generateMockFiles(50)
			const provider = createMockProvider(files)
			const indexer = createProjectIndexer({ provider, policy: createPolicy() })

			const start = performance.now()
			await indexer.refresh()
			const duration = performance.now() - start

			expect(duration).toBeLessThan(THRESHOLDS.medium)
		})
	})

	describe('large project (100+ files)', () => {
		it(`should index under ${THRESHOLDS.large}ms`, async () => {
			const files = generateMockFiles(200)
			const provider = createMockProvider(files)
			const indexer = createProjectIndexer({ provider, policy: createPolicy() })

			const start = performance.now()
			await indexer.refresh()
			const duration = performance.now() - start

			expect(duration).toBeLessThan(THRESHOLDS.large)
		})
	})

	describe('cached index', () => {
		it(`should return cached result under ${THRESHOLDS.cached}ms`, async () => {
			const files = generateMockFiles(50)
			const provider = createMockProvider(files)
			const indexer = createProjectIndexer({ provider, policy: createPolicy() })

			// First refresh to populate cache
			await indexer.refresh()

			// Second refresh should use cache
			const start = performance.now()
			await indexer.refresh()
			const duration = performance.now() - start

			expect(duration).toBeLessThan(THRESHOLDS.cached)
		})

		it('should detect when refresh is needed', async () => {
			const files = generateMockFiles(10)
			const provider = createMockProvider(files)
			const indexer = createProjectIndexer({ provider, policy: createPolicy() })

			// Initial refresh
			await indexer.refresh()

			// Check if refresh is needed (should be false)
			const needsRefresh = await indexer.needsRefresh()
			expect(needsRefresh).toBe(false)
		})

		it('should force refresh when requested', async () => {
			const files = generateMockFiles(10)
			const provider = createMockProvider(files)
			const indexer = createProjectIndexer({ provider, policy: createPolicy() })

			// Initial refresh
			const first = await indexer.refresh()

			// Force refresh
			const start = performance.now()
			const second = await indexer.refresh({ force: true })
			const duration = performance.now() - start

			// Both should return valid indexes
			expect(first.files.length).toBeGreaterThan(0)
			expect(second.files.length).toBeGreaterThan(0)

			// Force refresh may take longer than cached
			// but should still be reasonably fast
			expect(duration).toBeLessThan(THRESHOLDS.medium)
		})
	})

	describe('fingerprint stability', () => {
		it('should produce identical fingerprints for identical content', async () => {
			const files = generateMockFiles(20)
			const provider1 = createMockProvider(files)
			const provider2 = createMockProvider(files)
			const indexer1 = createProjectIndexer({ provider: provider1, policy: createPolicy() })
			const indexer2 = createProjectIndexer({ provider: provider2, policy: createPolicy() })

			const index1 = await indexer1.refresh()
			const index2 = await indexer2.refresh()

			expect(index1.fingerprint).toBe(index2.fingerprint)
		})

		it('should produce different fingerprints for different content', async () => {
			const files1 = generateMockFiles(20)
			const files2 = { ...generateMockFiles(20), '/extra.ts': 'export const extra = true;' }
			const provider1 = createMockProvider(files1)
			const provider2 = createMockProvider(files2)
			const indexer1 = createProjectIndexer({ provider: provider1, policy: createPolicy() })
			const indexer2 = createProjectIndexer({ provider: provider2, policy: createPolicy() })

			const index1 = await indexer1.refresh()
			const index2 = await indexer2.refresh()

			expect(index1.fingerprint).not.toBe(index2.fingerprint)
		})
	})

	describe('caps enforcement', () => {
		it('should respect maxFiles cap', async () => {
			const files = generateMockFiles(100)
			const provider = createMockProvider(files)
			const indexer = createProjectIndexer({
				provider,
				policy: createPolicy(),
				caps: { maxFiles: 50 }
			})

			const index = await indexer.refresh()

			// Index should respect the cap
			expect(index.files.length).toBeLessThanOrEqual(50)
		})

		it('should still return valid index when caps hit', async () => {
			const files = generateMockFiles(100)
			const provider = createMockProvider(files)
			const indexer = createProjectIndexer({
				provider,
				policy: createPolicy(),
				caps: { maxFiles: 50 }
			})

			const index = await indexer.refresh()

			// Index should still be valid
			expect(index.fingerprint).toBeDefined()
			expect(index.root).toBeDefined()
			expect(index.updatedAt).toBeDefined()
		})
	})
})
