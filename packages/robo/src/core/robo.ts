import { registerProcessEvents } from './process.js'
import { getConfig, loadConfig } from './config.js'
import { FLASHCORE_KEYS } from './constants.js'
import { logger, LogLevel } from './logger.js'
import { Env } from './env.js'
import { executeEventHandler } from './handlers.js'
import { Nanocore } from '../internal/nanocore.js'
import { Flashcore } from './flashcore.js'
import { executeInitHooks, executeStartHooks, executeStopHooks } from './hooks.js'
import { Manifest } from './manifest-api.js'
import { Mode } from './mode.js'
import { loadState } from './state.js'
import { portal, populatePortal } from './portal.js'
import { isMainThread, parentPort } from 'node:worker_threads'
import type { PluginData } from '../types/index.js'
import type { BuildCommandOptions } from '../cli/commands/build/index.js'
import type { CliContext } from '../types/cli.js'

/**
 * Robo is the main entry point for your app. It provides a simple API for starting, stopping, and restarting your Robo.
 *
 * ```ts
 * import { Robo } from 'robo.js'
 *
 * Robo.start()
 * ```
 *
 * You do not normally need to use this API directly, as the CLI will handle starting and stopping for you.
 *
 * [**Learn more:** Robo](https://robojs.dev/robojs/overview)
 */
export const Robo = { restart, start, stop, build }

// Re-export portal from portal module for convenience
export { portal }

// Be careful, plugins may contain sensitive data in their config
let plugins: Map<string, PluginData>

interface StartOptions {
	logLevel?: LogLevel
	stateLoad?: Promise<void>
}

type BuildOptions = BuildCommandOptions

/**
 * Builds your Robo instance. Similar to running `robo build` from the CLI.
 *
 * @param options - Options for building your Robo instance, similar to CLI options
 * @returns A promise that resolves when Robo has finished building
 */
export async function build(options?: BuildOptions) {
	const { buildAction } = await import('../cli/commands/build/index.js')
	await buildAction({
		args: [],
		options: {
			exit: false,
			...(options ?? {})
		}
	} as unknown as CliContext)
}

/**
 * Starts your Robo instance. Similar to running `robo start` from the CLI.
 *
 * @param options - Options for starting your Robo instance
 * @returns A promise that resolves when Robo has started
 */
async function start(options?: StartOptions) {
	const pid = process.pid
	const id = String(process.env.ROBO_INSTANCE_ID ?? pid)

	try {
		const { logLevel, stateLoad } = options ?? {}

		// Important! Register process events before doing anything else
		// This ensures the "ready" signal is sent to the parent process
		registerProcessEvents()

		// 1. Load config first (needed for plugin list and logger config)
		const config = await loadConfig()
		logger({
			drain: config?.logger?.drain,
			enabled: config?.logger?.enabled,
			level: logLevel ?? config?.logger?.level
		}).debug('Starting Robo...')

		// 2. Get mode and load environment early (needed for init hooks)
		const mode = Mode.get()
		await Env.load({ mode })

		// 3. Load plugin data early (needed for init hooks)
		// Assign to module-level variable for stop/restart lifecycle events
		plugins = loadPluginData()

		// 4. Execute init hooks BEFORE manifest loading
		// Init hooks run very early and can modify config/env before manifest processing
		await executeInitHooks(plugins, mode)

		// 5. Initialize the Manifest API (loads granular manifest files)
		await Manifest.initialize(mode)

		// 6. Initialize Flashcore and other services
		await Flashcore.$init({ keyvOptions: config.flashcore?.keyv, namespaceSeparator: config.flashcore?.namespaceSeparator })

		// Wait for states to be loaded
		if (stateLoad) {
			// Await external state promise if provided
			logger.debug('Waiting for state...')
			await stateLoad
		} else {
			// Load state directly otherwise
			const stateStart = Date.now()
			const state = await Flashcore.get<Record<string, unknown>>(FLASHCORE_KEYS.state)

			if (state) {
				loadState(state)
			}
			logger.debug(`State loaded in ${Date.now() - stateStart}ms`)
		}

		// Load the portal (commands, context, events)
		// In production mode, handlers are loaded eagerly for faster runtime access
		// In development mode, handlers are loaded lazily on first access
		await populatePortal(mode)

		// Execute start hooks (project first, then plugins sequentially)
		await executeStartHooks(plugins, mode)

		// Let external watchers know we're ready to go
		await Nanocore.set('watch', { id, pid, startedAt: Date.now(), status: 'running' })

		// Notify lifecycle event handlers
		await executeEventHandler(plugins, '_start')
	} catch (error) {
		await Nanocore.update('watch', { id, status: 'attention' })
		throw error
	}
}

/**
 * Stops your Robo instance gracefully. Similar to pressing `Ctrl+C` in the terminal.
 *
 * @param exitCode - The exit code to use when stopping Robo
 * @param reason - The reason for stopping (defaults to 'signal' if exitCode is 0, 'error' otherwise)
 */
async function stop(exitCode = 0, reason?: 'signal' | 'error' | 'restart') {
	await Nanocore.update('watch', { status: exitCode === 0 ? 'stopping' : 'error' })

	// Determine reason if not provided
	const stopReason = reason ?? (exitCode === 0 ? 'signal' : 'error')

	try {
		// Execute stop hooks (project first, then plugins in reverse order)
		await executeStopHooks(plugins, Mode.get(), stopReason)

		// Notify lifecycle handler
		await executeEventHandler(plugins, '_stop')
		logger.debug(`Stopped Robo at ` + new Date().toLocaleString())

		if (exitCode === 0) {
			await Nanocore.update('watch', { status: 'stopped' })
		}
	} finally {
		if (isMainThread) {
			process.exit(exitCode)
		} else {
			await logger.flush()
			parentPort?.postMessage({ event: 'stop', payload: 'exit' })
			parentPort?.close()
			process.exit(exitCode)
		}
	}
}

/**
 * Restarts your Robo instance gracefully. Similar to making changes with `robo dev` and restarting.
 *
 * @returns A promise that resolves when Robo has restarted
 */
async function restart() {
	try {
		// Notify lifecycle handler
		await executeEventHandler(plugins, '_restart')
		logger.debug(`Restarted Robo at ` + new Date().toLocaleString())
	} finally {
		if (isMainThread) {
			process.exit(0)
		} else {
			await Nanocore.update('watch', { status: 'restarting' })
			await logger.flush()
			parentPort?.postMessage({ event: 'stop', payload: 'exit' })
			parentPort?.close()
			process.exit()
		}
	}
}

function loadPluginData() {
	const config = getConfig()
	const collection = new Map<string, PluginData>()
	if (!config.plugins) {
		return collection
	}

	for (const plugin of config.plugins) {
		if (typeof plugin === 'string') {
			collection.set(plugin, { name: plugin })
		} else if (Array.isArray(plugin)) {
			const [name, options, metaOptions] = plugin
			collection.set(name, { name, options, metaOptions })
		}
	}

	return collection
}
