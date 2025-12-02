/**
 * CLI Introspection Command
 *
 * Provides information about registered CLI commands and extensions.
 * Usage: robo cli --inspect [command]
 */

import { Command } from '../utils/cli-handler.js'
import { color } from '../../core/color.js'
import { logger } from '../../core/logger.js'
import { loadCliManifest } from '../utils/cli-loader.js'
import type { CliContext } from '../../types/cli.js'

const command = new Command('cli')
	.description('Inspect CLI commands and extensions from plugins.')
	.option('-i', '--inspect', 'Show all registered CLI commands and extensions')
	.positionalArgs(true)
	.handler(cliAction)

export default command

async function cliAction({ args }: CliContext) {
	// Always show inspect mode - just pass the command if specified
	await showInspect(args[0])
}

async function showInspect(specificCommand?: string) {
	const manifest = await loadCliManifest()

	if (!manifest) {
		logger.log('')
		logger.warn('No CLI commands found. Install plugins with CLI extensions or run `robo build`.')
		logger.log('')
		return
	}

	const commands = Object.keys(manifest.commands)
	const extensionTargets = Object.keys(manifest.extensions)

	if (specificCommand) {
		// Show details for a specific command
		await showCommandDetails(manifest, specificCommand)
		return
	}

	// Show overview
	console.log('')
	console.log(color.bold('CLI Extension Registry'))
	console.log('======================')
	console.log('')

	// Commands section
	if (commands.length > 0) {
		console.log(color.green('Commands:'))
		for (const cmd of commands) {
			const entry = manifest.commands[cmd]
			const source = entry.plugin ? `[${entry.plugin}]` : '[project]'
			console.log(`  ${color.white(cmd.padEnd(20))} ${color.dim(source)}`)
		}
		console.log('')
	} else {
		console.log(color.dim('No plugin commands registered.'))
		console.log('')
	}

	// Extensions section
	if (extensionTargets.length > 0) {
		console.log(color.green('Extensions:'))
		for (const target of extensionTargets) {
			const exts = manifest.extensions[target]
			console.log(`  ${color.white(target)}:`)
			for (const ext of exts) {
				const source = ext.plugin ? ext.plugin : 'project'
				const options = ext.options?.map((o) => `${o.alias}/${o.name}`).join(', ') || 'no options'
				const hooks = [ext.hasBefore ? 'before' : null, ext.hasAfter ? 'after' : null]
					.filter(Boolean)
					.join(', ')
				console.log(`    ${color.dim(`from ${source}`)}: ${options}`)
				if (hooks) {
					console.log(`    ${color.dim(`hooks: ${hooks}`)}`)
				}
			}
		}
		console.log('')
	}

	// Conflicts section (placeholder for future)
	console.log(color.green('Conflicts:'))
	console.log(color.dim('  None detected'))
	console.log('')

	// Tip
	console.log(color.dim(`Tip: Use 'robo cli --inspect <command>' for details on a specific command.`))
	console.log('')
}

async function showCommandDetails(
	manifest: Awaited<ReturnType<typeof loadCliManifest>>,
	commandName: string
) {
	if (!manifest) return

	const entry = manifest.commands[commandName]

	if (!entry) {
		logger.log('')
		logger.error(`Command "${commandName}" not found in CLI manifest.`)
		logger.log('')

		// Suggest similar commands
		const similar = Object.keys(manifest.commands).filter(
			(cmd) => cmd.includes(commandName) || commandName.includes(cmd.split(' ')[0])
		)
		if (similar.length > 0) {
			console.log(color.dim('Did you mean one of these?'))
			for (const cmd of similar) {
				console.log(`  ${cmd}`)
			}
			console.log('')
		}
		return
	}

	console.log('')
	console.log(color.bold(`Command: robo ${commandName}`))
	console.log('============' + '='.repeat(commandName.length + 6))
	console.log('')

	// Source
	const source = entry.plugin ? `[${entry.plugin}]` : '[project]'
	console.log(`Source: ${source}`)
	console.log(`Description: ${entry.description}`)
	console.log('')

	// Options
	if (entry.options && entry.options.length > 0) {
		console.log(color.green('Options:'))
		for (const opt of entry.options) {
			console.log(`  ${color.green(opt.alias)}, ${color.green(opt.name)}: ${opt.description}`)
		}
		console.log('')
	}

	// Extensions for this command's root
	const rootCommand = commandName.split(' ')[0]
	const extensions = manifest.extensions[rootCommand] || []

	if (extensions.length > 0) {
		console.log(color.green('Extended Options:'))
		for (const ext of extensions) {
			const extSource = ext.plugin ? `[${ext.plugin}]` : '[project]'
			if (ext.options) {
				for (const opt of ext.options) {
					console.log(`  ${color.green(opt.alias)}, ${color.green(opt.name)}: ${opt.description} ${color.dim(extSource)}`)
				}
			}
		}
		console.log('')

		console.log(color.green('Hooks:'))
		for (const ext of extensions) {
			const extSource = ext.plugin ?? 'project'
			const hooks = []
			if (ext.hasBefore) hooks.push('before')
			if (ext.hasAfter) hooks.push('after')
			if (hooks.length > 0) {
				console.log(`  ${extSource}: ${hooks.join(', ')}`)
			}
		}
		console.log('')
	}

	// Subcommands
	if (entry.subcommands && entry.subcommands.length > 0) {
		console.log(color.green('Subcommands:'))
		for (const sub of entry.subcommands) {
			console.log(`  ${sub}`)
		}
		console.log('')
	}
}
