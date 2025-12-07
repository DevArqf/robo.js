/**
 * Manual mock for robo.js module used by @robojs/mock tests.
 *
 * This file is resolved via jest.config.ts moduleNameMapper ("^robo\\.js$")
 * and provides a minimal mock surface for testing.
 */

import { jest } from '@jest/globals'

// Minimal logger stub that supports logger.fork('...').debug/info/warn/error
const baseLogger = {
	debug: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
	trace: jest.fn(),
	wait: jest.fn(),
	log: jest.fn(),
	event: jest.fn(),
	ready: jest.fn()
}

export const logger = {
	...baseLogger,
	fork: jest.fn(() => ({ ...baseLogger }))
}

export default { logger }
