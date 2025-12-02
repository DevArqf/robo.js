import type { LogDrain, LogLevel } from '../core/logger.js'
import type { Plugin } from './index.js'

export interface SeedHookGenerators {
	randomBase64: (bytes?: number) => string
	randomHex: (bytes?: number) => string
	randomUUID: () => string
}

export interface SeedHookHelpers {
	generators: SeedHookGenerators
	log: (...args: unknown[]) => void
}

export type SeedHookHandler = (helpers: SeedHookHelpers) => unknown | Promise<unknown>

export interface SeedEnvVariableConfig {
	/** Explanation shown to users when prompting for this variable. */
	description?: string
	/** Allow overwriting pre-existing keys when seeding. */
	overwrite?: boolean
	/** Default value assigned when writing to env files. */
	value?: string
}

export interface SeedEnvConfig {
	/** Summary displayed before prompting for environment values. */
	description?: string
	/** Map of variables to seed into detected env files. */
	variables?: Record<string, SeedEnvVariableConfig | string>
}

export interface SeedHookConfig {
	/** Short description of what seeding provides. */
	description?: string
	/** Environment variable seeding options for this plugin/project. */
	env?: SeedEnvConfig
	/** Custom seeding logic executed prior to file generation. */
	hook?: SeedHookHandler
}

export interface Config {
	excludePaths?: string[]
	experimental?: {
		buildDirectory?: string
		incrementalBuilds?: boolean
	}
	flashcore?: {
		keyv?: unknown
		/**
		 * Separator placed between namespace and key when composing Flashcore keys.
		 * Defaults to "/".
		 */
		namespaceSeparator?: string
	}
	logger?: {
		drain?: LogDrain
		enabled?: boolean
		level?: LogLevel
	}
	plugins?: Plugin[]
	portal?: {
		/** When true, disabling a module or component won't unregister commands, events, etc. */
		keepRegistered?: boolean
		/**
		 * Handler loading strategy.
		 * - 'eager': Import all handlers at startup (faster runtime, slower startup)
		 * - 'lazy': Import handlers on first access (faster startup, slower first access)
		 *
		 * Defaults to 'eager' in production, 'lazy' in development.
		 */
		loading?: 'eager' | 'lazy'
	}
	roboplay?: {
		node?: '18' | '20' | 'latest'
	}
	/** Configure seed helpers that generate starter files and environment values. */
	seed?: SeedHookConfig
	timeouts?: {
		lifecycle?: number
	}
	type?: 'plugin' | 'robo'

	/**
	 * Portal namespace for plugin routes.
	 * If omitted, inferred from package name:
	 * - @robojs/discord → 'discord'
	 * - @robojs/server → 'server'
	 * - robo-plugin-analytics → 'analytics'
	 */
	namespace?: string

	/** How often to check for updates to Robo.js in seconds. Default: 1 hour */
	updateCheckInterval?: number

	watcher?: {
		ignore?: string[]
	}
}

export default {}
