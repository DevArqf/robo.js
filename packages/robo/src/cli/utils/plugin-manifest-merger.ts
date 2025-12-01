/**
 * Plugin Manifest Merger
 *
 * Reads plugin manifests and merges their entries into the route entries
 * for the granular manifest system. This enables seamless plugin integration
 * where plugin commands, events, etc. are automatically discovered.
 */

import path from 'node:path'
import { logger } from '../../core/logger.js'
import { Compiler } from './compiler.js'
import { findPackagePath } from './utils.js'
import type { Manifest } from '../../types/manifest.js'
import type { ProcessedEntry, RouteEntries } from '../../types/routes.js'
import type { PluginData } from '../../types/common.js'
import type { CommandEntry } from '../../types/commands.js'
import type { EventConfig } from '../../types/events.js'
import type { ContextEntry } from '../../types/index.js'

/**
 * Clean a plugin path by removing the leading /.robo/build/ prefix.
 * Plugin manifests store paths like "/.robo/build/events/foo.js" but
 * the portal loader already prepends the .robo/build directory.
 */
function cleanPluginPath(pluginPath: string): string {
	// Remove leading / and .robo/build/ prefix
	let cleaned = pluginPath
	if (cleaned.startsWith('/')) {
		cleaned = cleaned.slice(1)
	}
	if (cleaned.startsWith('.robo/build/')) {
		cleaned = cleaned.slice('.robo/build/'.length)
	}
	return cleaned
}

/**
 * Merge plugin manifests into route entries.
 * This reads each plugin's manifest and converts their legacy entries
 * (commands, events, context, etc.) into the new ProcessedEntry format.
 *
 * @param plugins - Map of plugin names to plugin data
 * @param routeEntries - Existing route entries to merge into
 * @param targetNamespace - The namespace to merge Discord-related entries into (default: 'discordjs')
 * @returns Updated route entries with plugin entries merged in
 */
