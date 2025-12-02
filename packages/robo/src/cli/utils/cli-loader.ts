/**
 * CLI Loader Utility
 *
 * Loads and executes CLI commands and extensions at runtime.
 * Handles manifest loading, command resolution, and extension hook execution.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { logger as createLogger } from '../../core/logger.js'
import { color } from '../../core/color.js'
import { loadConfig, getConfig } from '../../core/config.js'
import type { Plugin } from '../../types/index.js'
import type {
	CliAfterHook,
	CliBeforeHook,
	CliCommandEntry,
	CliContext,
	CliExtensionEntry,
	CliHandler,
	CliManifest,
	CliOptionConfig,
	LoadedCliCommand,
	LoadedCliExtension
} from '../../types/cli.js'

const logger = createLogger().fork('cli')

/**
 * CLI manifest cache.
 */
let cachedManifest: CliManifest | null = null

/**
 * Load the CLI manifest.
 * Uses mode-agnostic location (.robo/manifest/cli/@.json).
 * Falls back to runtime discovery if no manifest exists.
 */
export async function loadCliManifest(): Promise<CliManifest | null> {
	if (cachedManifest) {
		return cachedManifest
	}

	// Mode-agnostic CLI manifest path
	const manifestPath = path.join(process.cwd(), '.robo', 'manifest', 'cli', '@.json')

	try {
		const content = await fs.readFile(manifestPath, 'utf-8')
		cachedManifest = JSON.parse(content) as CliManifest
		return cachedManifest
	} catch {
		// No manifest - try runtime discovery
		cachedManifest = await discoverCliAtRuntime()
		return cachedManifest
	}
}

/**
 * Check if a path exists.
 */
async function pathExists(p: string): Promise<boolean> {
	try {
		await fs.access(p)
		return true
	} catch {
		return false
	}
}

/**
 * Extract plugin names from config.plugins array.
 */
function extractPluginNames(plugins: Plugin[]): string[] {
	return plugins.map((p) => (typeof p === 'string' ? p : p[0]))
}

/**
 * Discover CLI commands at runtime by scanning plugins and project.
 * Uses config-based plugin discovery (same as build-time) for full compatibility.
 */
async function discoverCliAtRuntime(): Promise<CliManifest | null> {
	const commands: CliManifest['commands'] = {}
	const extensions: CliManifest['extensions'] = {}

	try {
		// 1. Get plugins from config (same source as build-time)
		let config = getConfig()
		if (!config) {
			try {
				config = await loadConfig()
			} catch {
				// Config loading failed, continue without plugins
			}
		}

		const pluginNames = extractPluginNames(config?.plugins ?? [])
		logger.debug(`Runtime CLI discovery: Found ${pluginNames.length} plugins in config`)

		// 2. Scan each plugin's CLI directory
		for (const pluginName of pluginNames) {
			await discoverPluginCliRuntime(pluginName, commands, extensions)
		}

		// 3. Scan project's own CLI directory
		await discoverProjectCliRuntime(commands, extensions)

		// Return null if nothing found
		if (Object.keys(commands).length === 0 && Object.keys(extensions).length === 0) {
			return null
		}

		logger.debug(`Runtime CLI discovery: Found ${Object.keys(commands).length} commands, ${Object.keys(extensions).length} extension targets`)
		return { commands, extensions }
	} catch (error) {
		logger.debug('Runtime CLI discovery failed:', error)
		return null
	}
}

/**
 * Discover CLI commands and extensions from a plugin at runtime.
 */
async function discoverPluginCliRuntime(
	pluginName: string,
	commands: CliManifest['commands'],
	extensions: CliManifest['extensions']
): Promise<void> {
	// Check both .robo/build and dist locations
	const cliDirs = [
		path.join(process.cwd(), 'node_modules', pluginName, '.robo', 'build', 'robo', 'cli'),
		path.join(process.cwd(), 'node_modules', pluginName, 'dist', 'robo', 'cli')
	]

	for (const cliDir of cliDirs) {
		if (!(await pathExists(cliDir))) continue

		// Discover commands recursively
		const commandsDir = path.join(cliDir, 'commands')
		if (await pathExists(commandsDir)) {
			await scanCommandsRecursive(commandsDir, '', pluginName, commands)
		}

		// Discover extensions
		const extendDir = path.join(cliDir, 'extend')
		if (await pathExists(extendDir)) {
			await scanExtensionsRuntime(extendDir, pluginName, extensions)
		}

		break // Found CLI dir, no need to check other locations
	}
}

