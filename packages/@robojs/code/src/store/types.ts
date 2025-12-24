/**
 * Run store types for @robojs/code SDK
 *
 * The RunStore is optional but enables "come back later" functionality
 * for listing and loading previous runs.
 */

import type { RunMeta, RunFilter } from '../types/run.js'

/**
 * Run store interface for persisting run metadata.
 *
 * For "come back later" functionality, you need:
 * - A durable checkpointer (for LangGraph state)
 * - A durable run store (for listing and loading runs)
 *
 * This is optional in v1 - runs work without persistence but
 * cannot be resumed after page reload.
 */
export interface RunStore {
	/**
	 * List runs with optional filtering
	 */
	listRuns(filter?: RunFilter): Promise<RunMeta[]>

	/**
	 * Get a specific run by ID
	 */
	getRun(runId: string): Promise<RunMeta | null>

	/**
	 * Save or update run metadata
	 */
	saveRun(meta: RunMeta): Promise<void>

	/**
	 * Delete a run
	 */
	deleteRun(runId: string): Promise<void>
}

/**
 * In-memory run store configuration
 */
export interface MemoryRunStoreConfig {
	/**
	 * Maximum number of runs to keep
	 */
	maxRuns?: number
}

/**
 * Durable run store configuration
 */
export interface DurableRunStoreConfig {
	/**
	 * Storage backend type
	 */
	type: 'redis' | 'postgres' | 'custom'

	/**
	 * Connection string or configuration
	 */
	connection: string | Record<string, unknown>

	/**
	 * Key prefix for namespacing
	 */
	keyPrefix?: string

	/**
	 * TTL for runs in seconds (0 = no expiry)
	 */
	ttlSeconds?: number

	/**
	 * Tenant ID for multi-tenant deployments
	 */
	tenantId?: string

	/**
	 * User ID for user-scoped runs
	 */
	userId?: string

	/**
	 * Project ID for project-scoped runs
	 */
	projectId?: string
}

/**
 * Suggested storage keys for durable run stores:
 * (tenantId, userId, projectId, runId)
 *
 * This enables:
 * - Multi-tenant isolation
 * - Per-user run lists
 * - Per-project run context
 */
export interface RunStoreKey {
	tenantId?: string
	userId?: string
	projectId?: string
	runId: string
}
