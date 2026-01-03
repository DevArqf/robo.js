/**
 * Scale primitives for @robojs/code SDK
 *
 * ProjectIndex and ProjectOverview enable reliable operation on larger
 * repositories by providing targeted retrieval instead of giant snapshots.
 */

import type { RoboProjectKind } from './robo.js'

/**
 * Robo-specific signals in the project index
 */
export interface RoboIndexSignals {
	/**
	 * Detected project kind
	 */
	kind: RoboProjectKind

	/**
	 * Installed plugins
	 */
	plugins: string[]

	/**
	 * Path to commands directory (if exists)
	 */
	commandsDir?: string

	/**
	 * Path to events directory (if exists)
	 */
	eventsDir?: string

	/**
	 * Path to API routes directory (if exists)
	 */
	apiDir?: string

	/**
	 * Path to Flashcore schemas directory (if exists)
	 */
	flashcoreDir?: string

	/**
	 * Whether @robojs/mock is available
	 */
	hasMock: boolean
}

/**
 * Lightweight project index for retrieval and drift detection.
 *
 * Computed quickly at run start and refreshed when fingerprint changes.
 */
export interface ProjectIndex {
	/**
	 * When the index was last updated
	 */
	updatedAt: string

	/**
	 * Project root path
	 */
	root: string

	/**
	 * Content-based fingerprint for drift detection
	 */
	fingerprint: string

	/**
	 * All files in the project (with sizes for scale decisions)
	 */
	files: Array<{
		path: string
		size: number
	}>

	/**
	 * Directories in the project
	 */
	dirs: Array<{
		path: string
	}>

	/**
	 * Robo-specific signals (if detected as Robo project)
	 */
	robo?: RoboIndexSignals
}

/**
 * Package information from package.json
 */
export interface PackageInfo {
	name?: string
	version?: string
	scripts?: Record<string, string>
	dependencies?: string[]
	devDependencies?: string[]
}

/**
 * Robo-specific overview details
 */
export interface RoboOverview {
	/**
	 * Detected project kind
	 */
	kind: RoboProjectKind

	/**
	 * Installed plugins
	 */
	plugins: string[]

	/**
	 * Discovered commands
	 */
	commands?: string[]

	/**
	 * Discovered event handlers
	 */
	events?: string[]

	/**
	 * Discovered API routes
	 */
	apiRoutes?: string[]

	/**
	 * Discovered Flashcore schemas
	 */
	flashcoreSchemas?: string[]

	/**
	 * Mock server availability
	 */
	mock?: {
		supported: boolean
	}
}

/**
 * Key file with rationale for why it's important
 */
export interface KeyFile {
	path: string
	why: string
}

/**
 * A decision made during the run
 */
export interface Decision {
	when: string
	topic: string
	decision: string
}

/**
 * A change log entry
 */
export interface ChangeLogEntry {
	when: string
	summary: string
	files: string[]
}

/**
 * Structured project overview ("mental model") grounded in real artifacts.
 *
 * Includes durable agent-maintained memory (decisions, changelog) that
 * persists separately from chat context.
 *
 * Update rules:
 * - Refresh at run start (light)
 * - Refresh after apply_changes
 * - Refresh after verification
 * - Allow explicit refresh (for user edits outside agent)
 */
export interface ProjectOverview {
	/**
	 * When the overview was last updated
	 */
	updatedAt: string

	/**
	 * Project root path
	 */
	root: string

	/**
	 * Brief summary of the project
	 */
	summary: string

	/**
	 * Package.json information
	 */
	package: PackageInfo

	/**
	 * Robo-specific details (if Robo project)
	 */
	robo?: RoboOverview

	/**
	 * Key files with rationale
	 */
	keyFiles: KeyFile[]

	/**
	 * Project constraints and conventions
	 */
	constraints: string[]

	/**
	 * Decisions made during the run (agent-maintained memory)
	 */
	decisions: Decision[]

	/**
	 * Change log (agent-maintained memory)
	 */
	changeLog: ChangeLogEntry[]
}

/**
 * Options for refreshing project index/overview
 */
export interface RefreshOptions {
	/**
	 * Whether to do a deep refresh (re-scan all files)
	 */
	deep?: boolean

	/**
	 * Force refresh even if fingerprint hasn't changed
	 */
	force?: boolean
}