/**
 * Recursively scan commands directory to discover nested commands.
 */
async function scanCommandsRecursive(
	dir: string,
	prefix: string,
	pluginName: string | null,
	commands: CliManifest['commands']
): Promise<void> {
	let entries: Awaited<ReturnType<typeof fs.readdir>>
	try {
		entries = await fs.readdir(dir, { withFileTypes: true })
	} catch {
		return
	}

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name)

		if (entry.isDirectory()) {
			// Recurse into subdirectory with prefix
			const subPrefix = prefix ? `${prefix} ${entry.name}` : entry.name
			await scanCommandsRecursive(fullPath, subPrefix, pluginName, commands)
		} else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
			const baseName = entry.name.replace(/\.(js|mjs)$/, '')

			// Skip top-level index, use index in subdirs as parent command
			if (baseName === 'index' && !prefix) continue

			const commandPath = baseName === 'index' ? prefix : prefix ? `${prefix} ${baseName}` : baseName

			try {
				const module = await import(pathToFileURL(fullPath).href)
				const config = module.config as { description?: string; options?: CliOptionConfig[]; priority?: number; positionalArgs?: boolean } | undefined

				// Check for existing command with higher priority
				const existing = commands[commandPath]
				const priority = config?.priority ?? 0

				if (existing && existing.priority > priority) {
					// Keep existing command with higher priority
					continue
				}

				commands[commandPath] = {
					path: fullPath,
					plugin: pluginName,
					description: config?.description ?? '',
					priority,
					options: config?.options,
					positionalArgs: config?.positionalArgs
				}
			} catch {
				// Skip commands that fail to load
			}
		}
	}
}

/**
 * Scan extensions directory at runtime.
 */
async function scanExtensionsRuntime(
	dir: string,
	pluginName: string | null,
	extensions: CliManifest['extensions']
): Promise<void> {
	let files: string[]
	try {
		files = await fs.readdir(dir)
	} catch {
		return
	}

	for (const file of files) {
		if (!file.endsWith('.js') && !file.endsWith('.mjs')) continue

		const targetCommand = file.replace(/\.(js|mjs)$/, '')
		const fullPath = path.join(dir, file)

		try {
			const stat = await fs.stat(fullPath)
			if (!stat.isFile()) continue

			const module = await import(pathToFileURL(fullPath).href)
			const config = module.config as { options?: CliOptionConfig[]; priority?: number } | undefined

			if (!extensions[targetCommand]) {
				extensions[targetCommand] = []
			}

			extensions[targetCommand].push({
				path: fullPath,
				plugin: pluginName,
				priority: config?.priority ?? 0,
				options: config?.options,
				hasBefore: typeof module.before === 'function',
				hasAfter: typeof module.after === 'function'
			})
		} catch {
			// Skip extensions that fail to load
		}
	}

	// Sort extensions by priority (highest first for before hooks)
	for (const target of Object.keys(extensions)) {
		extensions[target].sort((a, b) => b.priority - a.priority)
	}
}

/**
 * Discover CLI commands and extensions from the project at runtime.
 */
async function discoverProjectCliRuntime(
	commands: CliManifest['commands'],
	extensions: CliManifest['extensions']
): Promise<void> {
	const projectCliDir = path.join(process.cwd(), '.robo', 'build', 'robo', 'cli')

	if (!(await pathExists(projectCliDir))) return

	// Discover commands
	const commandsDir = path.join(projectCliDir, 'commands')
	if (await pathExists(commandsDir)) {
		// Project commands have implicit higher priority (+100)
		// We handle this by checking after loading
		await scanCommandsRecursive(commandsDir, '', null, commands)
	}

	// Discover extensions
	const extendDir = path.join(projectCliDir, 'extend')
	if (await pathExists(extendDir)) {
		await scanExtensionsRuntime(extendDir, null, extensions)
	}
}

