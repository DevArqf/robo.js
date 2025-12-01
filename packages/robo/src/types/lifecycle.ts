import type { Logger } from '../core/logger.js'
import type { Env } from '../core/env.js'
import type { Config } from './config.js'
import type { ProcessedEntry, RouteEntries } from './routes.js'
import type { AggregatedMetadata, HandlerEntry, MetadataAggregator } from './manifest-v1.js'

/**
 * Context provided to init hooks.
 * Runs BEFORE manifest loading and portal population.
 * Use for early setup like log drains, monkey-patching internals.
 */
export interface InitContext {
	/** Current runtime mode (supports custom modes like 'beta', 'staging', etc.) */
	mode: string

	/** Full project configuration */
	projectConfig: Config

	/** Logger instance */
	logger: Logger

	/** Environment variable access */
	env: typeof Env
}

/**
 * Context provided to setup hooks.
 * Runs during CLI operations: create-robo or robo add.
 */
export interface SetupContext {
	trigger: 'create' | 'add'
	logger: Logger
	env: typeof Env
	paths: {
		root: string
		src: string
		config: string
	}
	exec: (command: string) => Promise<{ stdout: string; stderr: string }>
	prompt: <T>(questions: PromptQuestion[]) => Promise<T>
	package: {
		name: string
		version: string
		type: 'template' | 'plugin'
	}
}

export interface PromptQuestion {
	type: 'input' | 'password' | 'confirm' | 'list' | 'checkbox'
	name: string
	message: string
	default?: unknown
	choices?: Array<string | { name: string; value: unknown }>
	when?: boolean
}

/**
 * Plugin-scoped state storage.
 * Isolated from other plugins using namespaced keys.
 */
export interface PluginState {
	/**
	 * Get a value from plugin state.
	 */
	get<T>(key: string): T | undefined

	/**
	 * Set a value in plugin state.
	 */
	set<T>(key: string, value: T): void

	/**
	 * Check if a key exists in plugin state.
	 */
	has(key: string): boolean

	/**
	 * Delete a key from plugin state.
	 */
	delete(key: string): boolean

	/**
	 * Clear all plugin state.
	 */
	clear(): void
}

/**
 * Context provided to start hooks.
 * Runs SEQUENTIALLY: plugins in registration order → project.
 */
export interface StartContext<TConfig = unknown> {
	/**
	 * Current runtime mode (supports custom modes like 'beta', 'staging', etc.).
	 */
	mode: string

	/**
	 * Full project configuration.
	 */
	projectConfig: Config

	/**
	 * Plugin's configuration from user's /config/plugins/.
	 * Typed based on plugin's config schema.
	 */
	pluginConfig: TConfig

	/**
	 * Plugin-scoped state storage.
	 * Isolated from other plugins.
	 */
	state: PluginState

	/**
	 * Logger instance prefixed with plugin name.
	 */
	logger: Logger

	/**
	 * Environment variable access.
	 */
	env: typeof Env

	/**
	 * Portal access scoped to this plugin's routes.
	 * Reserved for future route system (Phase 3).
	 */
	portal?: unknown

	/**
	 * Plugin metadata.
	 */
	meta: {
		/** Package name */
		name: string
		/** Package version */
		version: string
	}
}

/**
 * Context provided to stop hooks.
 * Runs SEQUENTIALLY: project first → plugins in REVERSE order.
 */
export interface StopContext<TConfig = unknown> extends StartContext<TConfig> {
	/**
	 * Reason for shutdown.
	 * - 'signal': SIGTERM/SIGINT received
	 * - 'error': Uncaught exception
	 * - 'restart': HMR restart (though stop hooks typically don't run on restart)
	 */
	reason: 'signal' | 'error' | 'restart'
}

/**
 * Key-value store for passing data between build hooks.
 * Data persists across build/start and build/complete hooks
 * within the same build session.
 */
export interface BuildStore {
	/**
	 * Get a value from the store.
	 */
	get<T>(key: string): T | undefined

	/**
	 * Set a value in the store.
	 */
	set<T>(key: string, value: T): void

	/**
	 * Check if a key exists in the store.
	 */
	has(key: string): boolean

	/**
	 * Delete a key from the store.
	 */
	delete(key: string): boolean

	/**
	 * Clear all data from the store.
	 */
	clear(): void
}

