/**
 * Manual mock for robo.js module used by @robojs/sync tests.
 *
 * Provides minimal logger and color utilities needed by the sync plugin.
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

// color utilities - passthrough functions for testing
export const color = {
	bold: (s: string) => s,
	dim: (s: string) => s,
	red: (s: string) => s,
	green: (s: string) => s,
	yellow: (s: string) => s,
	blue: (s: string) => s,
	cyan: (s: string) => s,
	magenta: (s: string) => s,
	white: (s: string) => s,
	gray: (s: string) => s,
	reset: (s: string) => s
}

export default { logger, color }
