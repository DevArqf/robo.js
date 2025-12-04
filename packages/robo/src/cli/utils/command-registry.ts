/**
 * Command Registry for Lazy Loading CLI Commands
 *
 * This module stores command metadata without importing the actual command implementations.
 * Commands are lazy-loaded only when executed, reducing CLI startup time significantly.
 */

import { Command } from './cli-handler.js'
import type { CliContext } from '../../types/cli.js'

export interface CommandOption {
	alias: string
	name: string
	description: string
}

export interface CommandMetadata {
	name: string
	description: string
	options: CommandOption[]
	positionalArgs?: boolean
	modulePath: string
	/** For commands with subcommands that need lazy loading of the whole module */
	hasSubcommands?: boolean
}

/**
 * All command metadata - defined inline to avoid importing command modules.
 * This allows the CLI to know about all commands without loading their implementations.
 */
export const COMMANDS: CommandMetadata[] = [
	{
		name: 'add',
		description: 'Adds a plugin to your Robo.',
		options: [
			{ alias: '-f', name: '--force', description: 'forcefully install & register packages' },
			{ alias: '-ns', name: '--no-seed', description: 'skip the seeding of files from the plugin' },
			{ alias: '-s', name: '--silent', description: 'do not print anything' },
			{ alias: '-t', name: '--trigger', description: 'setup hook trigger context (add or create)' },
			{ alias: '-v', name: '--verbose', description: 'print more information for debugging' },
			{ alias: '-y', name: '--yes', description: 'auto-accept seed files' }
		],
		positionalArgs: true,
		modulePath: '../commands/add.js'
	},
	{
		name: 'remove',
		description: 'Removes a plugin from your Robo',
		options: [
			{ alias: '-f', name: '--force', description: 'forcefully remove & unregister packages' },
			{ alias: '-s', name: '--silent', description: 'do not print anything' },
			{ alias: '-v', name: '--verbose', description: 'print more information for debugging' }
		],
		positionalArgs: true,
		modulePath: '../commands/remove.js'
	},
	{
		name: 'build',
		description: 'Builds your Robo for production.',
		options: [
			{ alias: '-d', name: '--dev', description: 'build for development' },
			{ alias: '-m', name: '--mode', description: 'specify the mode(s) to run in (dev, beta, prod, etc...)' },
			{ alias: '-s', name: '--silent', description: 'do not print anything' },
			{ alias: '-v', name: '--verbose', description: 'print more information for debugging' },
			{ alias: '-w', name: '--watch', description: 'watch for changes and rebuild' },
			{ alias: '-h', name: '--help', description: 'Shows the available command options' }
		],
		positionalArgs: true,
		hasSubcommands: true,
		modulePath: '../commands/build/index.js'
	},
	{
		name: 'start',
		description: 'Starts your Robo in production mode.',
		options: [
			{ alias: '-id', name: '--instance-id', description: 'specify the instance ID to use' },
			{ alias: '-l', name: '--log-level', description: 'specify the log level to use (debug, info, warn, error)' },
			{ alias: '-m', name: '--mode', description: 'specify the mode(s) to run in (dev, beta, prod, etc...)' },
			{ alias: '-h', name: '--help', description: 'Shows the available command options' },
			{ alias: '-s', name: '--silent', description: 'do not print anything' },
			{ alias: '-v', name: '--verbose', description: 'print more information for debugging' }
		],
		modulePath: '../commands/start.js'
	},
	{
		name: 'dev',
		description: 'Ready, set, code your Robo to life! Starts development mode.',
		options: [
			{ alias: '-h', name: '--help', description: 'Shows the available command options' },
			{ alias: '-id', name: '--instance-id', description: 'specify the instance ID to use' },
			{ alias: '-l', name: '--log-level', description: 'specify the log level to use (debug, info, warn, error)' },
			{ alias: '-m', name: '--mode', description: 'specify the mode(s) to run in (dev, beta, prod, etc...)' },
			{ alias: '-s', name: '--silent', description: 'do not print anything' },
			{ alias: '-v', name: '--verbose', description: 'print more information for debugging' }
		],
		modulePath: '../commands/dev.js'
	},
	{
		name: 'deploy',
		description: 'Deploys your Robo to RoboPlay!',
		options: [
			{ alias: '-s', name: '--silent', description: 'do not print anything' },
			{ alias: '-v', name: '--verbose', description: 'print more information for debugging' },
			{ alias: '-h', name: '--help', description: 'Shows the available command options' }
		],
		modulePath: '../commands/deploy.js'
	},
	{
		name: 'sync',
		description: 'Syncs the Robo with the latest plugins and configurations',
		options: [
			{ alias: '-s', name: '--silent', description: 'do not print anything' },
			{ alias: '-v', name: '--verbose', description: 'print more information for debugging' },
			{ alias: '-h', name: '--help', description: 'Shows the available command options' }
		],
		modulePath: '../commands/sync.js'
	},
	{
		name: 'upgrade',
		description: 'Upgrades your Robo to the latest version',
		options: [
			{ alias: '-f', name: '--force', description: 'forcefully install' },
			{ alias: '-ns', name: '--no-self-check', description: 'do not check for updates to Sage CLI' },
			{ alias: '-s', name: '--silent', description: 'do not print anything' },
			{ alias: '-v', name: '--verbose', description: 'print more information for debugging' }
		],
		modulePath: '../commands/upgrade.js'
	},
	{
		name: 'login',
		description: 'Sign in to your RoboPlay account',
		options: [
			{ alias: '-s', name: '--silent', description: 'do not print anything' },
			{ alias: '-v', name: '--verbose', description: 'print more information for debugging' },
			{ alias: '-h', name: '--help', description: 'Shows the available command options' }
		],
		modulePath: '../commands/login.js'
	},
	{
		name: 'logout',
		description: 'Sign out of your RoboPlay account',
		options: [
			{ alias: '-s', name: '--silent', description: 'do not print anything' },
			{ alias: '-v', name: '--verbose', description: 'print more information for debugging' },
			{ alias: '-h', name: '--help', description: 'Shows the available command options' }
		],
		modulePath: '../commands/logout.js'
	},
	{
		name: 'cloud',
		description: 'Manage your cloud deployments',
		options: [],
		hasSubcommands: true,
		modulePath: '../commands/cloud/index.js'
	},
	{
		name: 'cli',
		description: 'Inspect CLI commands and extensions from plugins.',
		options: [{ alias: '-i', name: '--inspect', description: 'Show all registered CLI commands and extensions' }],
		positionalArgs: true,
		modulePath: '../commands/cli.js'
	}
]