/**
 * Clear the manifest cache (useful for dev mode reloading).
 */
export function clearCliManifestCache(): void {
	cachedManifest = null
}

/**
 * Load a CLI command handler from a file.
 */
export async function loadCliCommand(entry: CliCommandEntry): Promise<LoadedCliCommand | null> {
	try {
		const module = await import(pathToFileURL(entry.path).href)

		if (typeof module.default !== 'function') {
			logger.error(`CLI command at ${entry.path} is missing default handler export`)
			return null
		}

		return {
			config: {
				description: entry.description,
				options: entry.options,
				positionalArgs: entry.positionalArgs,
				priority: entry.priority
			},
			plugin: entry.plugin,
			handler: module.default as CliHandler
		}
	} catch (error) {
		logger.error(`Failed to load CLI command from ${entry.path}:`, error)
		return null
	}
}

/**
 * Load a CLI extension from a file.
 */
export async function loadCliExtension(entry: CliExtensionEntry): Promise<LoadedCliExtension | null> {
	try {
		const module = await import(pathToFileURL(entry.path).href)

		return {
			config: {
				options: entry.options,
				priority: entry.priority
			},
			plugin: entry.plugin,
			before: typeof module.before === 'function' ? (module.before as CliBeforeHook) : undefined,
			after: typeof module.after === 'function' ? (module.after as CliAfterHook) : undefined
		}
	} catch (error) {
		logger.error(`Failed to load CLI extension from ${entry.path}:`, error)
		return null
	}
}

/**
 * Find a command in the manifest by path.
 * Returns the entry if found, null otherwise.
 */
export function findCommand(manifest: CliManifest, commandPath: string): CliCommandEntry | null {
	return manifest.commands[commandPath] ?? null
}

/**
 * Get extensions for a command.
 */
export function getExtensions(manifest: CliManifest, commandName: string): CliExtensionEntry[] {
	return manifest.extensions[commandName] ?? []
}

/**
 * Merge options from extensions with core command options.
 */
export function mergeOptions(
	coreOptions: CliOptionConfig[] = [],
	extensions: CliExtensionEntry[]
): CliOptionConfig[] {
	const merged = [...coreOptions]
	const seenAliases = new Set(coreOptions.map((o) => o.alias))
	const seenNames = new Set(coreOptions.map((o) => o.name))

	for (const ext of extensions) {
		if (!ext.options) continue

		for (const option of ext.options) {
			// Check for conflicts
			if (seenAliases.has(option.alias)) {
				logger.warn(
					`Option alias "${option.alias}" from ${ext.plugin ?? 'project'} conflicts with existing option. Skipping.`
				)
				continue
			}
			if (seenNames.has(option.name)) {
				logger.warn(
					`Option "${option.name}" from ${ext.plugin ?? 'project'} conflicts with existing option. Skipping.`
				)
				continue
			}

			merged.push(option)
			seenAliases.add(option.alias)
			seenNames.add(option.name)
		}
	}

	return merged
}

/**
 * Parse options from command line arguments.
 * Similar to cli-handler.ts parseOptions but uses CliOptionConfig.
 */
export function parseCliOptions(
	args: string[],
	options: CliOptionConfig[]
): { parsedOptions: Record<string, unknown>; positionalArgs: string[] } {
	const parsedOptions: Record<string, unknown> = {}
	const positionalArgs: string[] = []
	let i = 0

	// Set defaults
	for (const opt of options) {
		if (opt.default !== undefined) {
			const key = opt.name.replace(/^--/, '')
			parsedOptions[key] = opt.default
		}
	}

	while (i < args.length) {
		const arg = args[i]

		if (arg.startsWith('--')) {
			const option = options.find((opt) => opt.name === arg)
			if (option) {
				const key = arg.slice(2)
				if (option.type === 'boolean' || (i + 1 >= args.length || args[i + 1].startsWith('-'))) {
					parsedOptions[key] = true
					i++
				} else {
					const value = args[i + 1]
					parsedOptions[key] = option.type === 'number' ? Number(value) : value
					i += 2
				}
			} else {
				i++
			}
		} else if (arg.startsWith('-')) {
			const option = options.find((opt) => opt.alias === arg)
			if (option) {
				const key = option.name.slice(2)
				if (option.type === 'boolean' || (i + 1 >= args.length || args[i + 1].startsWith('-'))) {
					parsedOptions[key] = true
					i++
				} else {
					const value = args[i + 1]
					parsedOptions[key] = option.type === 'number' ? Number(value) : value
					i += 2
				}
			} else {
				i++
			}
		} else {
			positionalArgs.push(arg)
			i++
		}
	}

	return { parsedOptions, positionalArgs }
}

