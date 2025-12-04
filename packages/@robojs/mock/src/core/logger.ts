import { logger } from 'robo.js'

/**
 * Shared logger for @robojs/mock plugin
 * Following plugin standards: one forked logger per plugin
 */
export const mockLogger = logger.fork('mock')
