#!/usr/bin/env node
/**
 * Robo.js CLI Entry Point
 *
 * When run via bootstrap.ts, performance timing is captured before imports.
 * The bootstrap stores timing in globalThis which perf-metrics reads.
 *
 * Commands are lazy-loaded using the command registry to minimize startup time.
 * Only the command that is actually executed will have its module loaded.
 */

process.removeAllListeners('warning') // <-- Supresses Fetch API experimental warning

// Performance metrics - reads pre-captured timing from globalThis (set by bootstrap.ts)
import { PERF_ENABLED, recordProcessStart, recordImportsComplete, setCommandName, finalize } from './utils/perf-metrics.js'
recordProcessStart()

// Minimal imports - only routing infrastructure (no command implementations)
import { Command } from './utils/cli-handler.js'
import { packageJson } from './utils/utils.js'
import { COMMANDS, createLazyCommand } from './utils/command-registry.js'

// cli-loader is lazy-loaded inside onUnknownCommand to avoid heavy startup cost

// Help stays eager (tiny module, needs root command reference for introspection)
import help, { helpCommandHandler } from './commands/help.js'

// Record import phase completion - now much faster without loading all commands!
recordImportsComplete()

// Detect command name from argv for perf reporting
if (PERF_ENABLED) {
	const cmdArg = process.argv[2]
	if (cmdArg && !cmdArg.startsWith('-')) {
		setCommandName(cmdArg)
	}

	// Finalize perf metrics on exit
	process.on('beforeExit', async () => {
		await finalize()
	})
}

const command = new Command('robo')
export default command

command.description('Build powerful apps with plugins, web servers, and more! ⚡')
command.version(packageJson.version)
command.option('-h', '--help', 'Shows this help menu')

// Register all commands lazily from metadata (no module imports)
for (const meta of COMMANDS) {
	command.addCommand(createLazyCommand(meta))
}

// Help is eager (already imported, needs root command reference)
command.addCommand(help)
command.handler(helpCommandHandler)

// Handle unknown commands by checking for plugin-provided CLI commands
command.onUnknownCommand(async (commandParts, remainingArgs) => {
	// Lazy-load cli-loader to avoid heavy startup cost (~190ms)
	const { loadCliManifest, findCommand, getExtensions, executePluginCommand, showUnknownCommandError } =
		await import('./utils/cli-loader.js')

	// Try to load the CLI manifest (with runtime discovery fallback)
	const manifest = await loadCliManifest()

	if (!manifest) {
		return false
	}

	// Combine commandParts and remainingArgs to try longer paths first
	// e.g., ['tunnel'] + ['start', '--port', '3000'] should try 'tunnel start' first
	const allParts = [...commandParts]
	const allRemaining = [...remainingArgs]

	// Extract potential subcommand names from remaining args (until we hit an option)
	while (allRemaining.length > 0 && !allRemaining[0].startsWith('-')) {
		allParts.push(allRemaining.shift()!)
	}

	// Try to find the longest matching command path
	let entry = null
	let commandPath = ''
	let argsForCommand: string[] = []

	// Try from longest to shortest path
	for (let i = allParts.length; i > 0; i--) {
		const tryPath = allParts.slice(0, i).join(' ')
		const tryEntry = findCommand(manifest, tryPath)

		if (tryEntry) {
			entry = tryEntry
			commandPath = tryPath
			// Remaining args = unused parts + options
			argsForCommand = [...allParts.slice(i), ...allRemaining]
			break
		}
	}

	if (!entry) {
		// Show helpful error with the full attempted path
		const attemptedPath = allParts.join(' ')
		await showUnknownCommandError(attemptedPath, manifest)
		return true // We handled it (by showing a better error)
	}

	// Get extensions for this command (supports nested command paths)
	const extensions = getExtensions(manifest, commandPath)

	// Execute the plugin command
	await executePluginCommand(entry, extensions, argsForCommand)
	return true
})

command.parse()