/**
 * Accessor interface for route entries during build.
 * Provides methods to query and inspect processed entries.
 */
export interface EntriesAccessor {
	/**
	 * Get entries for a specific route.
	 * @param namespace - Plugin namespace (e.g., 'discordjs', 'server')
	 * @param route - Route name (e.g., 'commands', 'api')
	 */
	get(namespace: string, route: string): ProcessedEntry[]

	/**
	 * Get all entries organized by namespace and route.
	 */
	all(): RouteEntries

	/**
	 * Get handler entries (with source tracking) for a route.
	 * @param namespace - Plugin namespace
	 * @param route - Route name
	 */
	handlers(namespace: string, route: string): HandlerEntry[]
}

/**
 * Context provided to build hooks.
 * Base context shared by all build hook types.
 */
export interface BuildContext {
	/** Current build mode (supports custom modes like 'beta', 'staging', etc.) */
	mode: string

	/** Environment variable access */
	env: typeof Env

	/** Logger instance (forked for plugins) */
	logger: Logger

	/** Project paths */
	paths: {
		root: string
		src: string
		output: string
	}

	/** Loaded configuration */
	config: Config

	/**
	 * Key-value store for passing data between build hooks.
	 * Use to share computed values between build/start and build/complete.
	 */
	store: BuildStore

	/**
	 * Access to processed route entries.
	 *
	 * **Availability by hook:**
	 * - `build/start`: `undefined` - entries have not been scanned yet
	 * - `build/transform`: Available - use to inspect entries (modification via return value)
	 * - `build/complete`: Available - use to inspect final entries after transformation
	 *
	 * @example
	 * ```typescript
	 * // In build/transform or build/complete hooks:
	 * if (context.entries) {
	 *   const commands = context.entries.get('discordjs', 'commands')
	 *   console.log(`Found ${commands.length} commands`)
	 * }
	 * ```
	 */
	entries?: EntriesAccessor
}

/**
 * Context provided to build/transform.ts hooks.
 * Runs AFTER entries are processed but BEFORE manifest generation.
 * Allows filtering and transforming processed entries.
 *
 * **Hook signature:** `(entries: ProcessedEntry[], context: BuildTransformContext) => ProcessedEntry[]`
 *
 * The entries are passed as the first argument for modification.
 * The context also provides `entries` accessor for convenience (read-only inspection).
 *
 * @example
 * ```typescript
 * export default function (entries: ProcessedEntry[], context: BuildTransformContext) {
 *   // Use context.entries for read-only inspection
 *   const commands = context.entries?.get('discordjs', 'commands') ?? []
 *   context.logger.info(`Processing ${commands.length} commands`)
 *
 *   // Filter/transform and return modified entries
 *   return entries.filter(e => !e.key.startsWith('debug'))
 * }
 * ```
 */
export interface BuildTransformContext extends BuildContext {
	/** Entries accessor is always available in transform hooks */
	entries: EntriesAccessor
}

/**
 * Context provided to build/complete.ts hooks.
 * Runs AFTER manifest is written.
 *
 * **Hook signature:** `(context: BuildCompleteContext) => void | Promise<void>`
 *
 * Use this hook to perform post-build tasks like:
 * - Registering commands with Discord
 * - Generating additional files
 * - Logging build summaries
 *
 * @example
 * ```typescript
 * export default function (context: BuildCompleteContext) {
 *   const commands = context.entries.get('discordjs', 'commands')
 *   context.logger.info(`Built ${commands.length} commands`)
 * }
 * ```
 */
export interface BuildCompleteContext extends BuildContext {
	/** Entries accessor is always available in complete hooks */
	entries: EntriesAccessor

	/**
	 * Register a metadata aggregator for a namespace.
	 * Aggregators combine metadata from all handlers into a summary.
	 * @param namespace - Plugin namespace to aggregate (e.g., 'discordjs')
	 * @param aggregator - Function that processes entries into aggregated metadata
	 */
	registerMetadataAggregator<T extends AggregatedMetadata>(
		namespace: string,
		aggregator: MetadataAggregator<T>
	): void

	/**
	 * Update aggregated metadata for a namespace.
	 * Can be called multiple times; updates are merged.
	 * @param namespace - Plugin namespace
	 * @param updates - Partial metadata to merge
	 */
	updateMetadata(namespace: string, updates: Record<string, unknown>): void
}

export default {}
