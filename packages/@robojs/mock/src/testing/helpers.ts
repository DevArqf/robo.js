/**
 * Testing Helpers
 *
 * Helper functions for writing integration tests with the mock server.
 */
import { basename, join } from 'node:path'
import type { ExpectActionOptions, RecordedAction, WaitForActionOptions, CreateTestSessionConfig } from './types.js'
import type { AssertionResult } from '../session/registry.js'
import { getSessionActions, getMockConfig, createSession, deleteSession } from './control-api.js'
import { recordAssertion as registryRecordAssertion, registerTestFile } from '../session/registry.js'
import { getMockPluginPrefix } from '../utils/server.js'
import { readServerInfo, STANDALONE_MOCK_PORT } from '../utils/server-info.js'

/**
 * Handle for managing a log drain added to the logger.
 * Allows flushing pending writes and removing the drain.
 */
interface DrainHandle {
	id: string
	remove: () => boolean
	flush: () => Promise<void>
}

// ============================================================================
// Wait Helpers
// ============================================================================

/**
 * Wait for a specific action to be recorded
 */
export async function waitForAction(
	sessionId: string,
	options: WaitForActionOptions | string
): Promise<RecordedAction[]> {
	const opts: WaitForActionOptions =
		typeof options === 'string' ? { type: options } : options
	const timeout = opts.timeout ?? getMockConfig().defaultTimeout
	const startTime = Date.now()

	while (Date.now() - startTime < timeout) {
		const { actions } = await getSessionActions(sessionId, {
			type: opts.type,
			since: startTime
		})

		// Filter by type if specified
		let filtered = actions
		if (opts.type) {
			filtered = actions.filter((a) => a.type === opts.type)
		}

		// Apply custom filter if provided
		if (opts.filter) {
			filtered = filtered.filter(opts.filter)
		}

		if (filtered.length > 0) {
			return filtered
		}

		// Poll every 100ms
		await sleep(100)
	}

	throw new Error(
		`Timeout waiting for action "${opts.type}" after ${timeout}ms`
	)
}

/**
 * Wait for any action matching a filter
 */
export async function waitForAnyAction(
	sessionId: string,
	filter: (action: RecordedAction) => boolean,
	timeout?: number
): Promise<RecordedAction> {
	const actualTimeout = timeout ?? getMockConfig().defaultTimeout
	const startTime = Date.now()

	while (Date.now() - startTime < actualTimeout) {
		const { actions } = await getSessionActions(sessionId, {
			since: startTime
		})

		const match = actions.find(filter)
		if (match) {
			return match
		}

		await sleep(100)
	}

	throw new Error(`Timeout waiting for matching action after ${actualTimeout}ms`)
}

/**
 * Wait for a message to be sent by the bot
 */
export async function waitForMessage(
	sessionId: string,
	options?: {
		channelId?: string
		content?: string | RegExp
		timeout?: number
	}
): Promise<RecordedAction> {
	return waitForAnyAction(
		sessionId,
		(action) => {
			if (action.type !== 'message_sent') return false

			const data = action.data as { channel_id?: string; content?: string }

			if (options?.channelId && data.channel_id !== options.channelId) {
				return false
			}

			if (options?.content) {
				if (typeof options.content === 'string') {
					return data.content === options.content
				}
				return options.content.test(data.content ?? '')
			}

			return true
		},
		options?.timeout
	)
}

/**
 * Wait for an interaction response
 */
export async function waitForInteractionResponse(
	sessionId: string,
	options?: {
		type?: number
		timeout?: number
	}
): Promise<RecordedAction> {
	return waitForAnyAction(
		sessionId,
		(action) => {
			if (action.type !== 'interaction_response') return false

			if (options?.type !== undefined) {
				const data = action.data as { type?: number }
				return data.type === options.type
			}

			return true
		},
		options?.timeout
	)
}

// ============================================================================
// Historical Action Helpers
// ============================================================================

/**
 * Get all historical actions from a session (including those from before test started).
 *
 * This is useful for testing lifecycle hooks like `ready` events that fire during
 * bot startup, before your test code begins waiting for actions.
 *
 * @example
 * ```typescript
 * // Check what happened during startup
 * const actions = await getHistoricalActions(bot.sessionId, {
 *   type: 'gateway_presence_update'
 * })
 * expect(actions.length).toBeGreaterThan(0)
 * ```
 */
