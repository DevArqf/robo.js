/**
 * @robojs/dev - Development tools for Robo.js
 *
 * Provides /dev commands and debug utilities that are automatically
 * stripped from production builds.
 */

// Export debug utilities for programmatic use
export { DEBUG_MODE, sendDebugError, handleDebugButton, printErrorResponse } from './core/debug.js'

// Export types
export type { DevPluginConfig } from './types.js'

// Export logger for internal use
export { devLogger } from './core/helpers.js'
