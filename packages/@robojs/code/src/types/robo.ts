/**
 * Robo-aware types for @robojs/code SDK
 *
 * Types for detecting and working with Robo.js projects.
 */

/**
 * Detected Robo project kind based on structure and dependencies
 */
export type RoboProjectKind = 'bot' | 'bot+api' | 'activity' | 'unknown'

/**
 * Project profile detected from a Robo.js project.
 *
 * Detection is based on:
 * - Directories: /src/commands, /src/events, /src/api, /config/plugins, /src/robo/flashcore
 * - Dependencies: robo.js, @robojs/discordjs, @robojs/server, @robojs/mock
 */
export interface ProjectProfile {
	/**
	 * Detected project kind
	 */
	kind: RoboProjectKind

	/**
	 * Installed Robo.js plugins
	 */
	plugins: string[]

	/**
	 * Whether @robojs/mock is available for validation
	 */
	hasMock: boolean

	/**
	 * Detected directory structure
	 */
	directories: {
		commands?: string
		events?: string
		api?: string
		plugins?: string
		flashcore?: string
	}

	/**
	 * Detected robo.js version
	 */
	roboVersion?: string

	/**
	 * Whether the project has a robo.config file
	 */
	hasConfig: boolean
}

/**
 * Result from a Robo build verification
 */
export interface BuildVerificationResult {
	success: boolean
	command: string
	args: string[]
	exitCode: number
	output: string
	errors: BuildError[]
	warnings: BuildWarning[]
	durationMs: number
}

/**
 * A parsed build error
 */
export interface BuildError {
	file?: string
	line?: number
	column?: number
	message: string
	code?: string
}

/**
 * A parsed build warning
 */
export interface BuildWarning {
	file?: string
	line?: number
	column?: number
	message: string
	code?: string
}

/**
 * Result from a test run verification
 */
export interface TestVerificationResult {
	success: boolean
	command: string
	args: string[]
	exitCode: number
	output: string
	passed: number
	failed: number
	skipped: number
	durationMs: number
	failures: TestFailure[]
}

/**
 * A test failure detail
 */
export interface TestFailure {
	name: string
	file?: string
	message: string
	stack?: string
}

/**
 * Result from mock validation
 */
export interface MockVerificationResult {
	success: boolean
	sessionId: string
	scenarios: MockScenarioResult[]
	durationMs: number
}

/**
 * Result from a single mock scenario
 */
export interface MockScenarioResult {
	id: string
	title: string
	passed: boolean
	assertions: MockAssertion[]
	error?: string
}

/**
 * A mock assertion result
 */
export interface MockAssertion {
	description: string
	passed: boolean
	expected?: unknown
	actual?: unknown
}

/**
 * Combined verification result (build + tests + mock)
 */
export interface VerificationResult {
	success: boolean
	build?: BuildVerificationResult
	tests?: TestVerificationResult
	mock?: MockVerificationResult
	timestamp: string
}

/**
 * Mock event types for UI streaming
 */
export type MockEvent =
	| { type: 'session_start'; sessionId: string }
	| { type: 'session_end'; sessionId: string; success: boolean }
	| { type: 'scenario_start'; scenarioId: string; title: string }
	| { type: 'scenario_end'; scenarioId: string; passed: boolean }
	| { type: 'assertion'; scenarioId: string; description: string; passed: boolean }
	| { type: 'interaction'; scenarioId: string; action: string; input?: unknown }
	| { type: 'response'; scenarioId: string; output: unknown }
