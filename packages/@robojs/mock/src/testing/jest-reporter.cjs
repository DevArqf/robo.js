/**
 * CommonJS wrapper for Jest Reporter
 *
 * Jest uses require() to load reporters, but our module is ESM.
 * This wrapper provides CommonJS compatibility with full registry update logic.
 */
'use strict';

const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join, relative } = require('node:path');

const REGISTRY_FILENAME = 'mock-test-sessions.json';

function getRegistryPath(projectRoot) {
	return join(projectRoot || process.cwd(), '.robo', REGISTRY_FILENAME);
}

function readRegistry(projectRoot) {
	const registryPath = getRegistryPath(projectRoot);
	if (!existsSync(registryPath)) {
		return null;
	}
	try {
		const content = readFileSync(registryPath, 'utf-8');
		return JSON.parse(content);
	} catch {
		return null;
	}
}

function writeRegistry(registry, projectRoot) {
	const registryPath = getRegistryPath(projectRoot);
	try {
		writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
	} catch (error) {
		console.error('[MockTestReporter] Failed to write registry:', error.message);
	}
}

function updateRegistry(updater, projectRoot) {
	const registry = readRegistry(projectRoot);
	if (!registry) {
		return null;
	}
	const updated = updater(registry);
	writeRegistry(updated, projectRoot);
	return updated;
}

class MockTestReporter {
	constructor(_globalConfig, _reporterOptions, _reporterContext) {
		this.projectRoot = process.cwd();
	}

	onRunStart() {
		if (!process.env.ROBO_MOCK_TEST_MODE) {
			return;
		}
		const registry = readRegistry(this.projectRoot);
		if (!registry) {
			console.warn('[MockTestReporter] No test registry found - results will not be persisted');
		}
	}

	onTestFileStart(test) {
		if (!process.env.ROBO_MOCK_TEST_MODE) {
			return;
		}
		const testPath = relative(this.projectRoot, test.path);
		updateRegistry((registry) => {
			const existing = registry.testFiles.find((f) => f.path === testPath);
			if (existing) {
				existing.status = 'running';
				existing.startedAt = Date.now();
			}
			return registry;
		}, this.projectRoot);
	}

	onTestFileResult(_test, testResult) {
		if (!process.env.ROBO_MOCK_TEST_MODE) {
			return;
		}

		const testPath = relative(this.projectRoot, testResult.testFilePath);

		// Convert Jest results to our format
		const results = testResult.testResults.map((result) => ({
			name: result.fullName || result.title,
			status: this._mapStatus(result.status),
			duration: result.duration ?? 0,
			assertions: [],
			error: result.failureMessages?.length
				? {
						message: result.failureMessages[0],
						stack: result.failureDetails?.[0]?.stack
					}
				: undefined
		}));

		// Update registry with test results
		updateRegistry((registry) => {
			const file = registry.testFiles.find((f) => f.path === testPath);
			if (file) {
				// Get pending assertions (recorded before test entries were created)
				const pendingAssertions = file.pendingAssertions || [];

				// Merge results - keep assertions recorded during test
				for (let i = 0; i < results.length; i++) {
					const result = results[i];
					const existingTest = file.tests.find((t) => t.name === result.name);
					if (existingTest) {
						existingTest.status = result.status;
						existingTest.duration = result.duration;
						existingTest.error = result.error;
					} else {
						// For the first test, include any pending assertions
						if (i === 0 && pendingAssertions.length > 0) {
							result.assertions = [...pendingAssertions, ...result.assertions];
						}
						file.tests.push(result);
					}
				}

				// Clear pending assertions after merging
				file.pendingAssertions = [];
			}
			return registry;
		}, this.projectRoot);

		// Finalize the file
		const status = testResult.numFailingTests > 0 ? 'failed' : 'passed';
		updateRegistry((registry) => {
			const file = registry.testFiles.find((f) => f.path === testPath);
			if (file) {
				file.status = status;
				file.completedAt = Date.now();
			}
			return registry;
		}, this.projectRoot);
	}

	onRunComplete(_testContexts, _results) {
		// Results are displayed by the mock test command, not here
	}

	_mapStatus(status) {
		switch (status) {
			case 'passed':
				return 'passed';
			case 'failed':
				return 'failed';
			case 'skipped':
			case 'pending':
			case 'todo':
			case 'disabled':
				return 'skipped';
			default:
				return 'failed';
		}
	}
}

module.exports = MockTestReporter;
