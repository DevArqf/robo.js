/**
 * Acceptance criteria and scenario types for @robojs/code SDK
 *
 * These types enable verification-driven autonomy where "done" means
 * acceptance criteria satisfied and verification passes.
 */

/**
 * High-level requirements derived from user input
 */
export interface Requirements {
	/**
	 * Feature bullets describing what needs to be implemented
	 */
	featureBullets: string[]

	/**
	 * Constraints on implementation (e.g., "TypeScript only", "no new deps")
	 */
	constraints?: string[]

	/**
	 * Explicit non-goals to avoid scope creep
	 */
	nonGoals?: string[]
}

/**
 * Scenario validation kind
 */
export type ScenarioKind = 'mock' | 'test' | 'build' | 'manual'

/**
 * A scenario step for manual or automated validation
 */
export interface ScenarioStep {
	/**
	 * Description of the action to take
	 */
	action: string

	/**
	 * Input data for the action
	 */
	input?: unknown

	/**
	 * Expected output or behavior
	 */
	expected?: string
}

/**
 * Tool hints for scenario execution
 */
export interface ScenarioToolHints {
	/**
	 * Whether this scenario requires the mock server
	 */
	requiresMock?: boolean

	/**
	 * Whether this scenario requires the dev server
	 */
	requiresDevServer?: boolean

	/**
	 * Specific test file or pattern to run
	 */
	testPattern?: string
}

/**
 * A testable scenario specification
 */
export interface ScenarioSpec {
	/**
	 * Unique identifier for the scenario
	 */
	id: string

	/**
	 * Human-readable title
	 */
	title: string

	/**
	 * Detailed description of the scenario
	 */
	description: string

	/**
	 * How to validate this scenario
	 */
	kind: ScenarioKind

	/**
	 * Steps for manual or automated execution
	 */
	steps?: ScenarioStep[]

	/**
	 * Assertions to verify
	 */
	assertions?: string[]

	/**
	 * Tool hints for execution
	 */
	toolHints?: ScenarioToolHints
}

/**
 * Complete acceptance criteria for a run
 */
export interface AcceptanceCriteria {
	/**
	 * High-level requirements
	 */
	requirements: Requirements

	/**
	 * Testable scenarios
	 */
	scenarios: ScenarioSpec[]

	/**
	 * Scenario IDs that must pass for completion
	 * A run cannot complete successfully unless all mustPass scenarios pass
	 */
	mustPass: string[]
}

/**
 * Status of a single scenario
 */
export interface ScenarioStatus {
	id: string
	status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped'
	error?: string
	attempts: number
	lastAttemptAt?: string
}

/**
 * Overall acceptance status
 */
export interface AcceptanceStatus {
	/**
	 * Whether all mustPass scenarios have passed
	 */
	satisfied: boolean

	/**
	 * Status of each scenario
	 */
	scenarios: ScenarioStatus[]

	/**
	 * Number of verification iterations completed
	 */
	iterations: number

	/**
	 * Whether budget has been exceeded
	 */
	budgetExceeded: boolean

	/**
	 * Timestamp of last update
	 */
	updatedAt: string
}
