/**
 * CommonJS wrapper for Jest Reporter
 *
 * Jest uses require() to load reporters, but our module is ESM.
 * This wrapper provides CommonJS compatibility.
 */
'use strict';

// Simple synchronous reporter that works with Jest's CJS expectations
class MockTestReporter {
	constructor(_globalConfig, _reporterOptions, _reporterContext) {
		this.projectRoot = process.cwd();
	}

	onRunStart() {
		// Check if we're in test mode
		if (!process.env.ROBO_MOCK_TEST_MODE) {
			return;
		}
	}

	onTestFileStart(_test) {
		// No-op for CJS version - ESM version handles registry updates
	}

	onTestFileResult(_test, _testResult) {
		// No-op for CJS version - test helpers handle registry updates directly
	}

	onRunComplete(_testContexts, results) {
		if (!process.env.ROBO_MOCK_TEST_MODE) {
			return;
		}

		// Log summary
		const passed = results.numPassedTests;
		const failed = results.numFailedTests;
		const total = results.numTotalTests;

		console.log('');
		console.log(`[MockTestReporter] Tests: ${passed} passed, ${failed} failed, ${total} total`);
	}
}

module.exports = MockTestReporter;
