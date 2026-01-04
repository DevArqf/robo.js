/**
 * Verification module for @robojs/code SDK
 *
 * Provides utilities for running verification workflows:
 * - Test runner detection and selection
 * - Scenario mapping to verification actions
 * - Mock server session management
 */

// Runner selection
export {
	type TestRunnerConfig,
	type PackageJsonInfo,
	detectTestRunnerFromPackage,
	detectTestRunnerFromConfig,
	buildRunnerConfig,
	detectTestRunner
} from './runner-selection.js'

// Scenario mapping
export {
	type VerificationActionType,
	type BaseVerificationAction,
	type BuildVerificationAction,
	type TestVerificationAction,
	type MockVerificationAction,
	type ManualVerificationAction,
	type VerificationAction,
	type ScenarioMappingContext,
	mapScenarioToAction,
	mapScenariosToActions,
	groupActionsByType,
	requiresMockServer,
	requiresDevServer,
	hasManualScenarios
} from './scenario-mapper.js'

// Mock runner
export {
	type MockSession,
	type MockSessionConfig,
	type MockRunnerOptions,
	type DispatchCommand,
	type DispatchResult,
	MockRunner
} from './mock-runner.js'
