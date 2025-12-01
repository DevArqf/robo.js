import { color, Manifest } from 'robo.js'
import { Command } from 'commander'
import { logger } from '../core/logger.js'
import { checkSageUpdates } from '../core/utils.js'

const command = new Command('why')
	.arguments('[entities...]')
	.description(
		'Find out why a command, event, permission, or scope is in your Robo. e.g. /ping, @ready, %ADMINISTRATOR, +applications.commands'
	)
	.option('-m --mode <mode>', 'specify the mode to check (default: production)')
	.option('-ns --no-self-check', 'do not check for updates to Sage CLI')
	.option('-s --silent', 'do not print anything')
	.option('-v --verbose', 'print more information for debugging')
	.action(whyAction)
export default command

const validPrefixes = [
	{ symbol: '/', full: 'command:', symbolMinLength: 2, fullMinLength: 9 },
	{ symbol: '@', full: 'event:', symbolMinLength: 2, fullMinLength: 7 },
	{ symbol: '%', full: 'permission:', symbolMinLength: 2, fullMinLength: 12 },
	{ symbol: '+', full: 'scope:', symbolMinLength: 2, fullMinLength: 7 }
]

interface WhyOptions {
	mode?: string
	selfCheck?: boolean
	silent?: boolean
	verbose?: boolean
}

async function whyAction(entities: string[], options: WhyOptions) {
	// Create a logger
	logger({
		enabled: !options.silent,
		level: options.verbose ? 'debug' : 'info'
	})
	logger.debug(`CLI Options:`, options)
	if (options.selfCheck) {
		await checkSageUpdates()
	}

	const text = entities[0]
	logger.debug(`> "${text}"`)
	if (!text) {
		logger.error('Please provide a command, event, permission, or scope.')
		process.exit(1)
	}

	let prefixType = null
	for (const prefix of validPrefixes) {
		if (text.startsWith(prefix.symbol) || text.startsWith(prefix.full)) {
			if (
				(text.startsWith(prefix.symbol) && text.length >= prefix.symbolMinLength) ||
				(text.startsWith(prefix.full) && text.length >= prefix.fullMinLength)
			) {
				prefixType = prefix
				break
			} else {
				logger.error(`Please provide a ${prefix.full.slice(0, -1)} name.`)
				process.exit(1)
			}
		}
	}

	if (!prefixType) {
		logger.error('Please provide a command, event, permission, or scope.')
		process.exit(1)
	}

	// Remove full or symbol prefix from text
	const entity = text.startsWith(prefixType.full)
		? text.slice(prefixType.full.length)
		: text.slice(prefixType.symbol.length)
	logger.debug(`Searching for ${prefixType.full.replace(':', '')} ${color.blue(entity)}...`)

	// Initialize the Manifest API with the specified mode
	const mode = options.mode ?? 'production'
	try {
		await Manifest.initialize(mode)
		logger.debug(`Manifest initialized in ${mode} mode`)
	} catch (error) {
		logger.error(`Could not load manifest. Make sure you have built your Robo with ${color.cyan('robo build')}.`)
		process.exit(1)
	}

	if (prefixType.full === 'command:') {
		const commands = await Manifest.routes('discordjs', 'commands')
		const command = commands.find((c) => c.key === entity)

		if (!command) {
			logger.info('This command does not exist.')
		} else if (command.source === 'plugin' && command.plugin) {
			logger.info(`This command is provided by the ${color.blue(command.plugin)} plugin.`)
		} else if (command.metadata?.auto) {
			logger.info(
				'This is a default command. You can override it by creating a command with the same name or disable it in your config file.'
			)
		} else {
			logger.info(
				`This command exists in your Robo because you created it: ${color.blue('/src/commands/' + command.path)}`
			)
		}
	} else if (prefixType.full === 'event:') {
		const events = await Manifest.routes('discordjs', 'events')
		const matchingEvents = events.filter((e) => e.key === entity)

		if (matchingEvents.length === 0) {
			logger.info('This event does not exist.')
			return
		}

		// Categorize events by source
		const plugins = matchingEvents.filter((e) => e.source === 'plugin' && e.plugin)
		const defaults = matchingEvents.filter((e) => e.metadata?.auto)
		const custom = matchingEvents.filter((e) => e.source === 'project' && !e.metadata?.auto)

		logger.info(`This event is being handled by the following:\n`)
		if (plugins.length) {
			logger.log('        ' + color.bold(`Plugins`))
			plugins.forEach((e) => {
				logger.log(`        ${color.blue(e.plugin!) + ':'}`, e.path)
			})
			logger.log('')
		}
		if (defaults.length) {
			logger.log('        ' + color.bold(`Default config`))
			defaults.forEach((e) => {
				logger.log(`        ${color.blue('Δ')}`, e.path)
			})
			logger.log('')
		}
		if (custom.length) {
			logger.log('        ' + color.bold(`Files`))
			custom.forEach((e) => {
				logger.log(`        ${color.blue('/src/events/' + e.path)}`)
			})
			logger.log('')
		}
	} else if (prefixType.full === 'permission:') {
		// Permissions are now stored in discordjs namespace metadata
		const metadata = Manifest.metadata('discordjs')
		logger.debug('Metadata:', metadata)
		logger.info('Permission lookup is not yet fully implemented. Check the discordjs metadata.')
	} else if (prefixType.full === 'scope:') {
		// Scopes are now stored in discordjs namespace metadata
		const metadata = Manifest.metadata('discordjs')
		logger.debug('Metadata:', metadata)
		logger.info('Scope lookup is not yet fully implemented. Check the discordjs metadata.')
	}
}
