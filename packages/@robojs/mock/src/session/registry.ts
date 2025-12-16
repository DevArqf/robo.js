/**
 * Test Session Registry
 *
 * Tracks test sessions and their results for the `robo mock test` command.
 * Persists to `.robo/mock-test-sessions.json` for UI consumption.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, isAbsolute } from 'node:path'
import { mockLogger } from '../core/logger.js'

// ============================================================================
// Types
// ============================================================================

/**
 * Registry for a single test run
 */
export interface TestSessionRegistry {
	/** Unique test run ID */
	runId: string
	/** Timestamp when test run started */
	startedAt: number
	/** Timestamp when test run completed */
	completedAt?: number
	/** Overall status of the test run */
	status: 'running' | 'passed' | 'failed' | 'error'
	/** Per-file test results */
	testFiles: TestFileEntry[]
}

/**
 * Entry for a single test file
 */
export interface TestFileEntry {
	/** Test file path (relative to project root) */
	path: string
	/** Session ID associated with this test file */
	sessionId: string
	/** Status of the test file */
	status: 'running' | 'passed' | 'failed'
	/** Timestamp when test file started */
	startedAt: number
	/** Timestamp when test file completed */
	completedAt?: number
	/** Individual test results */
	tests: TestResult[]
	/** Assertions recorded before test entries were created (will be merged) */
	pendingAssertions?: AssertionResult[]
}

/**
 * Result for a single test case
 */
export interface TestResult {
	/** Test name/description */
	name: string
	/** Test status */
	status: 'passed' | 'failed' | 'skipped'
	/** Duration in milliseconds */
	duration: number
	/** Assertion results for UI display */
	assertions: AssertionResult[]
	/** Error details if test failed */
	error?: {
		message: string
		stack?: string
	}
}

/**
 * Result of a single assertion (for UI persistence)
 */
export interface AssertionResult {
	/** Human-readable description of what was asserted */
	description: string
	/** Whether the assertion passed */
	passed: boolean
	/** Expected value (serialized) */
	expected: unknown
	/** Actual value (serialized) */
	actual: unknown
	/** Human-readable diff for UI display */
	diff?: string
}

// ============================================================================
// Registry Path
// ============================================================================

const REGISTRY_FILENAME = 'mock-test-sessions.json'

/**
 * Get the path to the registry file
 */
export function getRegistryPath(projectRoot?: string): string {
	const root = projectRoot ?? process.cwd()
	return join(root, '.robo', REGISTRY_FILENAME)
}

// ============================================================================
// Registry Operations
// ============================================================================

/**
 * Create a new test registry for a test run
 */
export function createRegistry(runId: string): TestSessionRegistry {
	const registry: TestSessionRegistry = {
		runId,
		startedAt: Date.now(),
		status: 'running',
		testFiles: []
	}

	// Ensure .robo directory exists
	const roboDir = join(process.cwd(), '.robo')
	if (!existsSync(roboDir)) {
		mkdirSync(roboDir, { recursive: true })
	}

	// Write initial registry
	writeRegistry(registry)
	mockLogger.debug(`Created test registry: ${runId}`)

	return registry
}

/**
 * Read the current registry from disk
 */
export function readRegistry(projectRoot?: string): TestSessionRegistry | null {
	const registryPath = getRegistryPath(projectRoot)

	if (!existsSync(registryPath)) {
		return null
	}

	try {
		const content = readFileSync(registryPath, 'utf-8')
		return JSON.parse(content) as TestSessionRegistry
	} catch (error) {
		mockLogger.warn(`Failed to read registry: ${(error as Error).message}`)
		return null
	}
}

/**
 * Write registry to disk
 */
export function writeRegistry(registry: TestSessionRegistry, projectRoot?: string): void {
	const registryPath = getRegistryPath(projectRoot)

	try {
		writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf-8')
	} catch (error) {
		mockLogger.error(`Failed to write registry: ${(error as Error).message}`)
	}
}

/**
 * Update the registry with a callback
 */
export function updateRegistry(
	updater: (registry: TestSessionRegistry) => TestSessionRegistry,
	projectRoot?: string
): TestSessionRegistry | null {
	const registry = readRegistry(projectRoot)
	if (!registry) {
		mockLogger.warn('No registry found to update')
		return null
	}

	const updated = updater(registry)
	writeRegistry(updated, projectRoot)
	return updated
}

// ============================================================================
// Test File Operations
// ============================================================================

/**
 * Register a test file with its session
 */
