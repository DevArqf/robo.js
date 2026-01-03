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
	$init: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
	get: jest.fn((key: string) => mockFlashcore.get(key)),
	set: jest.fn(<T>(key: string, value: T) => mockFlashcore.set(key, value)),
	delete: jest.fn((key: string) => mockFlashcore.delete(key))
}

// Minimal logger stub that supports logger.fork('...').debug/info/warn/error
const createMockLogger = () => ({
	debug: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
	trace: jest.fn(),
	wait: jest.fn(),
	log: jest.fn(),
	event: jest.fn(),
	ready: jest.fn()
})

// Cache forked loggers so the same instance is returned for the same key
const forkedLoggers = new Map<string, ReturnType<typeof createMockLogger>>()

export const logger = {
	...createMockLogger(),
	fork: jest.fn((key: string) => {
		if (!forkedLoggers.has(key)) {
			forkedLoggers.set(key, createMockLogger())
		}
		return forkedLoggers.get(key)!
	})
}

/**
 * Get or create a forked logger mock (for tests to access the same instance as the code)
 */
export function getForkedLogger(key: string): ReturnType<typeof createMockLogger> {
	return logger.fork(key) as ReturnType<typeof createMockLogger>
}

/**
 * Clear all forked loggers (for test cleanup)
 */
export function clearForkedLoggers(): void {
	forkedLoggers.clear()
}

// Logger class mock
export const Logger = jest.fn().mockImplementation(() => createMockLogger())

// Mock Env with static data method
let envData: Record<string, string | undefined> = {}

export const Env = {
	data: jest.fn(() => envData),
	load: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
}

/**
 * Set environment data for tests
 */
export function setEnvData(data: Record<string, string | undefined>): void {
	envData = data
}

// Mock registerEnvPattern (used by build hooks)
export const registerEnvPattern = jest.fn()

// Mock env (lowercase - used by invite command)
export const env = {
	get: jest.fn((key: string) => envData[key])
}

// Mock Manifest (used by invite command)
export const Manifest = {
	metadata: jest.fn<() => unknown>().mockReturnValue(null)
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

// Portal mock for handler and route tests
const portalData: Record<string, Record<string, unknown[]>> = {}

export const portal = {
	getByType: jest.fn((type: string) => portalData[type] ?? {}),
	getRecord: jest.fn(),
	getHandler: jest.fn(),
	importRecord: jest.fn(),
	importHandler: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
	ensureRoute: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
	module: jest.fn(() => ({ isEnabled: jest.fn(() => true) })),
	registerPluginState: jest.fn()
}

/**
 * Set portal data for a specific type (for testing)
 */
export function setPortalData(type: string, data: Record<string, unknown[]>): void {
	portalData[type] = data
}

/**
 * Clear all portal data (for test cleanup)
 */
export function clearPortalData(): void {
	Object.keys(portalData).forEach((key) => delete portalData[key])
}

// Mode mock for environment detection
export const Mode = {
	isDev: jest.fn(() => true),
	isProduction: jest.fn(() => false),
	get: jest.fn(() => 'development')
}

export default { Flashcore, logger, Env, env, color, getPluginOptions, Boot, portal, Mode, registerEnvPattern, Manifest }