export async function mergePluginManifests(
	plugins: Map<string, PluginData>,
	routeEntries: RouteEntries,
	targetNamespace = 'discordjs'
): Promise<RouteEntries> {
	const loggerInstance = logger()
	const mergedEntries = { ...routeEntries }

	if (plugins.size === 0) {
		return mergedEntries
	}

	loggerInstance.debug(`Merging manifests from ${plugins.size} plugin(s)...`)

	for (const [pluginName] of plugins) {
		// Skip the discordjs plugin itself - it provides routes, not entries
		if (pluginName === '@robojs/discordjs') {
			continue
		}

		// Find the plugin's package path
		const packagePath = await findPackagePath(pluginName, process.cwd())
		if (!packagePath) {
			loggerInstance.debug(`Plugin ${pluginName} is not installed. Skipping...`)
			continue
		}

		// Load the plugin's manifest
		const manifest = await Compiler.useManifest({
			basePath: packagePath,
			name: pluginName
		})

		if (!manifest) {
			loggerInstance.debug(`No manifest found for ${pluginName}. Skipping...`)
			continue
		}

		loggerInstance.debug(`Loading manifest from ${pluginName}...`)

		// First, check if plugin has new-style __routes
		if (manifest.__routes) {
			for (const [namespace, routes] of Object.entries(manifest.__routes)) {
				if (!mergedEntries[namespace]) {
					mergedEntries[namespace] = {}
				}

				for (const [routeName, entries] of Object.entries(routes)) {
					if (!mergedEntries[namespace][routeName]) {
						mergedEntries[namespace][routeName] = []
					}

					// Tag entries with plugin info and clean paths
					const taggedEntries = entries.map((entry) => ({
						...entry,
						path: entry.path ? cleanPluginPath(entry.path) : entry.path,
						module: pluginName
					}))

					mergedEntries[namespace][routeName].push(...taggedEntries)
					loggerInstance.debug(
						`Merged ${taggedEntries.length} ${routeName} entries from ${pluginName} into ${namespace}`
					)
				}
			}
		}

		// Convert legacy manifest entries to new format
		// Commands
		if (manifest.commands && Object.keys(manifest.commands).length > 0) {
			const commandEntries = convertCommandsToProcessedEntries(manifest.commands, pluginName, packagePath)

			if (!mergedEntries[targetNamespace]) {
				mergedEntries[targetNamespace] = {}
			}
			if (!mergedEntries[targetNamespace]['commands']) {
				mergedEntries[targetNamespace]['commands'] = []
			}

			mergedEntries[targetNamespace]['commands'].push(...commandEntries)
			loggerInstance.debug(`Merged ${commandEntries.length} commands from ${pluginName}`)
		}

		// Events
		if (manifest.events && Object.keys(manifest.events).length > 0) {
			const eventEntries = convertEventsToProcessedEntries(manifest.events, pluginName, packagePath)

			if (!mergedEntries[targetNamespace]) {
				mergedEntries[targetNamespace] = {}
			}
			if (!mergedEntries[targetNamespace]['events']) {
				mergedEntries[targetNamespace]['events'] = []
			}

			mergedEntries[targetNamespace]['events'].push(...eventEntries)
			loggerInstance.debug(`Merged ${eventEntries.length} events from ${pluginName}`)
		}

		// Context menus
		if (manifest.context) {
			const contextEntries = convertContextToProcessedEntries(manifest.context, pluginName, packagePath)

			if (contextEntries.length > 0) {
				if (!mergedEntries[targetNamespace]) {
					mergedEntries[targetNamespace] = {}
				}
				if (!mergedEntries[targetNamespace]['context']) {
					mergedEntries[targetNamespace]['context'] = []
				}

				mergedEntries[targetNamespace]['context'].push(...contextEntries)
				loggerInstance.debug(`Merged ${contextEntries.length} context menus from ${pluginName}`)
			}
		}

		// Middleware
		if (manifest.middleware && manifest.middleware.length > 0) {
			const middlewareEntries = convertMiddlewareToProcessedEntries(manifest.middleware, pluginName, packagePath)

			if (!mergedEntries[targetNamespace]) {
				mergedEntries[targetNamespace] = {}
			}
			if (!mergedEntries[targetNamespace]['middleware']) {
				mergedEntries[targetNamespace]['middleware'] = []
			}

			mergedEntries[targetNamespace]['middleware'].push(...middlewareEntries)
			loggerInstance.debug(`Merged ${middlewareEntries.length} middleware from ${pluginName}`)
		}

		// API routes go under 'project' namespace (they're not Discord-specific)
		if (manifest.api && Object.keys(manifest.api).length > 0) {
			const apiEntries = convertApiToProcessedEntries(manifest.api, pluginName, packagePath)

			if (!mergedEntries['project']) {
				mergedEntries['project'] = {}
			}
			if (!mergedEntries['project']['api']) {
				mergedEntries['project']['api'] = []
			}

			mergedEntries['project']['api'].push(...apiEntries)
			loggerInstance.debug(`Merged ${apiEntries.length} API routes from ${pluginName}`)
		}
	}

	return mergedEntries
}

/**
 * Convert legacy commands to ProcessedEntry format.
 */
function convertCommandsToProcessedEntries(
	commands: Record<string, CommandEntry>,
	pluginName: string,
	packagePath: string
): ProcessedEntry[] {
	const entries: ProcessedEntry[] = []

	for (const [key, command] of Object.entries(commands)) {
		// Handle nested subcommands
		if (command.subcommands) {
			for (const [subKey, subcommand] of Object.entries(command.subcommands)) {
				const fullKey = `${key} ${subKey}`

				// Handle subcommand groups (3 levels deep)
				if (subcommand.subcommands) {
					for (const [groupKey, groupCommand] of Object.entries(subcommand.subcommands)) {
						entries.push(createCommandEntry(`${fullKey} ${groupKey}`, groupCommand, pluginName, packagePath))
					}
				} else {
					entries.push(createCommandEntry(fullKey, subcommand, pluginName, packagePath))
				}
			}
		} else {
			entries.push(createCommandEntry(key, command, pluginName, packagePath))
		}
	}

	return entries
}

/**
 * Create a ProcessedEntry for a command.
 */
