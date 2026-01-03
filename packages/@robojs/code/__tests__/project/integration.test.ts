/**
 * Integration tests for ProjectIndexer and ProjectOverviewBuilder
 *
 * Tests against real fixture directories to verify end-to-end behavior.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { ProjectIndexer } from '../../src/project/indexer.js'
import { ProjectOverviewBuilder } from '../../src/project/overview.js'
import { computeFingerprint, hasFingerprintChanged } from '../../src/project/fingerprint.js'
import type { ExecutionProvider } from '../../src/types/execution.js'
import type { AgentPolicy } from '../../src/types/policy.js'
import type { DirEntry, FileStat } from '../../src/types/terminal.js'

/**
 * Create a mock provider backed by an in-memory file system
 */
function createMockProvider(files: Record<string, string> = {}): ExecutionProvider {
	const mockProvider: ExecutionProvider = {
		readFile: jest.fn(async (path: string) => {
			if (files[path]) return files[path]
			throw new Error(`ENOENT: no such file or directory, open '${path}'`)
		}),
		writeFile: jest.fn(async () => {}),
		deletePath: jest.fn(async () => {}),
		exists: jest.fn(async (path: string) => {
			// Check if path exists as file
			if (path in files) return true
			// Check if path exists as directory (any file starts with path/)
			const prefix = path.endsWith('/') ? path : path + '/'
			return Object.keys(files).some((f) => f.startsWith(prefix) || f === path)
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
					// Add intermediate directories
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

					// Add the file
					if (parts.length > 0) {
						entries.push({
							name: parts[parts.length - 1],
							path: filePath,
							isDirectory: false,
							isFile: true
						})
					}
				} else {
					// Non-recursive: only immediate children
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
				return { size: files[path].length, isDirectory: false, mtimeMs: Date.now() }
			}
			// Check if it's a directory
			const prefix = path.endsWith('/') ? path : path + '/'
			if (Object.keys(files).some((f) => f.startsWith(prefix))) {
				return { size: 0, isDirectory: true, mtimeMs: Date.now() }
			}
			throw new Error(`ENOENT: no such file or directory, stat '${path}'`)
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
		denyPaths: ['node_modules', '.git', '.env'],
		...overrides
	}
}

describe('Integration Tests', () => {
	describe('Simple Project', () => {
		const simpleProjectFiles = {
			'/package.json': JSON.stringify({
				name: 'simple-project',
				version: '1.0.0',
				scripts: {
					start: 'node src/index.js',
					test: 'jest'
				},
				dependencies: {
					express: '^4.18.0'
				},
				devDependencies: {
					jest: '^29.0.0',
					typescript: '^5.0.0'
				}
			}),
			'/src/index.ts': 'console.log("Hello, World!")',
			'/README.md': '# Simple Project\n\nA simple test project.'
		}

		it('should build index for simple project', async () => {
			const provider = createMockProvider(simpleProjectFiles)
			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })

			const index = await indexer.refresh()

			expect(index).toBeDefined()
			expect(index.root).toBe('/')
			expect(index.fingerprint).toBeTruthy()
			expect(index.files.length).toBe(3)
			expect(index.files.map((f) => f.path)).toContain('/package.json')
			expect(index.files.map((f) => f.path)).toContain('/src/index.ts')
			expect(index.files.map((f) => f.path)).toContain('/README.md')
			expect(index.robo).toBeUndefined() // Not a Robo project
		})

		it('should build overview for simple project', async () => {
			const provider = createMockProvider(simpleProjectFiles)
			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })
			const builder = new ProjectOverviewBuilder({ provider, policy, indexer })

			const overview = await builder.refresh()

			expect(overview).toBeDefined()
			expect(overview.package.name).toBe('simple-project')
			expect(overview.package.version).toBe('1.0.0')
			// Scripts should be extracted
			expect(overview.package.scripts).toBeDefined()
			expect(overview.package.scripts?.start).toBe('node src/index.js')
			expect(overview.package.scripts?.test).toBe('jest')
			expect(overview.package.dependencies).toContain('express')
			expect(overview.package.devDependencies).toContain('jest')
			expect(overview.package.devDependencies).toContain('typescript')

			// Key files should be identified
			const keyFilePaths = overview.keyFiles.map((kf) => kf.path)
			expect(keyFilePaths).toContain('/package.json')
			expect(keyFilePaths).toContain('/README.md')

			// Constraints should include TypeScript
			expect(overview.constraints).toContain('TypeScript project')

			// Not a Robo project
			expect(overview.robo).toBeUndefined()
		})

		it('should detect fingerprint changes', async () => {
			const provider = createMockProvider(simpleProjectFiles)
			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })

			const index1 = await indexer.refresh()
			const fingerprint1 = index1.fingerprint

			// Modify a file (simulate by creating new provider)
			const modifiedFiles = {
				...simpleProjectFiles,
				'/src/index.ts': 'console.log("Hello, Modified World!")'
			}
			const provider2 = createMockProvider(modifiedFiles)
			const indexer2 = new ProjectIndexer({ provider: provider2, policy })

			const index2 = await indexer2.refresh()
			const fingerprint2 = index2.fingerprint

			expect(hasFingerprintChanged(fingerprint1, fingerprint2)).toBe(true)
		})
	})

	describe('Robo Bot Project', () => {
		const roboBotFiles = {
			'/package.json': JSON.stringify({
				name: 'my-discord-bot',
				version: '1.0.0',
				dependencies: {
					'robo.js': '^0.10.0',
					'@robojs/discordjs': '^0.2.0',
					'discord.js': '^14.0.0'
				},
				devDependencies: {
					typescript: '^5.0.0',
					'@robojs/mock': '^0.1.0'
				}
			}),
			'/src/commands/ping.ts': 'export default function ping() {\n  return "Pong!"\n}',
			'/src/commands/help.ts': 'export default function help() {\n  return "Help message"\n}',
			'/src/events/ready.ts':
				'import type { Client } from "discord.js"\nexport default function ready(client: Client) {\n  console.log("Ready!")\n}',
			'/src/events/messageCreate.ts':
				'import type { Message } from "discord.js"\nexport default function messageCreate(message: Message) {\n  console.log(message.content)\n}',
			'/tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ES2022',
					module: 'ESNext'
				}
			})
		}

		it('should detect Robo bot project in index', async () => {
			const provider = createMockProvider(roboBotFiles)
			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })

			const index = await indexer.refresh()

			expect(index.robo).toBeDefined()
			expect(index.robo?.kind).toBe('bot')
			expect(index.robo?.plugins).toContain('@robojs/discordjs')
			expect(index.robo?.hasMock).toBe(true)
			expect(index.robo?.commandsDir).toBe('/src/commands')
			expect(index.robo?.eventsDir).toBe('/src/events')
		})

		it('should build Robo overview with commands and events', async () => {
			const provider = createMockProvider(roboBotFiles)
			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })
			const builder = new ProjectOverviewBuilder({ provider, policy, indexer })

			const overview = await builder.refresh()

			expect(overview.robo).toBeDefined()
			expect(overview.robo?.kind).toBe('bot')
			expect(overview.robo?.plugins).toContain('@robojs/discordjs')

			// Commands should be discovered (prefixed with /)
			expect(overview.robo?.commands).toBeDefined()
			expect(overview.robo?.commands).toContain('/ping')
			expect(overview.robo?.commands).toContain('/help')

			// Events should be discovered
			expect(overview.robo?.events).toBeDefined()
			expect(overview.robo?.events).toContain('ready')
			expect(overview.robo?.events).toContain('messageCreate')

			// Mock support should be detected
			expect(overview.robo?.mock?.supported).toBe(true)

			// Constraints should include Robo framework
			expect(overview.constraints).toContain('Uses Robo.js framework')
		})

		it('should detect bot+api project kind', async () => {
			const botApiFiles = {
				...roboBotFiles,
				'/src/api/health.ts': 'export default function health() { return { status: "ok" } }',
				'/src/api/users/[id].ts': 'export default function getUser(req) { return req.params.id }'
			}

			const provider = createMockProvider(botApiFiles)
			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })
			const builder = new ProjectOverviewBuilder({ provider, policy, indexer })

			const index = await indexer.refresh()
			const overview = await builder.refresh()

			expect(index.robo?.kind).toBe('bot+api')
			expect(index.robo?.apiDir).toBe('/src/api')

			expect(overview.robo?.kind).toBe('bot+api')
			expect(overview.robo?.apiRoutes).toBeDefined()
			expect(overview.robo?.apiRoutes).toContain('/health')
			expect(overview.robo?.apiRoutes).toContain('/users/:id')
		})
	})

	describe('Activity Project', () => {
		const activityFiles = {
			'/package.json': JSON.stringify({
				name: 'my-discord-activity',
				version: '1.0.0',
				dependencies: {
					'robo.js': '^0.10.0',
					'@discord/embedded-app-sdk': '^1.0.0',
					react: '^18.0.0'
				}
			}),
			'/src/app/App.tsx': 'export default function App() { return <div>Activity</div> }',
			'/src/api/activity.ts': 'export default function activity() { return {} }'
		}

		it('should detect activity project', async () => {
			const provider = createMockProvider(activityFiles)
			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })

			const index = await indexer.refresh()

			expect(index.robo).toBeDefined()
			expect(index.robo?.kind).toBe('activity')
		})
	})

	describe('Large Project Simulation', () => {
		it('should handle large file counts efficiently', async () => {
			// Generate a large number of files
			const files: Record<string, string> = {
				'/package.json': JSON.stringify({ name: 'large-project', version: '1.0.0' })
			}

			// Create 500 files (not too many to slow down tests)
			for (let i = 0; i < 500; i++) {
				files[`/src/modules/module${i}/index.ts`] = `export const module${i} = ${i}`
				files[`/src/modules/module${i}/types.ts`] = `export type Module${i}Type = number`
			}

			const provider = createMockProvider(files)
			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })

			const startTime = Date.now()
			const index = await indexer.refresh()
			const elapsed = Date.now() - startTime

			// Should complete in reasonable time (< 2 seconds)
			expect(elapsed).toBeLessThan(2000)

			// Should index all files
			expect(index.files.length).toBe(1001) // package.json + 500*2 module files

			// Fingerprint should be computed
			expect(index.fingerprint).toBeTruthy()
		})

		it('should respect maxFiles cap', async () => {
			// Generate more files than the cap
			const files: Record<string, string> = {
				'/package.json': JSON.stringify({ name: 'capped-project', version: '1.0.0' })
			}

			for (let i = 0; i < 100; i++) {
				files[`/src/file${i}.ts`] = `export const val = ${i}`
			}

			const provider = createMockProvider(files)
			const policy = createPolicy()
			const indexer = new ProjectIndexer({
				provider,
				policy,
				caps: {
					maxFiles: 50,
					maxDirs: 100,
					largeFileThreshold: 256 * 1024
				}
			})

			const index = await indexer.refresh()

			// Should be capped at maxFiles
			expect(index.files.length).toBe(50)
		})
	})

	describe('Decisions and Changelog', () => {
		it('should maintain decisions across overview refreshes', async () => {
			const files = {
				'/package.json': JSON.stringify({ name: 'decision-test', version: '1.0.0' })
			}

			const provider = createMockProvider(files)
			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })
			const builder = new ProjectOverviewBuilder({ provider, policy, indexer })

			await builder.refresh()

			// Add some decisions
			builder.addDecision('Architecture', 'Use modular design')
			builder.addDecision('Testing', 'Use Jest with integration tests')

			// Refresh overview
			const overview = await builder.refresh()

			// Decisions should persist
			expect(overview.decisions.length).toBe(2)
			expect(overview.decisions[0].topic).toBe('Architecture')
			expect(overview.decisions[1].topic).toBe('Testing')
		})

		it('should maintain changelog across overview refreshes', async () => {
			const files = {
				'/package.json': JSON.stringify({ name: 'changelog-test', version: '1.0.0' })
			}

			const provider = createMockProvider(files)
			const policy = createPolicy()
			const indexer = new ProjectIndexer({ provider, policy })
			const builder = new ProjectOverviewBuilder({ provider, policy, indexer })

			await builder.refresh()

			// Add some changes
			builder.addChange('Added user authentication', ['/src/auth/login.ts', '/src/auth/logout.ts'])
			builder.addChange('Fixed bug in pagination', ['/src/utils/paginate.ts'])

			// Refresh overview
			const overview = await builder.refresh()

			// Changelog should persist
			expect(overview.changeLog.length).toBe(2)
			expect(overview.changeLog[0].summary).toBe('Added user authentication')
			expect(overview.changeLog[0].files).toContain('/src/auth/login.ts')
			expect(overview.changeLog[1].summary).toBe('Fixed bug in pagination')
		})
	})

	describe('Fingerprint Stability', () => {
		it('should produce stable fingerprints for same file content', async () => {
			const files = {
				'/package.json': '{"name":"test"}',
				'/src/index.ts': 'console.log("hello")'
			}

			const provider1 = createMockProvider(files)
			const provider2 = createMockProvider(files)
			const policy = createPolicy()

			const indexer1 = new ProjectIndexer({ provider: provider1, policy })
			const indexer2 = new ProjectIndexer({ provider: provider2, policy })

			const index1 = await indexer1.refresh()
			const index2 = await indexer2.refresh()

			expect(index1.fingerprint).toBe(index2.fingerprint)
		})

		it('should detect fingerprint change on file addition', async () => {
			const files1 = {
				'/package.json': '{"name":"test"}'
			}

			const files2 = {
				'/package.json': '{"name":"test"}',
				'/src/new-file.ts': 'export const x = 1'
			}

			const provider1 = createMockProvider(files1)
			const provider2 = createMockProvider(files2)
			const policy = createPolicy()

			const indexer1 = new ProjectIndexer({ provider: provider1, policy })
			const indexer2 = new ProjectIndexer({ provider: provider2, policy })

			const index1 = await indexer1.refresh()
			const index2 = await indexer2.refresh()

			expect(hasFingerprintChanged(index1.fingerprint, index2.fingerprint)).toBe(true)
		})
	})

	describe('Deny Paths', () => {
		it('should exclude denied paths from index', async () => {
			const files = {
				'/package.json': '{"name":"test"}',
				'/src/index.ts': 'console.log("hello")',
				'/node_modules/lodash/index.js': 'module.exports = {}',
				'/.git/config': '[core]',
				'/.env': 'SECRET=abc123'
			}

			const provider = createMockProvider(files)
			const policy = createPolicy({
				denyPaths: ['node_modules', '.git', '.env']
			})

			const indexer = new ProjectIndexer({ provider, policy })
			const index = await indexer.refresh()

			const paths = index.files.map((f) => f.path)

			expect(paths).toContain('/package.json')
			expect(paths).toContain('/src/index.ts')
			expect(paths).not.toContain('/node_modules/lodash/index.js')
			expect(paths).not.toContain('/.git/config')
			expect(paths).not.toContain('/.env')
		})
	})
})
