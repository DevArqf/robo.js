/**
 * Flashcore v1 (spec rev 4.3) Logger
 *
 * Forked logger for Flashcore operations.
 */

import { logger as roboLogger } from '../../core/logger.js'

/**
 * Flashcore logger instance.
 * Follows plugin logging standards - single forked logger for the entire module.
 */
export const logger = roboLogger.fork('flashcore')
