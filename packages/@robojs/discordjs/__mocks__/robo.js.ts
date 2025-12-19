/**
 * Manual mock for robo.js module used by @robojs/discordjs tests.
 *
 * This file is resolved via jest.config.ts moduleNameMapper ("^robo\\.js$")
 * and provides the robo.js surface that the plugin depends on.
 */

import { jest } from '@jest/globals'
import { mockFlashcore } from '../__tests__/helpers/mocks.js'

// Bridge Flashcore to the shared test mock
export const Flashcore = {
	get: <T>(key: string) => mockFlashcore.get(key) as T | undefined,
	set: <T>(key: string, value: T) => mockFlashcore.set(key, value),
	delete: (key: string) => mockFlashcore.delete(key)
}

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

// Logger class mock
export const Logger = jest.fn().mockImplementation(() => ({ ...baseLogger }))

// Mock Env with static data method
let envData: Record<string, string | undefined> = {}

export const Env = {
	data: () => envData
}

/**
 * Set environment data for tests
 */
export function setEnvData(data: Record<string, string | undefined>): void {
	envData = data
}

// color utilities (pass-through for tests)
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

export const composeColors = (..._fns: Array<(s: string) => string>) => (s: string) => s

// Mock getPluginOptions
export const getPluginOptions = jest.fn(() => null)

// State management mocks
export const getState = jest.fn(() => undefined)
export const setState = jest.fn()

// Boot (from robo.js/unstable.js - mapped via moduleNameMapper)
export const Boot = {
	getArg: jest.fn(() => undefined)
}

export default { Flashcore, logger, Env, color, getPluginOptions, Boot }
