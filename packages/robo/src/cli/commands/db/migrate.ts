/**
 * Flashcore DB Migrate Command
 *
 * Runs pending migrations with lock management, status tracking,
 * and rollback on failure.
 *
 * Usage: robo db migrate [--dry-run] [--force-unlock] [--target name]
 */

import { Command } from '../../utils/cli-handler.js'
import { color } from '../../../core/color.js'
import { logger } from '../../../core/logger.js'
import type { CliContext } from '../../../types/cli.js'

const command = new Command('migrate')
	.description('Run pending database migrations')
	.option('-d', '--dry-run', 'Show what would be migrated without applying')
	.option('-f', '--force-unlock', 'Force release a stuck migration lock')
	.option('-t', '--target', 'Run migrations up to (and including) this target')
	.option('-r', '--rollback', 'Roll back a specific migration by name')
	.option('-s', '--silent', 'Do not print anything')
	.option('-v', '--verbose', 'Print more information for debugging')
	.option('-h', '--help', 'Shows the available command options')
	.handler(migrateAction)

export default command

interface MigrateCommandOptions {
	dryRun?: boolean
	forceUnlock?: boolean
	target?: string
	rollback?: string
	silent?: boolean
	verbose?: boolean
}

const Indent = '   '

async function migrateAction(context: CliContext) {
	const options = context.options as MigrateCommandOptions
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

		const runner = await Flashcore.$.createMigrationRunner()
		if (!runner) {
			logger.log('')
			logger.error('Failed to create migration runner.')
			logger.log('')
			return
		}

		logger.log('')

		// Handle force unlock
		if (options.forceUnlock) {
			logger.log(Indent, color.yellow('Force releasing migration lock...'))
			await runner.forceUnlock()
			logger.log(Indent, color.green('Lock released.'))
			logger.log('')

			// If only force-unlock was requested, exit
			if (!options.dryRun && !options.target && !options.rollback) {
				return
			}
		}

		// Handle rollback
		if (options.rollback) {
			logger.log(Indent, color.bold(`Rolling back migration: ${options.rollback}`))
			logger.log('')

			const result = await runner.rollback(options.rollback)

			if (result.status === 'success') {
				logger.log(Indent, color.green(`Rollback successful (${result.durationMs}ms)`))
			} else {
				logger.log(Indent, color.red(`Rollback failed: ${result.error}`))
			}

			logger.log('')
			return
		}

		// Get current status
		const status = await runner.getStatus()

		if (status.lockStatus.locked && !options.forceUnlock) {
			logger.log(Indent, color.red('Migration lock is held.'))
			if (status.lockStatus.holder) {
				logger.log(Indent, `Holder: ${status.lockStatus.holder}`)
			}
			if (status.lockStatus.stale) {
				logger.log(Indent, color.yellow('Lock appears stale. Use --force-unlock to override.'))
			} else {
				logger.log(Indent, 'Another migration may be in progress.')
			}
			logger.log('')
			return
		}

		if (status.pending.length === 0) {
			logger.log(Indent, color.green('No pending migrations.'))
			logger.log('')
			return
		}

		// Show pending migrations
		logger.log(Indent, color.bold(`${status.pending.length} pending migration(s):`))
		for (const migrationName of status.pending) {
			logger.log(Indent, `  - ${migrationName}`)
		}
		logger.log('')

		// Dry run mode
		if (options.dryRun) {
			logger.log(Indent, color.cyan('[DRY RUN] The following migrations would be applied:'))
			for (const migrationName of status.pending) {
				if (options.target && migrationName > options.target) break
				logger.log(Indent, `  ${color.green('→')} ${migrationName}`)
			}
			logger.log('')
			logger.log(Indent, color.dim('No changes were made. Remove --dry-run to apply migrations.'))
			logger.log('')
			return
		}

		// Run migrations
		logger.log(Indent, color.bold('Running migrations...'))
		logger.log('')

		const results = await runner.runPending({
			dryRun: false,
			forceUnlock: options.forceUnlock,
			target: options.target
		})

		// Show results
		let successCount = 0
		let failCount = 0

		for (const result of results) {
			if (result.status === 'success') {
				logger.log(Indent, `${color.green('✓')} ${result.name} (${result.durationMs}ms)`)
				successCount++
			} else if (result.status === 'skipped') {
				logger.log(Indent, `${color.dim('○')} ${result.name} (skipped)`)
			} else {
				logger.log(Indent, `${color.red('✗')} ${result.name}`)
				logger.log(Indent, `  Error: ${result.error}`)
				if (result.rollbackAttempted) {
					logger.log(Indent, `  ${color.yellow('Rollback attempted')}`)
				}
				failCount++
			}
		}

		logger.log('')

		// Summary
		if (failCount === 0) {
			logger.log(Indent, color.green(`All ${successCount} migration(s) completed successfully.`))
		} else {
			logger.log(Indent, color.red(`${failCount} migration(s) failed.`))
			if (successCount > 0) {
				logger.log(Indent, `${successCount} migration(s) succeeded before failure.`)
			}
			logger.log(Indent, color.dim('Fix the issue and run migrations again.'))
		}

		logger.log('')
	} catch (error) {
		if (error instanceof Error && error.message.includes('Another migration')) {
			logger.log('')
			logger.error(error.message)
			logger.log('')
		} else {
			logger.error('Migration failed:', error)
		}
	}
}
