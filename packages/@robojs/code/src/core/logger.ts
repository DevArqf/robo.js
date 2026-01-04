/**
 * Logger singleton for @robojs/code SDK
 *
 * Uses the robo.js logger which is browser-compatible.
 */
import { logger } from 'robo.js/logger'
import type { LogLevel } from 'robo.js/logger'

/**
 * Shared logger instance for @robojs/code
 *
 * Usage:
 * ```typescript
 * import { codeLogger } from '../core/logger.js'
 * codeLogger.info('Starting agent run')
 * codeLogger.debug('Tool call:', { name, args })
 * codeLogger.error('Execution failed:', error)
 * ```
 */
export const codeLogger = logger.fork('code')

/**
 * Sets the log level for the @robojs/code SDK.
 *
 * Call this early in your application to enable debug logging:
 * ```typescript
 * import { setLogLevel } from '@robojs/code'
 * setLogLevel('debug')
 * ```
 *
 * @param level - The minimum log level to display ('trace' | 'debug' | 'info' | 'warn' | 'error')
 */
export function setLogLevel(level: LogLevel) {
	logger({ level })
}
