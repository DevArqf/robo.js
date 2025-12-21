/**
 * robo db history
 *
 * Shows schema version history.
 */

import { Command } from '../../utils/cli-handler.js'
import { color } from '../../../core/color.js'
import { logger } from '../../../core/logger.js'
import type { CliContext } from '../../../types/cli.js'

const command = new Command('history')
	.description('Show schema version history.')
	.option('-n', '--namespace', 'specific namespace to show history for')
	.option('-l', '--limit', 'maximum number of entries to show')
	.option('-s', '--silent', 'do not print anything')
	.option('-v', '--verbose', 'print more information for debugging')
	.option('-h', '--help', 'Shows the available command options')
	.handler(historyAction)

export default command

const Indent = '   '

interface HistoryCommandOptions {
	namespace?: string
	limit?: string
	silent?: boolean
	verbose?: boolean
}

async function historyAction(context: CliContext) {
	const options = context.options as HistoryCommandOptions
	const namespace = options.namespace || 'default'
	const limit = options.limit ? parseInt(options.limit, 10) : 20

	logger({
		enabled: !options.silent,
		level: options.verbose ? 'debug' : 'info'
	})

	try {
		const { Flashcore } = await import('../../../flashcore/index.js')

		if (!Flashcore.$.isInitialized) {
			logger.log('')
			logger.warn('Flashcore has not been initialized.')
			logger.log('')
			return
		}

		const historyManager = Flashcore.$._schemaHistoryManager
		if (!historyManager) {
			logger.log('')
			logger.warn('Schema history manager not available.')
			logger.log('')
			return
		}

		const history = await historyManager.getHistory(namespace)

		logger.log('')
		logger.log(Indent + color.bold(`Schema History: ${namespace}`))
		logger.log(Indent + '='.repeat(20 + namespace.length))
		logger.log('')

		if (history.length === 0) {
			logger.log(Indent + color.dim('No history entries.'))
			logger.log('')
			return
		}

		// Show most recent entries first, up to limit
		const entriesToShow = history.slice(-limit).reverse()

		for (const entry of entriesToShow) {
			const date = new Date(entry.timestamp)
			const dateStr = date.toISOString().replace('T', ' ').slice(0, 19)

			logger.log(Indent + color.bold(`Version ${entry.version}`))
			logger.log(Indent + '  ' + color.dim('Date: ') + dateStr)
			logger.log(Indent + '  ' + color.dim('Checksum: ') + entry.checksum)

			if (entry.changeCount > 0) {
				const changeColor = entry.hasBreakingChanges ? color.red : color.green
				const changeLabel = entry.hasBreakingChanges ? 'breaking' : 'safe'
				logger.log(Indent + '  ' + color.dim('Changes: ') + changeColor(`${entry.changeCount} (${changeLabel})`))
			}

			if (entry.migrationName) {
				logger.log(Indent + '  ' + color.dim('Migration: ') + color.cyan(entry.migrationName))
			}

			logger.log('')
		}

		if (history.length > limit) {
			logger.log(Indent + color.dim(`Showing ${limit} of ${history.length} entries.`))
			logger.log(Indent + color.dim(`Use --limit to show more.`))
			logger.log('')
		}

	} catch (error) {
		logger.error('Failed to get history:', error)
	}
}
