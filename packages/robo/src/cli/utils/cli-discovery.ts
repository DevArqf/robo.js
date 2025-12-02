/**
 * CLI Discovery Utility
 *
 * Discovers CLI commands and extensions from plugins and the current project.
 * CLI commands are located in /src/robo/cli/commands/
 * CLI extensions are located in /src/robo/cli/extend/
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { logger } from '../../core/logger.js'
import { inferNamespace } from '../../core/hooks.js'
import type { PluginData } from '../../types/common.js'
import type {
	CliCommandConfig,
	CliCommandEntry,
	CliExtendConfig,
	CliExtensionEntry,
	CliManifest
} from '../../types/cli.js'

/**
 * Check if a file or directory exists.
 */
async function pathExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath)
		return true
	} catch {
		return false
	}
}

/**
 * Get the CLI directory path for a plugin.
 * Checks both .robo/build and dist locations.
 */
async function getPluginCliDir(pluginName: string): Promise<string | null> {
	const possiblePaths = [
		// Plugin package: node_modules/@robojs/server/.robo/build/robo/cli/
		path.join(process.cwd(), 'node_modules', pluginName, '.robo', 'build', 'robo', 'cli'),
		// Alternative: node_modules/@robojs/server/dist/robo/cli/
		path.join(process.cwd(), 'node_modules', pluginName, 'dist', 'robo', 'cli')
	]

	for (const cliDir of possiblePaths) {
		if (await pathExists(cliDir)) {
			return cliDir
		}
	}

	return null
}

/**
 * Get the CLI directory path for the current project.
 */
async function getProjectCliDir(): Promise<string | null> {
	const cliDir = path.join(process.cwd(), '.robo', 'build', 'robo', 'cli')

	if (await pathExists(cliDir)) {
		return cliDir
	}

	return null
}

/**
 * Recursively discover command files from a directory.
 * Returns paths relative to the commands directory and their full paths.
 */
async function discoverCommandFiles(
	commandsDir: string,
	prefix: string = ''
): Promise<Array<{ commandPath: string; filePath: string }>> {
	const results: Array<{ commandPath: string; filePath: string }> = []
	const loggerInstance = logger()

	try {
		const entries = await fs.readdir(commandsDir, { withFileTypes: true })

		for (const entry of entries) {
			const fullPath = path.join(commandsDir, entry.name)

			if (entry.isDirectory()) {
				// Recurse into subdirectory
				const subPrefix = prefix ? `${prefix} ${entry.name}` : entry.name
				const subCommands = await discoverCommandFiles(fullPath, subPrefix)
				results.push(...subCommands)
			} else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
				// Process command file
				const baseName = path.basename(entry.name, path.extname(entry.name))

				// Skip index files at top level, but handle them specially in subdirs
				if (baseName === 'index' && !prefix) {
					continue
				}

				// Build command path: "tunnel start" from tunnel/start.ts
				let commandPath: string
				if (baseName === 'index') {
					// index.ts in a subdirectory becomes the parent command
					commandPath = prefix
				} else {
					commandPath = prefix ? `${prefix} ${baseName}` : baseName
				}

				results.push({ commandPath, filePath: fullPath })
			}
		}
	} catch (error) {
		loggerInstance.debug(`Failed to read commands directory ${commandsDir}:`, error)
	}

	return results
}

/**
 * Load a CLI command definition from a file.
 */
async function loadCommandDefinition(
	filePath: string,
	commandPath: string,
	plugin: string | null
): Promise<CliCommandEntry | null> {
	const loggerInstance = logger()

	try {
		const module = await import(pathToFileURL(filePath).href)

		// Command files must have a config export
		const config = module.config as CliCommandConfig | undefined
		if (!config) {
			loggerInstance.warn(`CLI command at ${filePath} is missing 'config' export`)
			return null
		}

		// Must have a default export (handler)
		if (typeof module.default !== 'function') {
			loggerInstance.warn(`CLI command at ${filePath} is missing default handler export`)
			return null
		}

		return {
			path: filePath,
			plugin,
			description: config.description,
			priority: config.priority ?? 0,
			options: config.options,
			positionalArgs: config.positionalArgs
		}
	} catch (error) {
		loggerInstance.error(`Failed to load CLI command from ${filePath}:`, error)
		return null
	}
}

/**
 * Discover CLI extensions from an extend/ directory.
 */
async function discoverExtensions(
	extendDir: string,
	plugin: string | null
): Promise<Record<string, CliExtensionEntry>> {
	const extensions: Record<string, CliExtensionEntry> = {}
	const loggerInstance = logger()

	try {
		if (!(await pathExists(extendDir))) {
			return extensions
		}

		const files = await fs.readdir(extendDir)

		for (const file of files) {
			if (!file.endsWith('.js') && !file.endsWith('.mjs')) {
				continue
			}

			const filePath = path.join(extendDir, file)
			const stat = await fs.stat(filePath)

			if (!stat.isFile()) {
				continue
			}

			// The target command name is the filename (dev.ts extends "dev")
			const targetCommand = path.basename(file, path.extname(file))

			try {
				const module = await import(pathToFileURL(filePath).href)
				const config = module.config as CliExtendConfig | undefined

				if (!config) {
					loggerInstance.warn(`CLI extension at ${filePath} is missing 'config' export`)
					continue
				}

				extensions[targetCommand] = {
					path: filePath,
					plugin,
					priority: config.priority ?? 0,
					options: config.options,
					hasBefore: typeof module.before === 'function',
					hasAfter: typeof module.after === 'function'
				}
			} catch (error) {
				loggerInstance.error(`Failed to load CLI extension from ${filePath}:`, error)
			}
		}
	} catch (error) {
		loggerInstance.debug(`Failed to read extend directory ${extendDir}:`, error)
	}

	return extensions
}

