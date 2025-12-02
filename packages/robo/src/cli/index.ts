#!/usr/bin/env node
process.removeAllListeners('warning') // <-- Supresses Fetch API experimental warning
import { Command } from './utils/cli-handler.js'
import { packageJson } from './utils/utils.js'
import {
	executePluginCommand,
	findCommand,
	getExtensions,
	loadCliManifest,
	showUnknownCommandError
} from './utils/cli-loader.js'
import add from './commands/add.js'
import build from './commands/build/index.js'
import cloud from './commands/cloud/index.js'
import dev from './commands/dev.js'
import deploy from './commands/deploy.js'
import login from './commands/login.js'
import logout from './commands/logout.js'
import remove from './commands/remove.js'
import start from './commands/start.js'
import sync from './commands/sync.js'
import upgrade from './commands/upgrade.js'
import help, { helpCommandHandler } from './commands/help.js'
import cli from './commands/cli.js'

const command = new Command('robo')
export default command

command.description('Power up Discord with effortless activities, bots, web servers, and more! ⚡')
command.version(packageJson.version)
command.option('-h', '--help', 'Shows this help menu')
command.addCommand(build)
command.addCommand(start)
command.addCommand(dev)
command.addCommand(add)
command.addCommand(remove)
command.addCommand(sync)
command.addCommand(upgrade)
command.addCommand(deploy)
command.addCommand(cloud)
command.addCommand(login)
command.addCommand(logout)
command.addCommand(help)
command.addCommand(cli)
command.handler(helpCommandHandler)

// Handle unknown commands by checking for plugin-provided CLI commands
command.onUnknownCommand(async (commandParts, remainingArgs) => {
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
