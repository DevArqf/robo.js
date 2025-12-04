/**
 * Shared logger for @robojs/dev plugin
 * Per plugin standards: one forked logger named after the plugin
 */
import { logger } from 'robo.js'

export const devLogger = logger.fork('dev')
