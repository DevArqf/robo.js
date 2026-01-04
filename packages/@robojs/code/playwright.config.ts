/**
 * Playwright configuration for @robojs/code SDK browser tests
 *
 * These tests run in real Chromium to test WebContainer integration.
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: './__tests__/e2e',
	testMatch: '**/*.spec.ts',
	fullyParallel: false, // WebContainer tests may conflict if parallel
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1, // Sequential execution for WebContainer stability
	reporter: 'html',

	use: {
		baseURL: 'http://localhost:3333',
		trace: 'on-first-retry'
	},

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],

	// Local dev server for the test harness
	webServer: {
		command: 'npx serve __tests__/e2e -l 3333 -s',
		url: 'http://localhost:3333',
		reuseExistingServer: !process.env.CI,
		timeout: 30000
	}
})
