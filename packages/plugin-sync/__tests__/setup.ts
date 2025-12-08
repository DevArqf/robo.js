/**
 * Jest setup file - runs before all tests
 * Configures global mocks and test environment
 */

import { jest } from '@jest/globals'

/**
 * ====================
 * ENVIRONMENT SETUP
 * ====================
 */

// Set NODE_ENV to test
process.env.NODE_ENV = 'test'

// Increase test timeout for async operations
jest.setTimeout(10000)

/**
 * ====================
 * CONSOLE SUPPRESSION
 * ====================
 */

// Store original console methods
const originalConsole = {
	log: console.log,
	warn: console.warn,
	error: console.error,
	debug: console.debug,
	info: console.info
}

/**
 * Restores original console methods
 * Use this in individual tests if you need to see console output
 */
export function restoreConsole(): void {
	global.console = {
		...console,
		...originalConsole
	}
}

/**
 * Suppresses console output
 * Use this to silence console during specific tests
 */
export function suppressConsole(): void {
	global.console = {
		...console,
		log: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
		info: jest.fn()
	} as unknown as Console
}

/**
 * ====================
 * GLOBAL CLEANUP
 * ====================
 */

// Clear all mocks after each test
afterEach(() => {
	jest.clearAllMocks()
})

// Restore all mocks after all tests
afterAll(() => {
	jest.restoreAllMocks()
	restoreConsole()
})

/**
 * ====================
 * UNHANDLED REJECTION HANDLING
 * ====================
 */

// Fail tests on unhandled promise rejections
process.on('unhandledRejection', (reason) => {
	console.error('Unhandled Rejection:', reason)
	throw reason
})
