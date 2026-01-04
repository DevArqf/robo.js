/**
 * robo db diff
 *
 * Shows visual schema diff between stored and current versions.
 */

import { Command } from '../../utils/cli-handler.js'
import { color, composeColors } from '../../../core/color.js'
import { logger } from '../../../core/logger.js'
import type { CliContext } from '../../../types/cli.js'

const command = new Command('diff')
	.description('Show visual schema diff between versions.')
	.option('-m', '--model', 'specific model to diff')
	.option('-s', '--silent', 'do not print anything')
	.option('-v', '--verbose', 'print more information for debugging')
	.option('-h', '--help', 'Shows the available command options')
	.positionalArgs(true)
	.handler(diffAction)

export default command

const Indent = '   '

interface DiffCommandOptions {
	model?: string
	silent?: boolean
	verbose?: boolean
}

async function diffAction(context: CliContext) {
	const options = context.options as DiffCommandOptions
	const modelName = options.model || context.args[0]

	logger({
		enabled: !options.silent,
		level: options.verbose ? 'debug' : 'info'
	})

	try {
		const { Flashcore } = await import('../../../flashcore/index.js')
		const { analyzeSchemaChanges, formatSchemaChanges } = await import('../../../flashcore/migration/index.js')

		if (!Flashcore.$.isInitialized) {
			logger.log('')
			logger.warn('Flashcore has not been initialized.')
			logger.log('')
			return
		}

		const metadataManager = Flashcore.$._schemaMetadataManager
		if (!metadataManager) {
			logger.log('')
			logger.warn('Schema metadata manager not available.')
			logger.log('')
			return
		}

		const models = Flashcore.$.getRegisteredModels()
		if (models.size === 0) {
			logger.log('')
			logger.info('No models registered.')
			logger.log('')
			return
		}

		// Filter to specific model if provided
		const modelsToCheck = modelName
			? new Map([...models].filter(([name]) => name === modelName))
			: models

		if (modelName && modelsToCheck.size === 0) {
			logger.log('')
			logger.error(`Model "${modelName}" not found.`)
			logger.log('')
			return
		}

		logger.log('')
		logger.log(Indent + color.bold('Schema Diff'))
		logger.log(Indent + '============')
		logger.log('')

		let hasChanges = false

		for (const [name, model] of modelsToCheck) {
			const metadata = await metadataManager.getModelMetadata(name)

			if (!metadata) {
				logger.log(Indent + color.bold(name) + ' ' + color.yellow('(untracked)'))
				logger.log(Indent + '  No stored schema - will be tracked on first sync')
				logger.log('')
				continue
			}

			// Convert current schema to metadata format for comparison
			const { normalizedFieldToMetadata } = await import('../../../flashcore/migration/types.js')
			const currentFields: Record<string, any> = {}

			for (const [fieldName, field] of Object.entries(model._schema.fields)) {
				currentFields[fieldName] = normalizedFieldToMetadata(field as any)
			}

			const currentMetadata = {
				version: metadata.version,
				checksum: model._schemaChecksum,
				fields: currentFields,
				relations: {}, // Relations diff not yet implemented
				migratedAt: metadata.migratedAt,
				migrationHistory: metadata.migrationHistory
			}

			// Analyze changes
			const analysis = analyzeSchemaChanges(metadata, currentMetadata)

			if (analysis.changes.length === 0) {
				logger.log(Indent + color.bold(name) + ' ' + color.green('(no changes)'))
				logger.log('')
				continue
			}

			hasChanges = true
			logger.log(Indent + color.bold(name))

			// Format and display changes
			const formatted = formatSchemaChanges(analysis.changes)
			for (const line of formatted.split('\n')) {
				if (line.startsWith('+')) {
					logger.log(Indent + '  ' + color.green(line))
				} else if (line.startsWith('-')) {
					logger.log(Indent + '  ' + color.red(line))
				} else if (line.startsWith('~')) {
					logger.log(Indent + '  ' + color.yellow(line))
				} else {
					logger.log(Indent + '  ' + line)
				}
			}

			// Show summary
			const safeCount = analysis.changes.filter(c => c.safe).length
			const breakingCount = analysis.changes.filter(c => !c.safe).length

			if (safeCount > 0) {
				logger.log(Indent + '  ' + color.green(`${safeCount} safe change(s) - will auto-apply`))
			}
			if (breakingCount > 0) {
				logger.log(Indent + '  ' + color.red(`${breakingCount} breaking change(s) - migration required`))
			}

			logger.log('')
		}

		if (!hasChanges) {
			logger.log(Indent + color.green('All schemas are up to date.'))
			logger.log('')
		}

	} catch (error) {
		logger.error('Failed to compute diff:', error)
	}
}
