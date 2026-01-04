/**
 * Unit tests for ProjectOverviewBuilder
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import {
	ProjectOverviewBuilder,
	createProjectOverviewBuilder,
	type ProjectOverviewBuilderConfig
} from '../../src/project/overview.js'
import { ProjectIndexer } from '../../src/project/indexer.js'
import type { ExecutionProvider } from '../../src/types/execution.js'
import type { AgentPolicy } from '../../src/types/policy.js'
import type { DirEntry, FileStat } from '../../src/types/terminal.js'

/**
 * Create a mock provider for testing
 */
function createMockProvider(files: Record<string, string> = {}): ExecutionProvider {
	const mockProvider: ExecutionProvider = {
		readFile: jest.fn(async (path: string) => {
			if (files[path]) return files[path]
			throw new Error(`File not found: ${path}`)
		}),
		writeFile: jest.fn(async () => {}),
		deletePath: jest.fn(async () => {}),
		exists: jest.fn(async (path: string) => {
			return path in files
		}),
		readdir: jest.fn(async (path: string, opts?: { recursive?: boolean }): Promise<DirEntry[]> => {
			const entries: DirEntry[] = []
			const seenDirs = new Set<string>()

			for (const filePath of Object.keys(files)) {
				const prefix = path === '/' ? '/' : path + '/'
				if (!filePath.startsWith(prefix) && filePath !== path) continue

				const relativePath = filePath.slice(prefix.length)
				const parts = relativePath.split('/').filter(Boolean)

				if (opts?.recursive) {
					let currentPath = prefix.slice(0, -1)
					for (let i = 0; i < parts.length - 1; i++) {
						currentPath += '/' + parts[i]
						if (!seenDirs.has(currentPath)) {
							seenDirs.add(currentPath)
							entries.push({
								name: parts[i],
								path: currentPath,
								isDirectory: true,
								isFile: false
							})
						}
					}

					if (parts.length > 0) {
						entries.push({
							name: parts[parts.length - 1],
							path: filePath,
							isDirectory: false,
							isFile: true
						})
					}
				} else {
					if (parts.length === 1) {
						entries.push({
							name: parts[0],
							path: filePath,
							isDirectory: false,
							isFile: true
						})
					} else if (parts.length > 1 && !seenDirs.has(prefix + parts[0])) {
						seenDirs.add(prefix + parts[0])
						entries.push({
							name: parts[0],
							path: prefix + parts[0],
							isDirectory: true,
							isFile: false
						})
					}
				}
			}

			return entries
		}),
		mkdir: jest.fn(async () => {}),
		stat: jest.fn(async (path: string): Promise<FileStat> => {
			if (files[path]) {
				return { size: files[path].length, isDirectory: false, mtimeMs: 1000000 }
			}
			const prefix = path.endsWith('/') ? path : path + '/'
			if (Object.keys(files).some((f) => f.startsWith(prefix))) {
				return { size: 0, isDirectory: true, mtimeMs: 1000000 }
			}
			throw new Error(`Not found: ${path}`)
		}),
		search: jest.fn(async () => []),
		snapshot: jest.fn(async () => ({})),
		run: jest.fn(async () => ({ exitCode: 0, output: '' })),
		runStream: jest.fn(async function* () {}),
		startSession: jest.fn(async () => ({ id: 'test' })),
		stopSession: jest.fn(async () => {}),
		streamSession: jest.fn(async function* () {})
	}

	return mockProvider
}

function createPolicy(overrides: Partial<AgentPolicy> = {}): AgentPolicy {
	return {
		autoApprove: false,
		maxIterations: 10,
		commandAllowlist: ['npm', 'node'],
		denyPaths: [],
		...overrides
	}
}