/**
 * Creates a Command instance that lazy-loads its handler when executed.
 * The command metadata (name, description, options) is set immediately,
 * but the actual handler code is only imported when the command runs.
 */
export function createLazyCommand(meta: CommandMetadata): Command {
	const cmd = new Command(meta.name).description(meta.description)

	// Add all options
	for (const opt of meta.options) {
		cmd.option(opt.alias, opt.name, opt.description)
	}

	// Enable positional args if specified
	if (meta.positionalArgs) {
		cmd.positionalArgs(true)
	}

	// For commands with subcommands, we need to load the full module
	// and use it directly since it registers its own subcommands
	if (meta.hasSubcommands) {
		cmd.handler(async (context: CliContext) => {
			const module = await import(meta.modulePath)
			const loadedCommand = module.default as Command

			// The loaded command has subcommands registered via .addCommand()
			// We need to invoke parsing on the loaded command
			// But since we're already in a handler, we should just call the handler
			if (loadedCommand._handler) {
				return loadedCommand._handler(context)
			}
		})
	} else {
		// Simple lazy handler - just load and execute
		cmd.handler(async (context: CliContext) => {
			const module = await import(meta.modulePath)
			const loadedCommand = module.default as Command
			return loadedCommand._handler(context)
		})
	}

	return cmd
}

/**
 * Get metadata for a specific command by name.
 */
export function getCommandMetadata(name: string): CommandMetadata | undefined {
	return COMMANDS.find((cmd) => cmd.name === name)
}

/**
 * Get all command metadata (useful for help display).
 */
export function getAllCommands(): CommandMetadata[] {
	return COMMANDS
}