/**
 * Execute a plugin CLI command with extensions.
 */
export async function executePluginCommand(
	entry: CliCommandEntry,
	extensions: CliExtensionEntry[],
	args: string[]
): Promise<void> {
	// Load the command
	const command = await loadCliCommand(entry)
	if (!command) {
		logger.error('Failed to load command')
		process.exit(1)
	}

	// Load extensions
	const loadedExtensions: LoadedCliExtension[] = []
	for (const ext of extensions) {
		const loaded = await loadCliExtension(ext)
		if (loaded) {
			loadedExtensions.push(loaded)
		}
	}

	// Merge options
	const mergedOptions = mergeOptions(command.config.options, extensions)

	// Parse arguments
	const { parsedOptions, positionalArgs } = parseCliOptions(args, mergedOptions)

	// Check for help flag
	if (parsedOptions.help) {
		showCommandHelp(entry, extensions, mergedOptions)
		return
	}

	// Create context
	const context: CliContext = {
		args: positionalArgs,
		options: parsedOptions,
		logger: command.plugin ? createLogger().fork(command.plugin) : logger,
		cwd: process.cwd(),
		argv: args
	}

	// Run before hooks (highest priority first)
	for (const ext of loadedExtensions) {
		if (ext.before) {
			const result = await ext.before(context)
			if (result === false) {
				logger.debug(`Command aborted by before hook from ${ext.plugin ?? 'project'}`)
				return
			}
		}
	}

	// Run the command handler
	await command.handler(context)

	// Run after hooks (lowest priority first, so reverse order)
	for (const ext of [...loadedExtensions].reverse()) {
		if (ext.after) {
			await ext.after(context)
		}
	}
}

/**
 * Show help for a plugin command.
 */
function showCommandHelp(
	entry: CliCommandEntry,
	extensions: CliExtensionEntry[],
	mergedOptions: CliOptionConfig[]
): void {
	const commandName = Object.entries(cachedManifest?.commands ?? {}).find(
		([, e]) => e.path === entry.path
	)?.[0]

	console.log(color.blue(`\n Command: robo ${commandName}`))
	console.log(` Description: ${entry.description}`)

	if (entry.plugin) {
		console.log(` Source: ${entry.plugin}`)
	}

	if (mergedOptions.length > 0) {
		console.log(color.green(`\n Options:`))

		// Separate core and extension options
		const coreOptions = entry.options ?? []
		const coreAliases = new Set(coreOptions.map((o) => o.alias))

		for (const opt of mergedOptions) {
			const isExtension = !coreAliases.has(opt.alias)
			const source = isExtension
				? extensions.find((e) => e.options?.some((o) => o.alias === opt.alias))?.plugin ?? 'project'
				: null

			const sourceTag = source ? color.dim(` (from: ${source})`) : ''
			console.log(`   ${color.green(opt.alias)}, ${color.green(opt.name)}: ${opt.description}${sourceTag}`)
		}
	}

	if (entry.subcommands && entry.subcommands.length > 0) {
		console.log(color.red(`\n Subcommands:`))
		for (const sub of entry.subcommands) {
			console.log(`   ${sub}`)
		}
	}

	console.log('')
}

/**
 * Show error for unknown command with suggestions.
 */
