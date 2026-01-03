/**
 * Flashcore v1 (spec rev 4.3) Relation Types
 *
 * Type definitions for relations, cascade operations, and includes.
 */

import type { OnDeleteAction, RelationType } from '../schema/types.js'

/**
 * Cascade operation collected during delete traversal.
 */
export interface CascadeOp {
	/**
	 * Type of cascade operation.
	 * - 'relation': Regular relation (hasMany, hasOne)
	 * - 'junction': Many-to-many junction table entry
	 */
	type: 'relation' | 'junction'

	/**
	 * Target model name (for 'relation' type).
	 */
	model?: string

	/**
	 * Junction model name (for 'junction' type).
	 */
	junctionModel?: string

	/**
	 * Record ID to operate on.
	 */
	id?: string

	/**
	 * Foreign key field name.
	 */
	foreignKey: string

	/**
	 * Action to take.
	 * - 'cascade': Delete the related record
	 * - 'setNull': Set the FK to null
	 */
	action?: 'cascade' | 'setNull'

	/**
	 * Depth in the cascade tree (0 = direct children).
	 */
	depth: number
}

/**
 * Options for include clause parsing.
 */
export interface IncludeOptions {
	/**
	 * Select specific fields from the related record(s).
	 */
	select?: Record<string, boolean>

	/**
	 * Nested include for related records.
	 */
	include?: IncludeClause

	/**
	 * Filter for related records (hasMany, manyToMany).
	 */
	where?: Record<string, unknown>

	/**
	 * Order for related records (hasMany, manyToMany).
	 */
	orderBy?: Record<string, 'asc' | 'desc'>

	/**
	 * Limit number of related records (hasMany, manyToMany).
	 */
	take?: number

	/**
	 * Skip records (hasMany, manyToMany).
	 */
	skip?: number
}

/**
 * Include clause for loading relations.
 */
export type IncludeClause = Record<string, boolean | IncludeOptions>

/**
 * Parsed include entry with resolved options.
 */
export interface ParsedIncludeEntry {
	/**
	 * Relation field name.
	 */
	field: string

	/**
	 * Relation type.
	 */
	type: RelationType

	/**
	 * Target model name.
	 */
	targetModel: string

	/**
	 * Foreign key field name (undefined for manyToMany).
	 */
	foreignKey?: string

	/**
	 * Include options.
	 */
	options: IncludeOptions
}

/**
 * Junction table schema definition.
 */
export interface JunctionTableDef {
	/**
	 * Junction model name (e.g., '_junction_post_tag').
	 */
	name: string

	/**
	 * First model name (alphabetically).
	 */
	modelA: string

	/**
	 * Second model name.
	 */
	modelB: string

	/**
	 * FK field for modelA (e.g., 'postId').
	 */
	foreignKeyA: string

	/**
	 * FK field for modelB (e.g., 'tagId').
	 */
	foreignKeyB: string
}

/**
 * Relation metadata for a model.
 */
export interface RelationInfo {
	/**
	 * Field name in the schema.
	 */
	field: string

	/**
	 * Relation type.
	 */
	type: RelationType

	/**
	 * Target model name.
	 */
	targetModel: string

	/**
	 * Foreign key field name.
	 */
	foreignKey?: string

	/**
	 * Delete behavior.
	 */
	onDelete: OnDeleteAction
}

/**
 * Result of relation schema validation.
 */
export interface RelationValidationError {
	/**
	 * Model where the error was found.
	 */
	model: string

	/**
	 * Field with the error.
	 */
	field: string

	/**
	 * Error message.
	 */
	message: string

	/**
	 * Suggested fix (if available).
	 */
	suggestion?: string

	/**
	 * Error level: 'error' blocks, 'warning' logs but continues.
	 */
	level?: 'error' | 'warning'
}

/**
 * Context for resolving includes.
 */
export interface IncludeContext {
	/**
	 * Current depth in the include tree.
	 */
	depth: number

	/**
	 * Model registry for looking up related models.
	 */
	getModel: (name: string) => unknown | undefined
}

/**
 * Batched include result for N+1 prevention.
 */
export interface BatchedIncludeResult {
	/**
	 * Map of parent record ID to related record(s).
	 */
	results: Map<string, unknown | unknown[]>

	/**
	 * Field name that was included.
	 */
	field: string
}

/**
 * Connect/disconnect operations for manyToMany.
 */
export interface ManyToManyConnect {
	/**
	 * IDs to connect.
	 */
	connect?: string[]

	/**
	 * IDs to disconnect.
	 */
	disconnect?: string[]

	/**
	 * Set to exactly these IDs (replaces existing).
	 */
	set?: string[]
}

/**
 * Relation field value in create/update data.
 * Supports nested create, connect, and disconnect.
 */
export interface RelationFieldValue {
	/**
	 * Create new related record(s).
	 */
	create?: Record<string, unknown> | Record<string, unknown>[]

	/**
	 * Connect to existing record(s) by ID.
	 */
	connect?: { id: string } | { id: string }[]

	/**
	 * Disconnect from existing record(s).
	 */
	disconnect?: { id: string } | { id: string }[] | true

	/**
	 * Set relations to exactly these IDs (manyToMany only).
	 */
	set?: { id: string }[]
}