describe('ProjectOverviewBuilder', () => {
	describe('refresh', () => {
		it('should build overview with package info', async () => {
			const provider = createMockProvider({
				'/package.json': JSON.stringify({
					name: 'test-project',
					version: '1.0.0',
					dependencies: { express: '^4.0.0' },
					devDependencies: { typescript: '^5.0.0' }
				})
			})
			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })
			const builder = new ProjectOverviewBuilder({ provider, policy, indexer })

			const overview = await builder.refresh()

			expect(overview).toBeDefined()
			expect(overview.package.name).toBe('test-project')
			expect(overview.package.dependencies).toContain('express')
			expect(overview.package.devDependencies).toContain('typescript')
		})

		it('should identify key files', async () => {
			const provider = createMockProvider({
				'/package.json': '{}',
				'/tsconfig.json': '{}',
				'/README.md': '# Test'
			})
			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })
			const builder = new ProjectOverviewBuilder({ provider, policy, indexer })

			const overview = await builder.refresh()

			const paths = overview.keyFiles.map((kf) => kf.path)
			expect(paths).toContain('/package.json')
			expect(paths).toContain('/tsconfig.json')
			expect(paths).toContain('/README.md')
		})

		it('should build summary for Robo project', async () => {
			const provider = createMockProvider({
				'/package.json': JSON.stringify({
					name: 'my-bot',
					dependencies: { 'robo.js': '^1.0.0', '@robojs/discordjs': '^1.0.0' }
				}),
				'/src/commands/ping.ts': 'export default () => "pong"'
			})

			// Override stat and exists for directory detection
			;(provider.stat as jest.Mock<typeof provider.stat>).mockImplementation(async (path: string) => {
				if (path === '/src/commands') {
					return { size: 0, isDirectory: true, mtimeMs: 1000 }
				}
				const files = { '/package.json': '{}', '/src/commands/ping.ts': '' } as Record<string, string>
				if (files[path]) {
					return { size: files[path].length, isDirectory: false, mtimeMs: 1000 }
				}
				throw new Error(`Not found: ${path}`)
			})
			;(provider.exists as jest.Mock<typeof provider.exists>).mockImplementation(async (path: string) => {
				return ['/package.json', '/src/commands', '/src/commands/ping.ts'].includes(path)
			})

			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })
			const builder = new ProjectOverviewBuilder({ provider, policy, indexer })

			const overview = await builder.refresh()

			expect(overview.summary).toContain('bot')
			expect(overview.robo).toBeDefined()
			expect(overview.robo?.kind).toBe('bot')
		})

		it('should extract constraints', async () => {
			const provider = createMockProvider({
				'/package.json': JSON.stringify({
					name: 'ts-project',
					dependencies: { 'robo.js': '^1.0.0' },
					devDependencies: { typescript: '^5.0.0' }
				})
			})
			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })
			const builder = new ProjectOverviewBuilder({ provider, policy, indexer })

			const overview = await builder.refresh()

			expect(overview.constraints).toContain('TypeScript project')
			expect(overview.constraints).toContain('Uses Robo.js framework')
		})

		it('should preserve decisions and changelog across refreshes', async () => {
			const provider = createMockProvider({
				'/package.json': '{}'
			})
			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })
			const builder = new ProjectOverviewBuilder({ provider, policy, indexer })

			await builder.refresh()
			builder.addDecision('Test topic', 'Test decision')
			builder.addChange('Test change', ['/test.ts'])

			const overview = await builder.refresh()

			expect(overview.decisions.length).toBe(1)
			expect(overview.decisions[0].topic).toBe('Test topic')
			expect(overview.changeLog.length).toBe(1)
			expect(overview.changeLog[0].summary).toBe('Test change')
		})
	})

	describe('getOverview', () => {
		it('should return null before refresh', () => {
			const provider = createMockProvider({})
			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })
			const builder = new ProjectOverviewBuilder({ provider, policy, indexer })

			expect(builder.getOverview()).toBeNull()
		})

		it('should return overview after refresh', async () => {
			const provider = createMockProvider({
				'/package.json': '{}'
			})
			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })
			const builder = new ProjectOverviewBuilder({ provider, policy, indexer })

			await builder.refresh()
			const overview = builder.getOverview()

			expect(overview).not.toBeNull()
		})
	})

	describe('addDecision', () => {
		it('should add decision to overview', async () => {
			const provider = createMockProvider({
				'/package.json': '{}'
			})
			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })
			const builder = new ProjectOverviewBuilder({ provider, policy, indexer })

			await builder.refresh()
			builder.addDecision('API design', 'Use REST endpoints')

			const overview = builder.getOverview()
			expect(overview?.decisions.length).toBe(1)
			expect(overview?.decisions[0].topic).toBe('API design')
			expect(overview?.decisions[0].decision).toBe('Use REST endpoints')
			expect(overview?.decisions[0].when).toBeTruthy()
		})

		it('should respect maxDecisions cap', async () => {
			const provider = createMockProvider({
				'/package.json': '{}'
			})
			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })
			const builder = new ProjectOverviewBuilder({
				provider,
				policy,
				indexer,
				caps: {
					maxCommands: 100,
					maxEvents: 100,
					maxApiRoutes: 100,
					maxFlashcoreSchemas: 50,
					maxKeyFiles: 20,
					maxConstraints: 20,
					maxDecisions: 3,
					maxChangeLogEntries: 200
				}
			})

			await builder.refresh()

			for (let i = 0; i < 10; i++) {
				builder.addDecision(`Topic ${i}`, `Decision ${i}`)
			}

			const overview = builder.getOverview()
			expect(overview?.decisions.length).toBe(3)
			// Should keep the most recent
			expect(overview?.decisions[2].topic).toBe('Topic 9')
		})

		it('should not add decision if overview not built', () => {
			const provider = createMockProvider({})
			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })
			const builder = new ProjectOverviewBuilder({ provider, policy, indexer })

			// Should not throw
			builder.addDecision('Topic', 'Decision')
			expect(builder.getOverview()).toBeNull()
		})
	})

	describe('addChange', () => {
		it('should add change to changelog', async () => {
			const provider = createMockProvider({
				'/package.json': '{}'
			})
			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })
			const builder = new ProjectOverviewBuilder({ provider, policy, indexer })

			await builder.refresh()
			builder.addChange('Added ping command', ['/src/commands/ping.ts'])

			const overview = builder.getOverview()
			expect(overview?.changeLog.length).toBe(1)
			expect(overview?.changeLog[0].summary).toBe('Added ping command')
			expect(overview?.changeLog[0].files).toContain('/src/commands/ping.ts')
		})

		it('should respect maxChangeLogEntries cap', async () => {
			const provider = createMockProvider({
				'/package.json': '{}'
			})
			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })
			const builder = new ProjectOverviewBuilder({
				provider,
				policy,
				indexer,
				caps: {
					maxCommands: 100,
					maxEvents: 100,
					maxApiRoutes: 100,
					maxFlashcoreSchemas: 50,
					maxKeyFiles: 20,
					maxConstraints: 20,
					maxDecisions: 100,
					maxChangeLogEntries: 5
				}
			})

			await builder.refresh()

			for (let i = 0; i < 20; i++) {
				builder.addChange(`Change ${i}`, [`/file${i}.ts`])
			}

			const overview = builder.getOverview()
			expect(overview?.changeLog.length).toBe(5)
			// Should keep the most recent
			expect(overview?.changeLog[4].summary).toBe('Change 19')
		})

		it('should update overview timestamp', async () => {
			const provider = createMockProvider({
				'/package.json': '{}'
			})
			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })
			const builder = new ProjectOverviewBuilder({ provider, policy, indexer })

			await builder.refresh()
			const before = builder.getOverview()?.updatedAt

			await new Promise((resolve) => setTimeout(resolve, 2))
			builder.addChange('Some change', ['/file.ts'])

			const after = builder.getOverview()?.updatedAt
			expect(after).not.toBe(before)
		})
	})
})

describe('createProjectOverviewBuilder', () => {
	it('should create a builder instance', () => {
		const provider = createMockProvider({})
		const policy = createPolicy()
		const indexer = new ProjectIndexer({ provider, policy })
		const builder = createProjectOverviewBuilder({ provider, policy, indexer })

		expect(builder).toBeInstanceOf(ProjectOverviewBuilder)
	})
})