export function showUnknownCommandError(commandPath: string, manifest: CliManifest | null): void {
	console.log('')
	logger.error(color.red(`The command "${commandPath}" does not exist.`))

	if (manifest && Object.keys(manifest.commands).length > 0) {
		// Find similar commands
		const allCommands = Object.keys(manifest.commands)
		const similar = allCommands.filter(
			(cmd) => cmd.includes(commandPath) || commandPath.includes(cmd.split(' ')[0])
		)

		if (similar.length > 0) {
			console.log(color.dim(`\nDid you mean one of these?`))
			for (const cmd of similar.slice(0, 3)) {
				console.log(`  robo ${cmd}`)
			}
		}

		console.log(color.dim(`\nPlugin commands available:`))
		for (const cmd of allCommands.slice(0, 5)) {
			const entry = manifest.commands[cmd]
			const source = entry.plugin ? `[${entry.plugin}]` : '[project]'
			console.log(`  robo ${cmd} ${color.dim(source)}`)
		}
		if (allCommands.length > 5) {
			console.log(color.dim(`  ... and ${allCommands.length - 5} more`))
		}
	}

	console.log('')
	logger.info(`Try ${color.bold(color.blue('robo --help'))} to see all available commands.`)
	console.log('')
}

/**
 * Check if a command path matches or is a prefix of available commands.
 */
export function matchCommand(
	manifest: CliManifest,
	inputParts: string[]
): { exact: CliCommandEntry | null; partial: string[] } {
	const inputPath = inputParts.join(' ')

	// Check for exact match
	if (manifest.commands[inputPath]) {
		return { exact: manifest.commands[inputPath], partial: [] }
	}

	// Check for partial match (command with subcommands)
	const possibleSubcommands = Object.keys(manifest.commands).filter((cmd) => cmd.startsWith(inputPath + ' '))

	return { exact: null, partial: possibleSubcommands }
}

/**
 * Run extension hooks for a core command.
 * Call this at the start of a core command handler to run before/after hooks.
 *
 * @param commandName - The name of the core command (e.g., 'dev', 'build')
 * @param args - Positional arguments
 * @param options - Parsed options
 * @param handler - The original handler function to wrap
 */
export async function runWithExtensions(
	commandName: string,
	args: string[],
	options: Record<string, unknown>,
	handler: () => Promise<void> | void
): Promise<void> {
	// Load manifest
	const manifest = await loadCliManifest()

	if (!manifest) {
		// No manifest, just run the handler
		await handler()
		return
	}

	// Get extensions for this command
	const extensions = manifest.extensions[commandName] || []

	if (extensions.length === 0) {
		// No extensions, just run the handler
		await handler()
		return
	}

	// Load extensions
	const loadedExtensions: LoadedCliExtension[] = []
	for (const ext of extensions) {
		const loaded = await loadCliExtension(ext)
		if (loaded) {
			loadedExtensions.push(loaded)
		}
	}

	// Create context
	const context: CliContext = {
		args,
		options,
		logger: createLogger().fork('cli'),
		cwd: process.cwd(),
		argv: process.argv.slice(2)
	}

	// Run before hooks (highest priority first, already sorted)
	for (const ext of loadedExtensions) {
		if (ext.before) {
			const result = await ext.before(context)
			if (result === false) {
				logger.debug(`Command "${commandName}" aborted by before hook from ${ext.plugin ?? 'project'}`)
				return
			}
		}
	}

	// Run the original handler
	await handler()

	// Run after hooks (lowest priority first, reverse order)
	for (const ext of [...loadedExtensions].reverse()) {
		if (ext.after) {
			await ext.after(context)
		}
	}
}

/**
 * Get merged options for a core command including extensions.
 * Call this to get the full list of options including plugin-provided ones.
 *
 * @param commandName - The name of the core command
 * @param coreOptions - The core command's options
 */
export async function getMergedOptionsForCommand(
	commandName: string,
	coreOptions: CliOptionConfig[] = []
): Promise<CliOptionConfig[]> {
	const manifest = await loadCliManifest()

	if (!manifest) {
		return coreOptions
	}

	const extensions = manifest.extensions[commandName] || []
	return mergeOptions(coreOptions, extensions)
}
