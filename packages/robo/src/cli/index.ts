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

	// Build command path from parts (e.g., ['tunnel', 'start'] -> 'tunnel start')
	const commandPath = commandParts.join(' ')

	// Find the command in the manifest
	const entry = findCommand(manifest, commandPath)

	if (!entry) {
		// Show helpful error with available plugin commands
		showUnknownCommandError(commandPath, manifest)
		return true // We handled it (by showing a better error)
	}

	// Get extensions for this command
	const extensions = getExtensions(manifest, commandParts[0])

	// Execute the plugin command
	await executePluginCommand(entry, extensions, remainingArgs)
	return true
})

command.parse()