function createCommandEntry(
	key: string,
	command: CommandEntry,
	pluginName: string,
	packagePath: string
): ProcessedEntry {
	const { subcommands, ...metadata } = command
	const pathKey = key.replace(/ /g, '/')

	return {
		key,
		path: `commands/${pathKey}.js`,
		exports: {
			default: true,
			config: true,
			named: []
		},
		metadata: {
			...metadata,
			__plugin: {
				name: pluginName,
				path: packagePath
			}
		},
		module: pluginName
	}
}

/**
 * Convert legacy events to ProcessedEntry format.
 */
function convertEventsToProcessedEntries(
	events: Record<string, EventConfig[]>,
	pluginName: string,
	packagePath: string
): ProcessedEntry[] {
	const entries: ProcessedEntry[] = []

	for (const [eventName, handlers] of Object.entries(events)) {
		for (let i = 0; i < handlers.length; i++) {
			const handler = handlers[i]
			const key = handlers.length > 1 ? `${eventName}-${i}` : eventName

			entries.push({
				key: eventName,
				path: handler.__path ? cleanPluginPath(handler.__path) : `events/${eventName}.js`,
				exports: {
					default: true,
					config: !!handler.frequency,
					named: []
				},
				metadata: {
					frequency: handler.frequency || 'always',
					__plugin: {
						name: pluginName,
						path: packagePath
					}
				},
				module: pluginName
			})
		}
	}

	return entries
}

/**
 * Convert legacy context menus to ProcessedEntry format.
 */
function convertContextToProcessedEntries(
	context: { message?: Record<string, ContextEntry>; user?: Record<string, ContextEntry> },
	pluginName: string,
	packagePath: string
): ProcessedEntry[] {
	const entries: ProcessedEntry[] = []

	// Message context menus
	if (context.message) {
		for (const [key, entry] of Object.entries(context.message)) {
			entries.push({
				key,
				path: `context/message/${key}.js`,
				exports: {
					default: true,
					config: true,
					named: []
				},
				metadata: {
					...entry,
					contextType: 3, // MESSAGE
					__plugin: {
						name: pluginName,
						path: packagePath
					}
				},
				module: pluginName
			})
		}
	}

	// User context menus
	if (context.user) {
		for (const [key, entry] of Object.entries(context.user)) {
			entries.push({
				key,
				path: `context/user/${key}.js`,
				exports: {
					default: true,
					config: true,
					named: []
				},
				metadata: {
					...entry,
					contextType: 2, // USER
					__plugin: {
						name: pluginName,
						path: packagePath
					}
				},
				module: pluginName
			})
		}
	}

	return entries
}

/**
 * Convert legacy middleware to ProcessedEntry format.
 */
function convertMiddlewareToProcessedEntries(
	middleware: Array<{ __path?: string; priority?: number; [key: string]: unknown }>,
	pluginName: string,
	packagePath: string
): ProcessedEntry[] {
	return middleware.map((mw, index) => ({
		key: `${pluginName}-middleware-${index}`,
		path: mw.__path ? cleanPluginPath(mw.__path) : `middleware/${index}.js`,
		exports: {
			default: true,
			config: !!mw.priority,
			named: []
		},
		metadata: {
			priority: mw.priority || 0,
			__plugin: {
				name: pluginName,
				path: packagePath
			}
		},
		module: pluginName
	}))
}

/**
 * Convert legacy API routes to ProcessedEntry format.
 */
function convertApiToProcessedEntries(
	api: Record<string, { __path?: string; [key: string]: unknown }>,
	pluginName: string,
	packagePath: string
): ProcessedEntry[] {
	const entries: ProcessedEntry[] = []

	for (const [key, entry] of Object.entries(api)) {
		entries.push({
			key,
			path: entry.__path ? cleanPluginPath(entry.__path) : `api/${key}.js`,
			exports: {
				default: false,
				config: false,
				named: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] // Assume all methods available
			},
			metadata: {
				...entry,
				__plugin: {
					name: pluginName,
					path: packagePath
				}
			},
			module: pluginName
		})
	}

	return entries
}
