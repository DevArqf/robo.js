/**
 * robo db status
 *
 * Shows schema checksums and pending changes for all registered models.
 */

import { Command } from '../../utils/cli-handler.js'
import { color, composeColors } from '../../../core/color.js'
import { logger } from '../../../core/logger.js'
import type { CliContext } from '../../../types/cli.js'

const command = new Command('status')
	.description('Show schema checksums and pending changes.')
	.option('-s', '--silent', 'do not print anything')
	.option('-v', '--verbose', 'print more information for debugging')
	.option('-h', '--help', 'Shows the available command options')
	.handler(statusAction)

export default command

const Indent = '   '

interface StatusCommandOptions {
	silent?: boolean
	verbose?: boolean
}

async function statusAction(context: CliContext) {
	const options = context.options as StatusCommandOptions
	logger({
		enabled: !options.silent,
		level: options.verbose ? 'debug' : 'info'
	})

	try {
		// Lazy import to avoid loading flashcore in CLI startup
		const { Flashcore } = await import('../../../flashcore/index.js')

		// Check if Flashcore has been initialized
		if (!Flashcore.$.isInitialized) {
			logger.log('')
			logger.warn('Flashcore has not been initialized.')
			logger.info('Run your Robo to initialize Flashcore, then check status.')
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

		// Get registered models
		const models = Flashcore.$.getRegisteredModels()
		if (models.size === 0) {
			logger.log('')
			logger.info('No models registered.')
			logger.log('')
			return
		}

		logger.log('')
		logger.log(Indent + color.bold('Flashcore Schema Status'))
		logger.log(Indent + '========================')
		logger.log('')

		// Show each model's status
		for (const [name, model] of models) {
			const metadata = await metadataManager.getModelMetadata(name)
			const currentChecksum = model.getSchemaChecksum()

			const icon = metadata ? '✓' : '○'
			const iconColor = metadata ? color.green : color.yellow
			const statusText = metadata ? 'tracked' : 'untracked'
			const statusColor = metadata ? color.green : color.yellow

			logger.log(Indent + composeColors(color.bold, iconColor)(icon) + ' ' + color.bold(name))
			logger.log(Indent + '  Status: ' + statusColor(statusText))
			logger.log(Indent + '  Checksum: ' + color.dim(currentChecksum || 'unknown'))

			if (metadata) {
				logger.log(Indent + '  Stored: ' + color.dim(metadata.checksum))
				logger.log(Indent + '  Version: ' + color.dim(String(metadata.version)))
				logger.log(Indent + '  Migrated: ' + color.dim(metadata.migratedAt))

				if (metadata.checksum !== currentChecksum) {
					logger.log(Indent + '  ' + color.yellow('⚠ Schema has changed'))
				}
			}

			logger.log('')
		}

		// Show pending migrations
		const migrationRunner = await Flashcore.$.createMigrationRunner()
		if (migrationRunner) {
			const report = await migrationRunner.getStatus()

			if (report.pending.length > 0) {
				logger.log(Indent + color.bold('Pending Migrations'))
				logger.log(Indent + '-------------------')
				for (const migrationName of report.pending) {
					logger.log(Indent + '  ' + color.yellow('○') + ' ' + migrationName)
				}
				logger.log('')
			}

			if (report.failed.length > 0) {
				logger.log(Indent + color.bold('Failed Migrations'))
				logger.log(Indent + '-----------------')
				for (const migrationName of report.failed) {
					logger.log(Indent + '  ' + color.red('✗') + ' ' + migrationName)
				}
				logger.log('')
			}

			if (report.lockStatus.locked) {
				const lockColor = report.lockStatus.stale ? color.yellow : color.red
				logger.log(Indent + lockColor('Migration lock active'))
				logger.log(Indent + '  Holder: ' + color.dim(report.lockStatus.holder || 'unknown'))
				if (report.lockStatus.stale) {
					logger.log(Indent + '  ' + color.yellow('Lock is stale - can be overridden'))
				}
				logger.log('')
			}
		}

	} catch (error) {
		logger.error('Failed to get status:', error)
	}
}
