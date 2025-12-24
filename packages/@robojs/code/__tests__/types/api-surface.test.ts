/**
 * Type verification tests for @robojs/code SDK
 *
 * These tests verify that the public API surface compiles correctly
 * and that types are properly defined.
 */

import type {
	ExecutionProvider,
	AgentPolicy,
	AgentEvent,
	BrandedModelAlias,
	RunMode,
	StreamOptions,
	FileChange,
	FileDiff,
	ProjectProfile,
	AcceptanceCriteria,
	ProjectIndex,
	ProjectOverview,
	RunMeta,
	TerminalChunk,
	RunResult,
	LLMProvider,
	Checkpointer,
	RunStore
} from '../../src/index.js'

import { CodeAgentError, DEFAULT_POLICY, DEFAULT_STREAM_OPTIONS } from '../../src/index.js'

describe('Public API Surface', () => {
	describe('ExecutionProvider', () => {
		it('should define all required methods', () => {
			// Type-level test: this compiles if interface is correct
			const mockProvider: ExecutionProvider = {
				readFile: async () => '',
				writeFile: async () => {},
				deletePath: async () => {},
				exists: async () => false,
				readdir: async () => [],
				mkdir: async () => {},
				search: async () => [],
				snapshot: async () => ({}),
				stat: async () => ({ size: 0 }),
				run: async () => ({ exitCode: 0, output: '' }),
				runStream: async function* () {},
				startSession: async () => ({ id: 'test', pid: 1234 }),
				stopSession: async () => {},
				streamSession: async function* () {}
			}
			expect(mockProvider).toBeDefined()
			expect(typeof mockProvider.readFile).toBe('function')
			expect(typeof mockProvider.writeFile).toBe('function')
			expect(typeof mockProvider.run).toBe('function')
			expect(typeof mockProvider.startSession).toBe('function')
		})
	})

	describe('AgentPolicy', () => {
		it('should require autoApprove and maxIterations', () => {
			const validPolicy: AgentPolicy = {
				autoApprove: false,
				maxIterations: 10,
				commandAllowlist: ['npm', 'node']
			}
			expect(validPolicy.autoApprove).toBe(false)
			expect(validPolicy.maxIterations).toBe(10)
			expect(validPolicy.commandAllowlist).toContain('npm')
		})

		it('should allow optional fields', () => {
			const fullPolicy: AgentPolicy = {
				autoApprove: true,
				maxIterations: 20,
				commandAllowlist: ['npm', 'pnpm', 'yarn', 'robo', 'node'],
				commandArgPolicy: {
					disallow: [{ command: 'node', argsPrefix: ['-e'] }],
					requireApproval: [{ command: 'npx' }]
				},
				networkPolicy: {
					default: 'deny',
					allowForCommands: { npm: true }
				},
				denyPaths: ['.env', '.git'],
				maxFileWriteBytes: 512000,
				maxTotalDiffBytes: 2000000,
				maxSnapshotBytes: 2000000,
				maxBufferedTerminalBytes: 5000000,
				requireMockValidationWhenAvailable: true,
				context: {
					enableCompaction: true,
					maxMessagesBeforeCompaction: 50,
					keepLastMessages: 10,
					maxSummaryChars: 2000
				}
			}
			expect(fullPolicy.commandArgPolicy?.disallow).toHaveLength(1)
			expect(fullPolicy.context?.enableCompaction).toBe(true)
		})

		it('should export DEFAULT_POLICY', () => {
			expect(DEFAULT_POLICY).toBeDefined()
			expect(DEFAULT_POLICY.commandAllowlist).toBeDefined()
		})
	})

	describe('BrandedModelAlias', () => {
		it('should accept valid aliases in capability order', () => {
			// Aliases in ascending capability order (Sage < Great Sage < Raphael < Words of the World)
			const aliases: BrandedModelAlias[] = ['Sage', 'Great Sage', 'Raphael', 'Words of the World']
			expect(aliases).toHaveLength(4)
			expect(aliases[0]).toBe('Sage') // Entry-level
			expect(aliases[3]).toBe('Words of the World') // Highest tier
		})
	})

	describe('RunMode', () => {
		it('should define all modes', () => {
			const modes: RunMode[] = ['explain', 'plan', 'execute']
			expect(modes).toContain('explain')
			expect(modes).toContain('plan')
			expect(modes).toContain('execute')
		})
	})

	describe('StreamOptions', () => {
		it('should allow partial options', () => {
			const opts: StreamOptions = { includeText: true }
			expect(opts.includeText).toBe(true)
			expect(opts.includePlan).toBeUndefined()
		})

		it('should export DEFAULT_STREAM_OPTIONS', () => {
			expect(DEFAULT_STREAM_OPTIONS).toBeDefined()
			expect(DEFAULT_STREAM_OPTIONS.includeText).toBe(true)
		})
	})

	describe('FileChange', () => {
		it('should support create, modify, and delete operations', () => {
			const createChange: FileChange = { path: '/src/new.ts', type: 'create', content: 'export {}' }
			const modifyChange: FileChange = { path: '/src/existing.ts', type: 'modify', content: 'export const x = 1' }
			const deleteChange: FileChange = { path: '/src/old.ts', type: 'delete' }

			expect(createChange.type).toBe('create')
			expect(modifyChange.type).toBe('modify')
			expect(deleteChange.type).toBe('delete')
		})
	})

	describe('FileDiff', () => {
		it('should include path, type, and optional fields', () => {
			const diff: FileDiff = {
				path: '/src/test.ts',
				type: 'modify',
				unifiedDiff: '@@ -1,3 +1,4 @@\n+// comment\n export {}',
				oldSize: 100,
				newSize: 120,
				additions: 1,
				deletions: 0
			}
			expect(diff.path).toBe('/src/test.ts')
			expect(diff.unifiedDiff).toBeDefined()
		})
	})

	describe('ProjectProfile', () => {
		it('should define Robo project detection structure', () => {
			const profile: ProjectProfile = {
				kind: 'bot',
				plugins: ['@robojs/server', '@robojs/mock'],
				hasMock: true,
				directories: {
					commands: '/src/commands',
					events: '/src/events'
				},
				hasConfig: true
			}
			expect(profile.kind).toBe('bot')
			expect(profile.hasMock).toBe(true)
		})
	})

	describe('AcceptanceCriteria', () => {
		it('should define requirements, scenarios, and mustPass', () => {
			const criteria: AcceptanceCriteria = {
				requirements: {
					featureBullets: ['Add /ping command', 'Return "Pong!"'],
					constraints: ['TypeScript only']
				},
				scenarios: [
					{
						id: 'ping-works',
						title: 'Ping command responds',
						description: 'When user runs /ping, bot responds with Pong!',
						kind: 'mock',
						assertions: ['Response contains "Pong!"']
					}
				],
				mustPass: ['ping-works']
			}
			expect(criteria.scenarios).toHaveLength(1)
			expect(criteria.mustPass).toContain('ping-works')
		})
	})

	describe('ProjectIndex', () => {
		it('should define lightweight index structure', () => {
			const index: ProjectIndex = {
				updatedAt: new Date().toISOString(),
				root: '/project',
				fingerprint: 'abc123',
				files: [{ path: 'src/index.ts', size: 100 }],
				dirs: [{ path: 'src' }],
				robo: {
					kind: 'bot',
					plugins: [],
					hasMock: false
				}
			}
			expect(index.fingerprint).toBeDefined()
			expect(index.files).toHaveLength(1)
		})
	})

	describe('ProjectOverview', () => {
		it('should define structured mental model', () => {
			const overview: ProjectOverview = {
				updatedAt: new Date().toISOString(),
				root: '/project',
				summary: 'A Discord bot project',
				package: {
					name: 'my-bot',
					scripts: { build: 'robo build', dev: 'robo dev' }
				},
				keyFiles: [{ path: 'src/commands/ping.ts', why: 'Main command' }],
				constraints: ['TypeScript only'],
				decisions: [{ when: new Date().toISOString(), topic: 'Framework', decision: 'Use Robo.js' }],
				changeLog: []
			}
			expect(overview.decisions).toHaveLength(1)
		})
	})

	describe('RunMeta', () => {
		it('should define run metadata structure', () => {
			const meta: RunMeta = {
				runId: 'run-123',
				threadId: 'run-123', // Same as runId per spec
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				status: 'running',
				instruction: 'Add a /hello command',
				mode: 'execute',
				modelAlias: 'Sage'
			}
			expect(meta.runId).toBe(meta.threadId) // 1:1 mapping
			expect(meta.status).toBe('running')
		})
	})

	describe('TerminalChunk', () => {
		it('should define output and exit chunk types', () => {
			const outputChunk: TerminalChunk = {
				type: 'output',
				stream: 'combined',
				text: 'Build completed'
			}
			const exitChunk: TerminalChunk = {
				type: 'exit',
				exitCode: 0
			}
			expect(outputChunk.type).toBe('output')
			expect(exitChunk.exitCode).toBe(0)
		})
	})

	describe('RunResult', () => {
		it('should define command execution result', () => {
			const result: RunResult = {
				exitCode: 0,
				output: 'Success\n',
				stdout: 'Success\n',
				stderr: ''
			}
			expect(result.exitCode).toBe(0)
			expect(result.output).toBeDefined()
		})
	})

	describe('LLMProvider', () => {
		it('should define chat and stream methods', () => {
			const mockProvider: LLMProvider = {
				chat: async () => ({
					id: 'resp-1',
					content: 'Hello',
					finishReason: 'stop'
				}),
				stream: async function* () {
					yield { type: 'text', text: 'Hello' }
					yield { type: 'done', finishReason: 'stop' }
				}
			}
			expect(typeof mockProvider.chat).toBe('function')
			expect(typeof mockProvider.stream).toBe('function')
		})
	})

	describe('Checkpointer', () => {
		it('should define save, load, delete methods', () => {
			const mockCheckpointer: Checkpointer = {
				save: async () => {},
				load: async () => null,
				delete: async () => {}
			}
			expect(typeof mockCheckpointer.save).toBe('function')
			expect(typeof mockCheckpointer.load).toBe('function')
			expect(typeof mockCheckpointer.delete).toBe('function')
		})
	})

	describe('RunStore', () => {
		it('should define list, get, save, delete methods', () => {
			const mockStore: RunStore = {
				listRuns: async () => [],
				getRun: async () => null,
				saveRun: async () => {},
				deleteRun: async () => {}
			}
			expect(typeof mockStore.listRuns).toBe('function')
			expect(typeof mockStore.getRun).toBe('function')
		})
	})

	describe('AgentEvent', () => {
		it('should define all event types', () => {
			const events: AgentEvent[] = [
				{ type: 'start', runId: 'run-1', instruction: 'Test' },
				{ type: 'phase', phase: 'planning' },
				{ type: 'llm_text', delta: 'Hello' },
				{ type: 'tool_call', source: 'core', name: 'fs_read', args: { path: '/test' } },
				{ type: 'tool_result', source: 'core', name: 'fs_read', result: 'content' },
				{ type: 'mcp_call', source: 'mcp', serverId: 'robo', tool: 'analyze', args: {} },
				{ type: 'mcp_result', source: 'mcp', serverId: 'robo', tool: 'analyze', result: {} },
				{ type: 'question', runId: 'run-1', text: 'Which option?', choices: [{ id: 'a', label: 'Option A' }] },
				{ type: 'complete', summary: 'Done', changes: [] }
			]
			expect(events.length).toBeGreaterThan(0)
			expect(events.find((e) => e.type === 'question')).toBeDefined()
		})
	})

	describe('CodeAgentError', () => {
		it('should create errors with code and message', () => {
			const error = new CodeAgentError('POLICY_VIOLATION', 'Path not allowed', {
				recoverable: false,
				details: { path: '.env' }
			})
			expect(error.code).toBe('POLICY_VIOLATION')
			expect(error.message).toBe('Path not allowed')
			expect(error.recoverable).toBe(false)
			expect(error.details).toEqual({ path: '.env' })
		})

		it('should check if error is CodeAgentError', () => {
			const error = new CodeAgentError('ABORT', 'Cancelled')
			expect(CodeAgentError.isCodeAgentError(error)).toBe(true)
			expect(CodeAgentError.isCodeAgentError(new Error('regular'))).toBe(false)
		})

		it('should wrap unknown errors', () => {
			const wrapped = CodeAgentError.wrap(new Error('Original'))
			expect(wrapped.code).toBe('EXECUTION_FAILED')
			expect(wrapped.message).toBe('Original')
		})

		it('should serialize to JSON', () => {
			const error = new CodeAgentError('TIMEOUT', 'Operation timed out')
			const json = error.toJSON()
			expect(json.code).toBe('TIMEOUT')
			expect(json.name).toBe('CodeAgentError')
		})
	})
})
