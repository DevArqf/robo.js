/**
 * File change and diff types for @robojs/code SDK
 *
 * These types support the UI-friendly diff and approval workflow.
 */

/**
 * A file change operation for atomic application
 */
export type FileChange =
	| { path: string; type: 'create'; content: string }
	| { path: string; type: 'modify'; content: string }
	| { path: string; type: 'delete' }

/**
 * Per-file diff for UI display and approval
 */
export interface FileDiff {
	/**
	 * File path relative to project root
	 */
	path: string

	/**
	 * Type of change
	 */
	type: 'create' | 'modify' | 'delete'

	/**
	 * Unified diff string for display
	 * May be omitted for large files or binary content
	 */
	unifiedDiff?: string

	/**
	 * Original file size in bytes (for modify/delete)
	 */
	oldSize?: number

	/**
	 * New file size in bytes (for create/modify)
	 */
	newSize?: number

	/**
	 * Whether the diff was truncated due to size limits
	 */
	truncated?: boolean

	/**
	 * Number of lines added
	 */
	additions?: number

	/**
	 * Number of lines removed
	 */
	deletions?: number
}

/**
 * A set of changes with associated diffs for approval
 */
export interface ChangeSet {
	/**
	 * Unique identifier for this change set
	 */
	id: string

	/**
	 * The file changes to apply
	 */
	changes: FileChange[]

	/**
	 * Per-file diffs for UI display
	 */
	diffs: FileDiff[]

	/**
	 * Human-readable summary of the changes
	 */
	summary?: string

	/**
	 * Reason for the changes
	 */
	reason?: string

	/**
	 * Whether this change set is currently pending approval
	 */
	pending: boolean

	/**
	 * Whether this change set has been applied
	 */
	applied: boolean

	/**
	 * Timestamp when the change set was created
	 */
	createdAt: string

	/**
	 * Timestamp when the change set was applied (if applied)
	 */
	appliedAt?: string
}

/**
 * Options for generating diffs
 */
export interface DiffOptions {
	/**
	 * Maximum bytes for the unified diff output
	 */
	maxDiffBytes?: number

	/**
	 * Number of context lines around changes
	 */
	contextLines?: number

	/**
	 * Whether to include line numbers
	 */
	includeLineNumbers?: boolean
}

/**
 * Proposed changes from a remote MCP tool
 * Remote tools cannot directly modify WebContainer FS
 */
export interface ProposedChanges {
	changes: Array<{
		path: string
		type: 'create' | 'modify' | 'delete'
		content?: string
	}>
	notes?: string
}