export function registerTestFile(sessionId: string, testFilePath: string, projectRoot?: string): void {
	// Normalize path to relative (jest-reporter uses relative paths)
	const root = projectRoot ?? process.cwd()
	const normalizedPath = isAbsolute(testFilePath) ? relative(root, testFilePath) : testFilePath

	updateRegistry((registry) => {
		// Check if file already registered
		const existing = registry.testFiles.find((f) => f.path === normalizedPath)
		if (existing) {
			existing.sessionId = sessionId
			existing.status = 'running'
			existing.startedAt = Date.now()
			existing.completedAt = undefined
			existing.tests = []
		} else {
			registry.testFiles.push({
				path: normalizedPath,
				sessionId,
				status: 'running',
				startedAt: Date.now(),
				tests: []
			})
		}
		return registry
	}, projectRoot)

	mockLogger.debug(`Registered test file: ${normalizedPath} -> ${sessionId}`)
}

/**
 * Record a test result for a file
 */
export function recordTestResult(testFilePath: string, result: TestResult, projectRoot?: string): void {
	updateRegistry((registry) => {
		const file = registry.testFiles.find((f) => f.path === testFilePath)
		if (file) {
			file.tests.push(result)
		}
		return registry
	}, projectRoot)
}

/**
 * Record an assertion for a session (called during test execution)
 */
export function recordAssertion(sessionId: string, assertion: AssertionResult, projectRoot?: string): void {
	updateRegistry((registry) => {
		const file = registry.testFiles.find((f) => f.sessionId === sessionId)
		if (file) {
			if (file.tests.length > 0) {
				// Add to the most recent test
				const currentTest = file.tests[file.tests.length - 1]
				currentTest.assertions.push(assertion)
			} else {
				// No tests yet - store in pending assertions for later merging
				if (!file.pendingAssertions) {
					file.pendingAssertions = []
				}
				file.pendingAssertions.push(assertion)
			}
		}
		return registry
	}, projectRoot)
}

/**
 * Finalize a test file (called when all tests in file complete)
 */
export function finalizeTestFile(
	testFilePath: string,
	status: 'passed' | 'failed',
	projectRoot?: string
): void {
	updateRegistry((registry) => {
		const file = registry.testFiles.find((f) => f.path === testFilePath)
		if (file) {
			file.status = status
			file.completedAt = Date.now()
		}
		return registry
	}, projectRoot)

	mockLogger.debug(`Finalized test file: ${testFilePath} -> ${status}`)
}

/**
 * Finalize the entire test run
 */
export function finalizeRegistry(projectRoot?: string): void {
	updateRegistry((registry) => {
		registry.completedAt = Date.now()

		// Determine overall status
		const hasFailures = registry.testFiles.some((f) => f.status === 'failed')
		const hasRunning = registry.testFiles.some((f) => f.status === 'running')

		if (hasRunning) {
			registry.status = 'error' // Something went wrong if tests are still running
		} else if (hasFailures) {
			registry.status = 'failed'
		} else {
			registry.status = 'passed'
		}

		return registry
	}, projectRoot)

	mockLogger.info('Test run finalized')
}

// ============================================================================
// Query Operations
// ============================================================================

/**
 * Get summary statistics for a registry
 */
export function getRegistrySummary(registry: TestSessionRegistry): {
	totalTests: number
	passed: number
	failed: number
	skipped: number
	totalAssertions: number
	passedAssertions: number
	duration: number
} {
	let totalTests = 0
	let passed = 0
	let failed = 0
	let skipped = 0
	let totalAssertions = 0
	let passedAssertions = 0

	for (const file of registry.testFiles) {
		for (const test of file.tests) {
			totalTests++
			if (test.status === 'passed') passed++
			else if (test.status === 'failed') failed++
			else if (test.status === 'skipped') skipped++

			for (const assertion of test.assertions) {
				totalAssertions++
				if (assertion.passed) passedAssertions++
			}
		}
	}

	const duration = registry.completedAt ? registry.completedAt - registry.startedAt : Date.now() - registry.startedAt

	return {
		totalTests,
		passed,
		failed,
		skipped,
		totalAssertions,
		passedAssertions,
		duration
	}
}

/**
 * Get test file entry by session ID
 */
export function getTestFileBySessionId(
	registry: TestSessionRegistry,
	sessionId: string
): TestFileEntry | undefined {
	return registry.testFiles.find((f) => f.sessionId === sessionId)
}
