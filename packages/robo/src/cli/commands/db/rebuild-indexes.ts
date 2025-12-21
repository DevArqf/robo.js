/**
 * Flashcore DB Rebuild Indexes Command
 *
 * Convenience alias for `robo db repair --rebuild=indexes`.
 *
 * Usage: robo db rebuild-indexes [-m model]
 */

import { Command } from '../../utils/cli-handler.js'
import { color } from '../../../core/color.js'
import { logger } from '../../../core/logger.js'
import type { CliContext } from '../../../types/cli.js'

const command = new Command('rebuild-indexes')
	.description('Rebuild all indexes for Flashcore models')
	.option('-m', '--model', 'Rebuild indexes for a specific model')
	.option('-a', '--all', 'Also rebuild filter and unique indexes')
	.option('-s', '--silent', 'Do not print anything')
	.option('-v', '--verbose', 'Print more information for debugging')
	.option('-h', '--help', 'Shows the available command options')
	.handler(rebuildIndexesAction)

export default command

interface RebuildIndexesCommandOptions {
	model?: string
	all?: boolean
	silent?: boolean
	verbose?: boolean
}

const Indent = '   '

async function rebuildIndexesAction(context: CliContext) {
	const options = context.options as RebuildIndexesCommandOptions
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

		logger.log('')
		logger.log(Indent, color.bold('Rebuild Indexes'))
		logger.log(Indent, '=' .repeat(18))
		logger.log('')

		// Get models to rebuild
		const models = Flashcore.$.getRegisteredModels()

		if (models.size === 0) {
			logger.log(Indent, color.dim('No models registered.'))
			logger.log('')
			return
		}

		const modelsToRebuild = options.model
			? Array.from(models.values()).filter((m: any) => m.name === options.model)
			: Array.from(models.values())

		if (modelsToRebuild.length === 0 && options.model) {
			logger.warn(`Model '${options.model}' not found.`)
			logger.log('')
			return
		}

		let totalRebuilt = 0
		const startTime = Date.now()

		for (const model of modelsToRebuild as any[]) {
			logger.log(Indent, color.cyan(`Model: ${model.name}`))

			// Rebuild indexes
			try {
				if (model.rebuildIndexes) {
					await model.rebuildIndexes()
					logger.log(Indent, `  ${color.green('✓')} Indexes rebuilt`)
					totalRebuilt++
				} else {
					logger.log(Indent, `  ${color.dim('○')} No indexes to rebuild`)
				}
			} catch (e) {
				logger.log(Indent, `  ${color.red('✗')} Failed: ${e}`)
			}

			// Also rebuild filter and unique if --all
			if (options.all) {
				try {
					if (model.rebuildFilter) {
						await model.rebuildFilter()
						logger.log(Indent, `  ${color.green('✓')} Filter rebuilt`)
						totalRebuilt++
					}
				} catch (e) {
					logger.log(Indent, `  ${color.red('✗')} Filter failed: ${e}`)
				}

				try {
					if (model.rebuildUniqueIndex) {
						await model.rebuildUniqueIndex()
						logger.log(Indent, `  ${color.green('✓')} Unique index rebuilt`)
						totalRebuilt++
					}
				} catch (e) {
					logger.log(Indent, `  ${color.red('✗')} Unique index failed: ${e}`)
				}
			}

			logger.log('')
		}

		const duration = Date.now() - startTime

		// Summary
		logger.log(Indent, color.bold('Summary'))
		logger.log(Indent, `Models processed: ${modelsToRebuild.length}`)
		logger.log(Indent, `Structures rebuilt: ${totalRebuilt}`)
		logger.log(Indent, `Duration: ${duration}ms`)
		logger.log('')
	} catch (error) {
		logger.error('Rebuild failed:', error)
	}
}
