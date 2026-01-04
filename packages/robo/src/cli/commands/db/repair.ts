/**
 * Flashcore DB Repair Command
 *
 * Repairs Flashcore data structures based on integrity issues.
 *
 * Usage: robo db repair [-m model] [--rebuild filter,indexes,unique]
 */

import { Command } from '../../utils/cli-handler.js'
import { color } from '../../../core/color.js'
import { logger } from '../../../core/logger.js'
import type { CliContext } from '../../../types/cli.js'

const command = new Command('repair')
	.description('Repair Flashcore data structures')
	.option('-m', '--model', 'Repair a specific model')
	.option('-r', '--rebuild', 'Rebuild specific structures (filter,indexes,unique,all)')
	.option('-d', '--dry-run', 'Show what would be repaired without making changes')
	.option('-s', '--silent', 'Do not print anything')
	.option('-v', '--verbose', 'Print more information for debugging')
	.option('-h', '--help', 'Shows the available command options')
	.handler(repairAction)

export default command

interface RepairCommandOptions {
	model?: string
	rebuild?: string
	dryRun?: boolean
	silent?: boolean
	verbose?: boolean
}

const Indent = '   '

async function repairAction(context: CliContext) {
	const options = context.options as RepairCommandOptions
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
		logger.log(Indent, color.bold('Flashcore Repair'))
		if (options.dryRun) {
			logger.log(Indent, color.cyan('[DRY RUN]'))
		}
		logger.log(Indent, '=' .repeat(20))
		logger.log('')

		// Get models to repair
		const models = Flashcore.$.getRegisteredModels()

		if (models.size === 0) {
			logger.log(Indent, color.dim('No models registered.'))
			logger.log('')
			return
		}

		const modelsToRepair = options.model
			? Array.from(models.values()).filter((m: any) => m.name === options.model)
			: Array.from(models.values())

		if (modelsToRepair.length === 0 && options.model) {
			logger.warn(`Model '${options.model}' not found.`)
			logger.log('')
			return
		}

		// Parse rebuild options
		const rebuildOptions = options.rebuild?.split(',').map((s) => s.trim().toLowerCase()) ?? []
		const rebuildAll = rebuildOptions.includes('all')
		const rebuildFilter = rebuildAll || rebuildOptions.includes('filter')
		const rebuildIndexes = rebuildAll || rebuildOptions.includes('indexes')
		const rebuildUnique = rebuildAll || rebuildOptions.includes('unique')

		// If no specific rebuild requested, default to filter + indexes
		const defaultRebuild = rebuildOptions.length === 0 || (!rebuildFilter && !rebuildIndexes && !rebuildUnique)
		const shouldRebuildFilter = rebuildFilter || defaultRebuild
		const shouldRebuildIndexes = rebuildIndexes || defaultRebuild
		const shouldRebuildUnique = rebuildUnique

		let totalRepairs = 0

		// Try to import RepairEngine if available
		let RepairEngine: any
		try {
			const repairModule = await import('../../../flashcore/integrity/repair.js')
			RepairEngine = repairModule.RepairEngine
		} catch {
			logger.debug('RepairEngine not available, using basic repair')
		}

		for (const model of modelsToRepair as any[]) {
			logger.log(Indent, color.cyan(`Repairing model: ${model.name}`))

			let repairs = 0

			// Rebuild filter
			if (shouldRebuildFilter) {
				if (options.dryRun) {
					logger.log(Indent, `  ${color.dim('→')} Would rebuild filter`)
				} else {
					try {
						if (model.rebuildFilter) {
							await model.rebuildFilter()
							logger.log(Indent, `  ${color.green('✓')} Rebuilt filter`)
							repairs++
						} else {
							logger.log(Indent, `  ${color.dim('○')} No filter to rebuild`)
						}
					} catch (e) {
						logger.log(Indent, `  ${color.red('✗')} Failed to rebuild filter: ${e}`)
					}
				}
			}

			// Rebuild indexes
			if (shouldRebuildIndexes) {
				if (options.dryRun) {
					logger.log(Indent, `  ${color.dim('→')} Would rebuild indexes`)
				} else {
					try {
						if (model.rebuildIndexes) {
							await model.rebuildIndexes()
							logger.log(Indent, `  ${color.green('✓')} Rebuilt indexes`)
							repairs++
						} else {
							logger.log(Indent, `  ${color.dim('○')} No indexes to rebuild`)
						}
					} catch (e) {
						logger.log(Indent, `  ${color.red('✗')} Failed to rebuild indexes: ${e}`)
					}
				}
			}

			// Rebuild unique index
			if (shouldRebuildUnique) {
				if (options.dryRun) {
					logger.log(Indent, `  ${color.dim('→')} Would rebuild unique index`)
				} else {
					try {
						if (model.rebuildUniqueIndex) {
							await model.rebuildUniqueIndex()
							logger.log(Indent, `  ${color.green('✓')} Rebuilt unique index`)
							repairs++
						} else {
							logger.log(Indent, `  ${color.dim('○')} No unique index to rebuild`)
						}
					} catch (e) {
						logger.log(Indent, `  ${color.red('✗')} Failed to rebuild unique index: ${e}`)
					}
				}
			}

			// Use RepairEngine for more comprehensive repairs
			if (RepairEngine && !options.dryRun) {
				try {
					const engine = new RepairEngine(model)
					const report = await engine.repair({
						filter: shouldRebuildFilter,
						indexes: shouldRebuildIndexes,
						uniqueIndexes: shouldRebuildUnique
					})

					if (report.repairs > 0) {
						logger.log(Indent, `  ${color.green('✓')} RepairEngine: ${report.repairs} repair(s)`)
						repairs += report.repairs
					}
				} catch (e) {
					logger.debug('RepairEngine failed:', e)
				}
			}

			totalRepairs += repairs

			if (repairs > 0 || options.dryRun) {
				logger.log('')
			}
		}

		// Summary
		logger.log(Indent, color.bold('Summary'))
		logger.log(Indent, `Models processed: ${modelsToRepair.length}`)

		if (options.dryRun) {
			logger.log(Indent, color.dim('No changes made (dry run).'))
		} else if (totalRepairs === 0) {
			logger.log(Indent, color.dim('No repairs needed.'))
		} else {
			logger.log(Indent, color.green(`${totalRepairs} repair(s) completed.`))
		}

		logger.log('')
	} catch (error) {
		logger.error('Repair failed:', error)
	}
}
