/**
 * Jest Reporter for Mock Server Tests
 *
 * Custom Jest reporter that writes test results to the mock server registry.
 * This enables the UI to display test results per session.
 *
 * Usage in jest.config.ts:
 * ```typescript
 * export default {
 *   reporters: [
 *     'default',
 *     '@robojs/mock/testing/jest-reporter'
 *   ]
 * }
 * ```
 */
import { relative } from 'node:path'
import {
	updateRegistry,
	finalizeTestFile,
	readRegistry,
	type TestResult
} from '../session/registry.js'

// Inline types to avoid @jest/reporters dependency
interface JestTest {
	path: string
}

interface JestTestCaseResult {
	fullName: string
	title: string
	status: string
	duration?: number
	failureMessages?: string[]
	failureDetails?: Array<{ stack?: string }>
}

interface JestTestResult {
	testFilePath: string
	testResults: JestTestCaseResult[]
	numFailingTests: number
}

interface JestAggregatedResult {
	numPassedTests: number
	numFailedTests: number
	numTotalTests: number
}

/**
 * Mock Test Jest Reporter
 *
 * Reports test results to the mock server registry for UI display.
 */
class MockTestReporter {
	private projectRoot: string

	constructor(_globalConfig: unknown, _reporterOptions: unknown, _reporterContext: unknown) {
		this.projectRoot = process.cwd()
	}

	/**
	 * Called when Jest starts running tests
	 */
	onRunStart(): void {
		// Check if we're in test mode
		if (!process.env.ROBO_MOCK_TEST_MODE) {
			return
		}

		// Registry should already be created by `robo mock test` command
		const registry = readRegistry()
		if (!registry) {
			console.warn('[MockTestReporter] No test registry found - results will not be persisted')
		}
	}

	/**
	 * Called when a test file starts
	 */
	onTestFileStart(test: JestTest): void {
		if (!process.env.ROBO_MOCK_TEST_MODE) {
			return
		}

		const testPath = relative(this.projectRoot, test.path)

		// Mark file as running in registry
		updateRegistry((registry) => {
			const existing = registry.testFiles.find((f) => f.path === testPath)
			if (existing) {
				existing.status = 'running'
				existing.startedAt = Date.now()
			}
			// Note: The file entry should be created by createTestSession in the test
			return registry
		})
	}

	/**
	 * Called when a test file completes
	 */
	onTestFileResult(_test: JestTest, testResult: JestTestResult): void {
		if (!process.env.ROBO_MOCK_TEST_MODE) {
			return
		}

		const testPath = relative(this.projectRoot, testResult.testFilePath)

		// Convert Jest results to our format
		const results: TestResult[] = testResult.testResults.map((result) => ({
			name: result.fullName || result.title,
			status: this.mapStatus(result.status),
			duration: result.duration ?? 0,
			assertions: [], // Assertions are recorded via recordAssertion during test execution
			error: result.failureMessages?.length
				? {
						message: result.failureMessages[0],
						stack: result.failureDetails?.[0]?.stack
					}
				: undefined
		}))

		// Update registry with test results
		updateRegistry((registry) => {
			const file = registry.testFiles.find((f) => f.path === testPath)
			if (file) {
				// Get pending assertions (recorded before test entries were created)
				const pendingAssertions = file.pendingAssertions ?? []

				// Merge results - keep assertions recorded during test
				for (let i = 0; i < results.length; i++) {
					const result = results[i]
					const existingTest = file.tests.find((t) => t.name === result.name)
					if (existingTest) {
						// Keep existing assertions, update status and error
						existingTest.status = result.status
						existingTest.duration = result.duration
						existingTest.error = result.error
					} else {
						// For the first test, include any pending assertions
						if (i === 0 && pendingAssertions.length > 0) {
							result.assertions = [...pendingAssertions, ...result.assertions]
						}
						file.tests.push(result)
					}
				}

				// Clear pending assertions after merging
				file.pendingAssertions = []
			}
			return registry
		})

		// Finalize the file
		const status = testResult.numFailingTests > 0 ? 'failed' : 'passed'
		finalizeTestFile(testPath, status)
	}

	/**
	 * Called when all tests complete
	 */
	onRunComplete(_testContexts: unknown, _results: JestAggregatedResult): void {
		// Results are displayed by the mock test command, not here
	}

	/**
	 * Map Jest status to our status
	 */
	private mapStatus(status: string): 'passed' | 'failed' | 'skipped' {
		switch (status) {
			case 'passed':
				return 'passed'
			case 'failed':
				return 'failed'
			case 'skipped':
			case 'pending':
			case 'todo':
			case 'disabled':
				return 'skipped'
			default:
				return 'failed'
		}
	}
}

export default MockTestReporter