export async function getHistoricalActions(
	sessionId: string,
	options?: {
		/** Filter by action type */
		type?: string
		/** Custom filter function */
		filter?: (action: RecordedAction) => boolean
	}
): Promise<RecordedAction[]> {
	// Query all actions without a `since` filter
	const { actions } = await getSessionActions(sessionId, {
		type: options?.type
	})

	// Apply custom filter if provided
	if (options?.filter) {
		return actions.filter(options.filter)
	}

	return actions
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Record an assertion for UI persistence
 */
export function recordAssertion(sessionId: string, assertion: AssertionResult): void {
	registryRecordAssertion(sessionId, assertion)
}

/**
 * Deep equality check for assertion comparison
 */
export function deepEquals(actual: unknown, expected: unknown): boolean {
	// Handle Jest matchers (expect.stringContaining, etc.)
	if (expected && typeof expected === 'object' && 'asymmetricMatch' in expected) {
		return (expected as { asymmetricMatch: (v: unknown) => boolean }).asymmetricMatch(actual)
	}

	if (actual === expected) return true
	if (actual === null || expected === null) return false
	if (actual === undefined || expected === undefined) return false

	if (typeof actual !== typeof expected) return false

	if (Array.isArray(actual) && Array.isArray(expected)) {
		if (actual.length !== expected.length) return false
		return actual.every((item, index) => deepEquals(item, expected[index]))
	}

	if (typeof actual === 'object' && typeof expected === 'object') {
		const actualObj = actual as Record<string, unknown>
		const expectedObj = expected as Record<string, unknown>
		const keys = Object.keys(expectedObj)

		return keys.every((key) => deepEquals(actualObj[key], expectedObj[key]))
	}

	return false
}

/**
 * Generate a diff string for UI display
 */
export function generateDiff(expected: unknown, actual: unknown): string {
	const expectedStr = JSON.stringify(expected, null, 2)
	const actualStr = JSON.stringify(actual, null, 2)

	if (expectedStr === actualStr) {
		return 'Values are equal'
	}

	return `Expected:\n${expectedStr}\n\nActual:\n${actualStr}`
}

/**
 * Wait for an action and assert it matches expected data
 *
 * This helper:
 * 1. Waits for an action of the specified type
 * 2. Records the assertion for UI persistence
 * 3. Returns the matching action
 */
export async function expectAction(
	sessionId: string,
	options: ExpectActionOptions
): Promise<RecordedAction> {
	const { description, type, expected, timeout } = options

	try {
		// Wait for the action
		const actions = await waitForAction(sessionId, { type, timeout })
		const action = actions[0]
		const actual = action?.data

		// Check if it matches
		const passed = deepEquals(actual, expected)

		// Record assertion for UI
		recordAssertion(sessionId, {
			description,
			passed,
			expected,
			actual,
			diff: passed ? undefined : generateDiff(expected, actual)
		})

		// If not passed, throw for Jest
		if (!passed) {
			const error = new Error(
				`Assertion failed: ${description}\n${generateDiff(expected, actual)}`
			)
			error.name = 'AssertionError'
			throw error
		}

		return action
	} catch (error) {
		// Record timeout as failed assertion
		if ((error as Error).message.includes('Timeout')) {
			recordAssertion(sessionId, {
				description,
				passed: false,
				expected,
				actual: undefined,
				diff: `Timeout: No action of type "${type}" was recorded`
			})
		}
		throw error
	}
}

/**
 * Assert that no action of a type was recorded
 */
export async function expectNoAction(
	sessionId: string,
	options: {
		description: string
		type: string
		waitMs?: number
	}
): Promise<void> {
	const { description, type, waitMs = 500 } = options

	// Wait a bit to give time for action to appear
	await sleep(waitMs)

	const { actions } = await getSessionActions(sessionId, { type })
	const hasAction = actions.some((a) => a.type === type)

	recordAssertion(sessionId, {
		description,
		passed: !hasAction,
		expected: 'No action',
		actual: hasAction ? `Found ${actions.length} action(s)` : 'No action',
		diff: hasAction ? `Found unexpected ${type} action(s)` : undefined
	})

	if (hasAction) {
		throw new Error(`Assertion failed: ${description} - Found unexpected ${type} action`)
	}
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sleep for a number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Generate a Discord snowflake ID for testing
 */
export function generateSnowflake(): string {
	const timestamp = BigInt(Date.now() - 1420070400000) << 22n
	const random = BigInt(Math.floor(Math.random() * 4194303))
	return (timestamp | random).toString()
}

/**
 * Wait for the mock server to be ready
 */
export async function waitForMockServer(options?: {
	url?: string
	timeout?: number
	interval?: number
}): Promise<void> {
	const url = options?.url ?? getMockConfig().controlUrl
	const timeout = options?.timeout ?? 30000
	const interval = options?.interval ?? 500
	const startTime = Date.now()

	while (Date.now() - startTime < timeout) {
		try {
			const response = await fetch(`${url}/sessions`)
			if (response.ok) {
				return
			}
		} catch {
			// Server not ready yet
		}

		await sleep(interval)
	}

	throw new Error(`Mock server not ready after ${timeout}ms`)
}

// ============================================================================
// Bot Lifecycle Helpers
// ============================================================================

/**
 * Result of starting a mock bot
 */
export interface MockBotHandle {
	/** Session ID the bot is connected to */
	sessionId: string
	/** Session token */
	token: string
	/** Bot user info */
	botUser: { id: string; username: string }
	/** Available guilds */
	guilds: Array<{ id: string; name: string }>
	/** Available channels */
	channels: Array<{ id: string; name: string; guildId?: string; type: number }>
	/** Default guild ID */
	guildId: string
	/** The Discord.js client (from @robojs/discordjs) */
	client: unknown
	/** Stop the bot and clean up */
	stop: () => Promise<void>
}

/**
 * Options for starting a mock bot
 */
export interface StartMockBotOptions {
	/** Session name */
	name?: string
	/** Mock server port (auto-discovered if not specified) */
	port?: number
	/** Timeout for bot to connect in ms (default: 30000) */
	timeout?: number
	/** Enable verbose output (shows logs in console alongside file) */
	verbose?: boolean
	/** Test file path for registry tracking and log file naming (use __filename) */
	testFilePath?: string
	/**
	 * Enable file logging for this test.
	 * - true: Auto-name from testFilePath (e.g., "ping.test.log")
	 * - string: Custom log file path
	 * - false: Disable file logging
	 * - undefined: Auto-enable when running under `robo mock test` with testFilePath
	 */
	logFile?: boolean | string
	/**
	 * Log level for file output.
	 * @default 'debug'
	 */
	logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error'
}

/**
 * Discover the mock server port dynamically.
 *
 * Resolution order:
 * 1. Explicit port passed as parameter
 * 2. ROBO_MOCK_PORT environment variable
 * 3. Server info file (.robo/mock/server.json) - for standalone mock server
 * 4. STANDALONE_MOCK_PORT (6625) as final fallback
 */
async function discoverMockPort(explicitPort?: number): Promise<number> {
	// 1. Explicit port takes priority
	if (explicitPort !== undefined) {
		return explicitPort
	}

	// 2. Environment variable
	if (process.env.ROBO_MOCK_PORT) {
		return parseInt(process.env.ROBO_MOCK_PORT, 10)
	}

	// 3. Server info file (standalone mock server)
	const serverInfo = await readServerInfo()
	if (serverInfo) {
		return serverInfo.port
	}

	// 4. Fallback to standalone mock port
	return STANDALONE_MOCK_PORT
}


/**
 * Start a bot connected to the mock server
 *
 * Starts Robo.js directly in the test process, giving you access to the
 * Discord.js client and all bot internals.
 *
 * @example
 * ```typescript
 * let bot: MockBotHandle
 *
 * beforeAll(async () => {
 *   bot = await startMockBot({ name: 'my-test', testFilePath: __filename })
 * })
 *
 * afterAll(async () => {
 *   await bot.stop()
 * })
 *
 * it('can access the client directly', () => {
 *   const client = bot.client as Client
 *   expect(client.user?.username).toBe('MockBot')
 * })
 * ```
 */
export async function startMockBot(options: StartMockBotOptions = {}): Promise<MockBotHandle> {
	const port = await discoverMockPort(options.port)
	const timeout = options.timeout ?? 30000

	// Create a session on the mock server
	const sessionConfig: CreateTestSessionConfig = {}
	if (options.name) {
		sessionConfig.name = options.name
	}

	const session = await createSession(sessionConfig)
	const sessionId = session.id

	// Register with test registry if test file path provided
	if (options.testFilePath) {
		registerTestFile(sessionId, options.testFilePath)
	}

	// Set up environment for mock mode BEFORE importing Robo
	// Mark as connecting to existing mock server so the plugin doesn't start its own
	const prefix = getMockPluginPrefix()

	// Set NODE_ENV to production to ensure the manifest is loaded from the correct directory
	// The manifest is only built for 'development' and 'production' modes, not 'test'
	// Note: ROBO_MOCK_MODE=true forces lazy loading in portal-loader.ts to avoid Jest ESM issues
	process.env.NODE_ENV = 'production'
	process.env.ROBO_MOCK_MODE = 'true'
	process.env.ROBO_MOCK_PORT = String(port)
	process.env.ROBO_MOCK_SESSION_ID = sessionId
	process.env.DISCORD_TOKEN = session.token
	process.env.DISCORD_REST_API = `http://localhost:${port}${prefix}/api`
	process.env.__ROBO_MOCK_CONNECT_EXISTING = 'true'
	process.env.__ROBO_MOCK_SERVER_PORT = String(port)

	// Set verbose flag for robo.js to know whether to show console logs
	if (options.verbose) {
		process.env.ROBO_MOCK_VERBOSE = 'true'
	}

	// Determine if file logging should be enabled:
	// - Explicit logFile option takes priority
	// - Auto-enable when running under `robo mock test` with testFilePath provided
	const isTestMode = process.env.ROBO_MOCK_TEST_MODE === 'true'
	const shouldLogToFile = options.logFile !== false && (options.logFile || (isTestMode && !!options.testFilePath))

	// Set up file logging BEFORE Robo.start() to capture startup logs
	// We use addDrain() which persists across setup() calls (Robo.start() calls setup())
	// Note: Console output suppression is handled automatically by robo.js when
	// ROBO_MOCK_TEST_MODE=true and ROBO_MOCK_VERBOSE is not set
	let fileDrainHandle: DrainHandle | null = null

	if (shouldLogToFile && options.testFilePath) {
		const { createFileDrain, logger } = await import('robo.js')

		// Determine log file path
		let logPath: string
		if (typeof options.logFile === 'string') {
			logPath = options.logFile
		} else {
			// Auto-name: extract test file name, put in .robo/logs/tests/
			const testFileName = basename(options.testFilePath)
				.replace(/\.(test|spec)\.(ts|js|tsx|jsx|mts|mjs)$/, '.log')
			logPath = join('.robo', 'logs', 'tests', testFileName)
		}

		// Create file drain with blocking mode for immediate writes
		const fileDrain = createFileDrain({
			path: logPath,
			level: options.logLevel ?? 'debug',
			timestamp: 'iso',
			blocking: true, // Ensure logs are written before test ends
			stripAnsi: true
		})

		// Add file drain to the logger BEFORE Robo.start()
		// addDrain() adds to the _drains Map which persists across setup() calls
		const loggerInstance = logger()
		fileDrainHandle = loggerInstance.addDrain(fileDrain, `test-file-${sessionId}`)
	}

	// Import and start Robo directly
	const { Robo } = await import('robo.js')
	await Robo.start()

	// Wait for the bot to connect to the gateway
	await waitForBotConnection(sessionId, timeout)

	// Get the Discord.js client (dynamic import to avoid build-time dependency)
	let client: unknown = null
	try {
		// Use variable to avoid TypeScript checking the module
		const discordjsModule = '@robojs/discordjs'
		const discordjs = await import(/* webpackIgnore: true */ discordjsModule)
		client = discordjs.client
	} catch {
		// @robojs/discordjs not available, client will be null
	}

	return {
		sessionId,
		token: session.token,
		botUser: session.botUser,
		guilds: session.guilds,
		channels: session.channels,
		guildId: session.guildId,
		client,
		stop: async () => {
			// IMPORTANT: Destroy client FIRST to stop log generation
			if (client && typeof (client as { destroy?: () => void }).destroy === 'function') {
				try {
					;(client as { destroy: () => void }).destroy()
				} catch {
					// Client may already be destroyed
				}
			}

			// Brief delay to let any in-flight events complete processing
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Clean up drains:
			// 1. Remove the file drain from secondary drains
			// 2. Restore console drain as primary drain (in case other code runs after tests)
			// NOTE: We skip flush() because consoleDrain uses stream.write() callbacks
			// which can hang if stdout has backpressure during shutdown.
			// Since file drain uses blocking: true (synchronous writes), all logs are already on disk.
			if (fileDrainHandle) {
				fileDrainHandle.remove()
			}

			// Restore console drain for any subsequent logging
			const { consoleDrain, logger } = await import('robo.js')
			logger().setDrain(consoleDrain)

			// Delete the session to clean up server-side state
			try {
				await deleteSession(sessionId)
			} catch {
				// Session may already be deleted
			}
		}
	}
}

/**
 * Wait for the bot to connect to the gateway
 */
async function waitForBotConnection(
	sessionId: string,
	timeout: number
): Promise<void> {
	const startTime = Date.now()
	const config = getMockConfig()
	const url = `${config.controlUrl}/sessions/${sessionId}`

	while (Date.now() - startTime < timeout) {
		try {
			const response = await fetch(url)
			if (response.ok) {
				const data = (await response.json()) as { connections?: number }
				if (data.connections && data.connections > 0) {
					return
				}
			}
		} catch {
			// Server not ready yet
		}

		await sleep(500)
	}

	throw new Error(`Bot not connected after ${timeout}ms`)
}
