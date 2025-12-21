/**
 * Flashcore DB Clear Command
 *
 * Safely clears data from Flashcore models with confirmation.
 *
 * Usage: robo db clear [-m model] [--confirm]
 */

import { Command } from '../../utils/cli-handler.js'
import { color } from '../../../core/color.js'
import { logger } from '../../../core/logger.js'
import type { CliContext } from '../../../types/cli.js'

const command = new Command('clear')
	.description('Clear data from Flashcore models')
	.option('-m', '--model', 'Clear a specific model')
	.option('-n', '--namespace', 'Clear models in a specific namespace')
	.option('-c', '--confirm', 'Skip confirmation prompt (DANGEROUS)')
	.option('-k', '--keep-schema', 'Keep schema metadata (only clear data)')
	.option('-s', '--silent', 'Do not print anything')
	.option('-v', '--verbose', 'Print more information for debugging')
	.option('-h', '--help', 'Shows the available command options')
	.handler(clearAction)

export default command

interface ClearCommandOptions {
	model?: string
	namespace?: string
	confirm?: boolean
	keepSchema?: boolean
	silent?: boolean
	verbose?: boolean
}

const Indent = '   '

async function clearAction(context: CliContext) {
	const options = context.options as ClearCommandOptions
	logger({
		enabled: !options.silent,
		level: options.verbose ? 'debug' : 'info'
	})

	try {
		const { Flashcore } = await import('../../../flashcore/index.js')

		if (!Flashcore.$.isInitialized) {
			logger.log('')
			logger.warn('Flashcore is not initialized.')
			logger.info('Run your Robo to initialize Flashcore first.')
			logger.log('')
			return
		}

		// Get models to clear
		const models = Flashcore.$.getRegisteredModels()

		if (models.size === 0) {
			logger.log('')
			logger.log(Indent, color.dim('No models registered.'))
			logger.log('')
			return
		}

		let modelsToClear = Array.from(models.values()) as any[]

		// Filter by model name
		if (options.model) {
			modelsToClear = modelsToClear.filter((m: any) => m.name === options.model)
			if (modelsToClear.length === 0) {
				logger.warn(`Model '${options.model}' not found.`)
				return
			}
		}

		// Filter by namespace
		if (options.namespace) {
			modelsToClear = modelsToClear.filter((m: any) => (m.namespace ?? 'default') === options.namespace)
			if (modelsToClear.length === 0) {
				logger.warn(`No models found in namespace '${options.namespace}'.`)
				return
			}
		}

		logger.log('')

		// Show warning
		logger.log(Indent, color.red(color.bold('WARNING: This will permanently delete data!')))
		logger.log('')
		logger.log(Indent, 'The following models will be cleared:')
		for (const model of modelsToClear) {
			const ns = model.namespace ?? 'default'
			logger.log(Indent, `  - ${model.name} (${ns})`)
		}
		logger.log('')

		// Check confirmation
		if (!options.confirm) {
			logger.log(Indent, color.yellow('Add --confirm to proceed with deletion.'))
			logger.log(Indent, color.dim('This is a safety measure to prevent accidental data loss.'))
			logger.log('')
			return
		}

		logger.log(Indent, color.bold('Clearing data...'))
		logger.log('')

		let totalCleared = 0
		let totalRecords = 0

		for (const model of modelsToClear) {
			logger.log(Indent, color.cyan(`Model: ${model.name}`))

			try {
				// Get count before clearing
				let count = 0
				try {
					count = await model.count()
				} catch {
					// Count not available
				}

				// Clear the model data
				if (model.deleteMany) {
					const deleted = await model.deleteMany({})
					logger.log(Indent, `  ${color.green('✓')} Deleted ${deleted} record(s)`)
					totalRecords += deleted
				} else if (model.clear) {
					await model.clear()
					logger.log(Indent, `  ${color.green('✓')} Cleared (${count} records)`)
					totalRecords += count
				} else {
					logger.log(Indent, `  ${color.yellow('○')} No clear method available`)
					continue
				}

				// Clear derived structures
				if (!options.keepSchema) {
					try {
						if (model.clearFilter) await model.clearFilter()
						if (model.clearIndexes) await model.clearIndexes()
						if (model.clearUniqueIndex) await model.clearUniqueIndex()
						logger.log(Indent, `  ${color.green('✓')} Cleared derived structures`)
					} catch (e) {
						logger.debug('Failed to clear derived structures:', e)
					}
				}

				totalCleared++
			} catch (e) {
				logger.log(Indent, `  ${color.red('✗')} Failed: ${e}`)
			}

			logger.log('')
		}

		// Summary
		logger.log(Indent, color.bold('Summary'))
		logger.log(Indent, `Models cleared: ${totalCleared}/${modelsToClear.length}`)
		logger.log(Indent, `Records deleted: ${totalRecords}`)

		if (options.keepSchema) {
			logger.log(Indent, color.dim('Schema metadata preserved.'))
		}

		logger.log('')
	} catch (error) {
		logger.error('Clear failed:', error)
	}
}
