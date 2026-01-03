/**
 * Flashcore DB Check Command
 *
 * Runs integrity checks on Flashcore data structures.
 *
 * Usage: robo db check [-m model] [-c check-type]
 */

import { Command } from '../../utils/cli-handler.js'
import { color } from '../../../core/color.js'
import { logger } from '../../../core/logger.js'
import type { CliContext } from '../../../types/cli.js'

const command = new Command('check')
	.description('Run integrity checks on Flashcore data')
	.option('-m', '--model', 'Check a specific model')
	.option('-c', '--check', 'Specific check type (filter, indexes, unique, catalog, all)')
	.option('-s', '--silent', 'Do not print anything')
	.option('-v', '--verbose', 'Print more information for debugging')
	.option('-h', '--help', 'Shows the available command options')
	.handler(checkAction)

export default command

interface CheckCommandOptions {
	model?: string
	check?: string
	silent?: boolean
	verbose?: boolean
}

const Indent = '   '

async function checkAction(context: CliContext) {
	const options = context.options as CheckCommandOptions
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
		logger.log(Indent, color.bold('Flashcore Integrity Check'))
		logger.log(Indent, '=' .repeat(30))
		logger.log('')

		// Get models to check
		const models = Flashcore.$.getRegisteredModels()

		if (models.size === 0) {
			logger.log(Indent, color.dim('No models registered.'))
			logger.log('')
			return
		}

		const modelsToCheck = options.model
			? Array.from(models.values()).filter((m: any) => m.name === options.model)
			: Array.from(models.values())

		if (modelsToCheck.length === 0 && options.model) {
			logger.warn(`Model '${options.model}' not found.`)
			logger.log('')
			return
		}

		const checkType = options.check ?? 'all'
		let totalIssues = 0
		let totalChecks = 0

		// Try to import IntegrityChecker if available
		let IntegrityChecker: any
		try {
			const integrityModule = await import('../../../flashcore/integrity/checker.js')
			IntegrityChecker = integrityModule.IntegrityChecker
		} catch {
			logger.debug('IntegrityChecker not available, using basic checks')
		}

		for (const model of modelsToCheck as any[]) {
			logger.log(Indent, color.cyan(`Checking model: ${model.name}`))

			const issues: string[] = []
			let checks = 0

			// Check catalog integrity
			if (checkType === 'all' || checkType === 'catalog') {
				checks++
				try {
					const catalog = await model.getCatalog?.()
					if (catalog) {
						logger.log(Indent, `  ${color.green('✓')} Catalog readable (${catalog.chunkIds?.length ?? 0} chunks)`)
					} else {
						logger.log(Indent, `  ${color.dim('○')} No catalog (model may be empty)`)
					}
				} catch (e) {
					issues.push(`Catalog corrupted: ${e}`)
					logger.log(Indent, `  ${color.red('✗')} Catalog corrupted`)
				}
			}

			// Check filter integrity
			if (checkType === 'all' || checkType === 'filter') {
				checks++
				try {
					const filter = model._filter
					if (filter) {
						logger.log(Indent, `  ${color.green('✓')} Filter exists`)
					} else {
						logger.log(Indent, `  ${color.dim('○')} No filter configured`)
					}
				} catch (e) {
					issues.push(`Filter error: ${e}`)
					logger.log(Indent, `  ${color.red('✗')} Filter error`)
				}
			}

			// Check indexes integrity
			if (checkType === 'all' || checkType === 'indexes') {
				checks++
				try {
					const indexes = model._indexes
					if (indexes && indexes.size > 0) {
						logger.log(Indent, `  ${color.green('✓')} Indexes (${indexes.size} configured)`)

						if (options.verbose) {
							for (const [field] of indexes) {
								logger.log(Indent, `    - ${field}`)
							}
						}
					} else {
						logger.log(Indent, `  ${color.dim('○')} No indexes configured`)
					}
				} catch (e) {
					issues.push(`Index error: ${e}`)
					logger.log(Indent, `  ${color.red('✗')} Index error`)
				}
			}

			// Check unique constraints
			if (checkType === 'all' || checkType === 'unique') {
				checks++
				try {
					const uniqueIndex = model._uniqueIndex
					if (uniqueIndex) {
						const uniqueFields = model.schema?.fields
							? Object.entries(model.schema.fields)
									.filter(([, f]: [string, any]) => f.unique)
									.map(([name]) => name)
							: []

						if (uniqueFields.length > 0) {
							logger.log(Indent, `  ${color.green('✓')} Unique constraints (${uniqueFields.join(', ')})`)
						} else {
							logger.log(Indent, `  ${color.dim('○')} No unique constraints`)
						}
					} else {
						logger.log(Indent, `  ${color.dim('○')} No unique index`)
					}
				} catch (e) {
					issues.push(`Unique constraint error: ${e}`)
					logger.log(Indent, `  ${color.red('✗')} Unique constraint error`)
				}
			}

			// Run IntegrityChecker if available
			if (IntegrityChecker && (checkType === 'all' || checkType === 'deep')) {
				checks++
				try {
					const checker = new IntegrityChecker(model)
					const report = await checker.check()

					if (report.issues.length === 0) {
						logger.log(Indent, `  ${color.green('✓')} Deep integrity check passed`)
					} else {
						for (const issue of report.issues) {
							issues.push(issue.message)
							logger.log(Indent, `  ${color.red('✗')} ${issue.message}`)
						}
					}
				} catch (e) {
					logger.debug('IntegrityChecker failed:', e)
				}
			}

			totalChecks += checks
			totalIssues += issues.length

			if (issues.length > 0) {
				logger.log(Indent, color.red(`  ${issues.length} issue(s) found`))
			}

			logger.log('')
		}

		// Summary
		logger.log(Indent, color.bold('Summary'))
		logger.log(Indent, `Models checked: ${modelsToCheck.length}`)
		logger.log(Indent, `Total checks: ${totalChecks}`)

		if (totalIssues === 0) {
			logger.log(Indent, color.green('No issues found.'))
		} else {
			logger.log(Indent, color.red(`${totalIssues} issue(s) found.`))
			logger.log(Indent, color.dim('Run "robo db repair" to fix issues.'))
		}

		logger.log('')
	} catch (error) {
		logger.error('Integrity check failed:', error)
	}
}