/**
 * Discover CLI commands and extensions from a CLI directory.
 */
async function discoverFromCliDir(
	cliDir: string,
	plugin: string | null
): Promise<{ commands: Record<string, CliCommandEntry>; extensions: Record<string, CliExtensionEntry> }> {
	const commands: Record<string, CliCommandEntry> = {}
	const extensions: Record<string, CliExtensionEntry> = {}

	// Discover commands from commands/ subdirectory
	const commandsDir = path.join(cliDir, 'commands')
	if (await pathExists(commandsDir)) {
		const commandFiles = await discoverCommandFiles(commandsDir)

		for (const { commandPath, filePath } of commandFiles) {
			const entry = await loadCommandDefinition(filePath, commandPath, plugin)
			if (entry) {
				commands[commandPath] = entry
			}
		}
	}

	// Discover extensions from extend/ subdirectory
	const extendDir = path.join(cliDir, 'extend')
	const discoveredExtensions = await discoverExtensions(extendDir, plugin)
	Object.assign(extensions, discoveredExtensions)

	return { commands, extensions }
}

/**
 * Discover all CLI commands and extensions from plugins.
 */
export async function discoverPluginCli(
	plugins: Map<string, PluginData>
): Promise<{ commands: Record<string, CliCommandEntry>; extensions: Record<string, CliExtensionEntry[]> }> {
	const commands: Record<string, CliCommandEntry> = {}
	const extensions: Record<string, CliExtensionEntry[]> = {}
	const loggerInstance = logger()

	for (const [pluginName] of plugins) {
		const cliDir = await getPluginCliDir(pluginName)

		if (!cliDir) {
			continue
		}

		loggerInstance.debug(`Discovering CLI from plugin: ${pluginName}`)

		const discovered = await discoverFromCliDir(cliDir, pluginName)

		// Merge commands (later plugins with higher priority can override)
		for (const [commandPath, entry] of Object.entries(discovered.commands)) {
			const existing = commands[commandPath]
			if (!existing || entry.priority > existing.priority) {
				commands[commandPath] = entry
			} else if (entry.priority === existing.priority) {
				loggerInstance.warn(
					`CLI command "${commandPath}" defined by both ${existing.plugin} and ${pluginName}. Using ${existing.plugin}.`
				)
			}
		}

		// Merge extensions (collect all extensions per target)
		for (const [target, extension] of Object.entries(discovered.extensions)) {
			if (!extensions[target]) {
				extensions[target] = []
			}
			extensions[target].push(extension)
		}
	}

	// Sort extensions by priority (highest first for before hooks)
	for (const target of Object.keys(extensions)) {
		extensions[target].sort((a, b) => b.priority - a.priority)
	}

	return { commands, extensions }
}

/**
 * Discover CLI commands and extensions from the current project.
 */
export async function discoverProjectCli(): Promise<{
	commands: Record<string, CliCommandEntry>
	extensions: Record<string, CliExtensionEntry[]>
}> {
	const extensions: Record<string, CliExtensionEntry[]> = {}

	const cliDir = await getProjectCliDir()

	if (!cliDir) {
		return { commands: {}, extensions }
	}

	const discovered = await discoverFromCliDir(cliDir, null)

	// Convert extensions to array format
	for (const [target, extension] of Object.entries(discovered.extensions)) {
		extensions[target] = [extension]
	}

	return { commands: discovered.commands, extensions }
}

/**
 * Discover all CLI commands and extensions from plugins and project.
 * Project commands/extensions have implicit higher priority over plugins.
 */
export async function discoverAllCli(plugins: Map<string, PluginData>): Promise<CliManifest> {
	const loggerInstance = logger()

	// Discover from plugins first
	const { commands: pluginCommands, extensions: pluginExtensions } = await discoverPluginCli(plugins)

	// Discover from project (can override plugins)
	const { commands: projectCommands, extensions: projectExtensions } = await discoverProjectCli()

	// Merge commands (project overrides plugins with implicit +100 priority)
	const commands: Record<string, CliCommandEntry> = { ...pluginCommands }
	for (const [commandPath, entry] of Object.entries(projectCommands)) {
		const existing = commands[commandPath]
		if (existing) {
			loggerInstance.warn(
				`CLI command "${commandPath}" defined in project shadows plugin command from ${existing.plugin}`
			)
		}
		// Project commands always win
		commands[commandPath] = entry
	}

	// Merge extensions (project extensions added to the list)
	const extensions: Record<string, CliExtensionEntry[]> = { ...pluginExtensions }
	for (const [target, extList] of Object.entries(projectExtensions)) {
		if (!extensions[target]) {
			extensions[target] = []
		}
		// Project extensions go first (higher implicit priority)
		extensions[target] = [...extList, ...extensions[target]]
	}

	return { commands, extensions }
}

/**
 * Runtime discovery for development mode.
 * Scans TypeScript source files directly without requiring a build.
 */
export async function discoverCliDevMode(plugins: Map<string, PluginData>): Promise<CliManifest> {
	const loggerInstance = logger()

	// In dev mode, check if source directory exists
	const sourceCliDir = path.join(process.cwd(), 'src', 'robo', 'cli')

	// For now, fall back to build directory discovery
	// Full dev mode support with TypeScript compilation will be added later
	if (await pathExists(sourceCliDir)) {
		loggerInstance.debug('CLI dev mode: source directory found, but TypeScript JIT not yet implemented')
	}

	// Use build directory discovery as fallback
	return discoverAllCli(plugins)
}
