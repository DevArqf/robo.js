/**
 * Caps and thresholds for project indexing and overview
 *
 * These constants define bounded memory usage to prevent OOM
 * on large projects while maintaining useful information.
 */

/**
 * Index capacity limits
 */
export const INDEX_CAPS = {
	/**
	 * Maximum number of files to include in index
	 * User confirmed: 10,000 files is the default cap
	 */
	maxFiles: 10_000,

	/**
	 * Maximum number of directories to include in index
	 */
	maxDirs: 5_000,

	/**
	 * Files larger than this use size+mtime for fingerprinting
	 * instead of content hash (256KB)
	 */
	largeFileThreshold: 256 * 1024
} as const

/**
 * Overview capacity limits
 */
export const OVERVIEW_CAPS = {
	/**
	 * Maximum number of commands to list in Robo overview
	 */
	maxCommands: 100,

	/**
	 * Maximum number of events to list in Robo overview
	 */
	maxEvents: 100,

	/**
	 * Maximum number of API routes to list in Robo overview
	 */
	maxApiRoutes: 100,

	/**
	 * Maximum number of Flashcore schemas to list
	 */
	maxFlashcoreSchemas: 50,

	/**
	 * Maximum number of key files to include
	 */
	maxKeyFiles: 20,

	/**
	 * Maximum number of constraints to include
	 */
	maxConstraints: 20,

	/**
	 * Maximum number of decisions to keep in memory
	 */
	maxDecisions: 100,

	/**
	 * Maximum number of changelog entries to keep
	 */
	maxChangeLogEntries: 200
} as const

/**
 * Type for INDEX_CAPS (allows custom values)
 */
export interface IndexCaps {
	maxFiles: number
	maxDirs: number
	largeFileThreshold: number
}

/**
 * Type for OVERVIEW_CAPS (allows custom values)
 */
export interface OverviewCaps {
	maxCommands: number
	maxEvents: number
	maxApiRoutes: number
	maxFlashcoreSchemas: number
	maxKeyFiles: number
	maxConstraints: number
	maxDecisions: number
	maxChangeLogEntries: number
}
