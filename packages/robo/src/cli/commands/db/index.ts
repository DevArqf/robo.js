/**
 * Flashcore Database CLI Command Group
 *
 * Provides commands for managing Flashcore schemas, migrations, and integrity.
 *
 * Usage:
 *   robo db status     - Show schema checksums and pending changes
 *   robo db diff       - Visual schema diff between versions
 *   robo db history    - Show schema version history
 *   robo db export     - Export schema to markdown
 *   robo db migrate    - Run pending migrations
 *   robo db check      - Run integrity checks
 *   robo db repair     - Run integrity repairs
 *   robo db clear      - Clear scoped data
 */

import { Command } from '../../utils/cli-handler.js'
import status from './status.js'
import diff from './diff.js'
import history from './history.js'
import exportCmd from './export.js'
import migrate from './migrate.js'
import check from './check.js'
import repair from './repair.js'
import rebuildIndexes from './rebuild-indexes.js'
import clear from './clear.js'

const command = new Command('db')
	.description('Manage Flashcore database schemas and migrations.')
	.addCommand(status)
	.addCommand(diff)
	.addCommand(history)
	.addCommand(exportCmd)
	.addCommand(migrate)
	.addCommand(check)
	.addCommand(repair)
	.addCommand(rebuildIndexes)
	.addCommand(clear)

export default command
