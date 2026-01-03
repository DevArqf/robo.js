/**
 * Terminal and execution result types for @robojs/code SDK
 */

/**
 * Options for running commands
 */
export interface RunOptions {
	cwd?: string
	env?: Record<string, string>
	timeout?: number
	signal?: AbortSignal
}

/**
 * Result from a one-shot command execution
 */
export interface RunResult {
	exitCode: number
	output: string // Always present (combined output)
	stdout?: string // Node-only (separate streams)
	stderr?: string // Node-only (separate streams)
}

/**
 * A chunk of terminal output from streaming commands or sessions
 */
export interface TerminalChunk {
	type: 'output' | 'exit'
	stream?: 'stdout' | 'stderr' | 'combined' // WebContainer typically combined
	text?: string
	exitCode?: number
}

/**
 * Handle to a long-running terminal session
 */
export interface TerminalSessionHandle {
	id: string
	pid?: number
}

/**
 * File stat result for scale-friendly operations
 */
export interface FileStat {
	size: number
	mtimeMs?: number
	isDirectory?: boolean
}

/**
 * Directory entry from readdir operations
 */
export interface DirEntry {
	name: string
	path: string
	isDirectory: boolean
	isFile: boolean
}

/**
 * Options for search operations
 */
export interface SearchOptions {
	path?: string
	glob?: string
	maxResults?: number
	includeContent?: boolean
}

/**
 * Result from a search operation
 */
export interface SearchResult {
	path: string
	matches?: Array<{
		line: number
		column: number
		text: string
	}>
}

/**
 * Options for snapshot operations
 */
export interface SnapshotOptions {
	paths?: string[]
	maxBytes?: number
	excludePatterns?: string[]
}

/**
 * Options for starting a service
 */
export interface ServiceStartOptions {
	port?: number
	env?: Record<string, string>
	cwd?: string
	timeout?: number
}
