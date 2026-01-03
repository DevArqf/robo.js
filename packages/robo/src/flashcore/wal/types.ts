/**
 * Flashcore v1 (spec rev 4.3) WAL Types
 *
 * Type definitions for Write-Ahead Logging (WAL) system.
 * WAL provides crash-safe single-operation mutations by recording
 * intent before writing data.
 *
 * See spec §9.4 for full WAL specification.
 */

/**
 * WAL operation type.
 */
export type WalOp = 'create' | 'update' | 'delete'

/**
 * WAL phase markers for tracking operation progress.
 *
 * - 'pending': WAL entry written, no data changes yet
 * - 'authoritative': Chunk/catalog/unique writes completed
 * - 'derived': Filter/index updates completed (placeholder for Phase 6)
 * - 'complete': Operation fully done, WAL can be cleaned up
 */
export type WalPhase = 'pending' | 'authoritative' | 'derived' | 'complete'

// ─────────────────────────────────────────────────────────────
// Authoritative Deltas (must be correct, source of truth)
// ─────────────────────────────────────────────────────────────

/**
 * Put a full record into a chunk (create / upsert).
 */
export interface ChunkPutDelta {
	t: 'chunk_put'
	chunkId: string
	id: string
	record: unknown
}

/**
 * Apply a partial patch to a record in a chunk (update).
 */
export interface ChunkPatchDelta {
	t: 'chunk_patch'
	chunkId: string
	id: string
	patch: Record<string, unknown>
}

/**
 * Delete a record from a chunk.
 */
export interface ChunkDeleteDelta {
	t: 'chunk_delete'
	chunkId: string
	id: string
}

/**
 * Set catalog mapping: id → chunkId.
 */
export interface CatalogSetDelta {
	t: 'catalog_set'
	id: string
	chunkId: number
}

/**
 * Delete catalog mapping for an id.
 */
export interface CatalogDeleteDelta {
	t: 'catalog_delete'
	id: string
}

/**
 * Acquire a unique constraint key.
 */
export interface UniqueAcquireDelta {
	t: 'unique_acquire'
	key: string
	id: string
}

/**
 * Release a unique constraint key.
 */
export interface UniqueReleaseDelta {
	t: 'unique_release'
	key: string
	id: string
}

// ─────────────────────────────────────────────────────────────
// Segment Deltas (Phase 5: Large record segmentation)
// ─────────────────────────────────────────────────────────────

/**
 * Put a segment for a large record.
 */
export interface SegmentPutDelta {
	t: 'seg_put'
	/**
	 * Full segment key (e.g., _model:User:seg:abc123:0).
	 */
	segmentKey: string
	/**
	 * Record ID this segment belongs to.
	 */
	id: string
	/**
	 * Segment index (0-based).
	 */
	index: number
	/**
	 * Segment data (string chunk of serialized record).
	 */
	data: string
}

/**
 * Delete a segment for a large record.
 */
export interface SegmentDeleteDelta {
	t: 'seg_delete'
	/**
	 * Full segment key.
	 */
	segmentKey: string
	/**
	 * Record ID this segment belongs to.
	 */
	id: string
	/**
	 * Segment index.
	 */
	index: number
}

/**
 * Set catalog mapping for a segmented record: id → segmentIds[].
 */
export interface CatalogSetSegmentsDelta {
	t: 'catalog_set_segments'
	id: string
	segmentIds: string[]
}

/**
 * Union of all authoritative delta types.
 * These are the "source of truth" operations.
 */
export type WalAuthoritativeDelta =
	| ChunkPutDelta
	| ChunkPatchDelta
	| ChunkDeleteDelta
	| CatalogSetDelta
	| CatalogDeleteDelta
	| CatalogSetSegmentsDelta
	| UniqueAcquireDelta
	| UniqueReleaseDelta
	| SegmentPutDelta
	| SegmentDeleteDelta

/**
 * Inverse deltas use the same types (for rollback).
 * The semantic meaning differs:
 * - chunk_put in undo means "restore this record"
 * - chunk_delete in undo means "remove this record"
 */
export type WalInverseDelta = WalAuthoritativeDelta

// ─────────────────────────────────────────────────────────────
// Derived Deltas (best-effort, can be rebuilt from authoritative)
// ─────────────────────────────────────────────────────────────

/**
 * Add an ID to the Cuckoo filter.
 */
export interface FilterAddDelta {
	t: 'filter_add'
	id: string
}

/**
 * Remove an ID from the Cuckoo filter.
 */
export interface FilterRemoveDelta {
	t: 'filter_remove'
	id: string
}

/**
 * Upsert a value into a sorted index.
 */
export interface IndexUpsertDelta {
	t: 'index_upsert'
	indexKey: string
	id: string
	value: unknown
}

/**
 * Remove a value from a sorted index.
 */
export interface IndexRemoveDelta {
	t: 'index_remove'
	indexKey: string
	id: string
	value: unknown
}

/**
 * Union of all derived delta types.
 * These are optimizations that can be rebuilt from chunks.
 */
export type WalDerivedDelta = FilterAddDelta | FilterRemoveDelta | IndexUpsertDelta | IndexRemoveDelta

// ─────────────────────────────────────────────────────────────
// WAL Entry
// ─────────────────────────────────────────────────────────────

/**
 * Segmentation info for large WAL entries.
 * When an entry exceeds maxValueSize, deltas are split across
 * multiple segment keys: _flashcore:wal:seg:{id}:{n}
 */
export interface WalSegmentInfo {
	/**
	 * Number of segment parts.
	 */
	parts: number

	/**
	 * Size of each part in bytes (approximate).
	 */
	partSize: number
}

/**
 * Complete WAL entry structure.
 *
 * Stored at: _flashcore:wal:entry:{id}
 * Optional segments at: _flashcore:wal:seg:{id}:{n}
 */
export interface WALEntry {
	/**
	 * Unique entry ID (generated).
	 */
	id: string

	/**
	 * Timestamp when entry was created (Date.now()).
	 */
	timestamp: number

	/**
	 * Model namespace (optional).
	 */
	namespace?: string

	/**
	 * Model name.
	 */
	model: string

	/**
	 * Operation type.
	 */
	op: WalOp

	/**
	 * Authoritative deltas (applied first).
	 * These are the "source of truth" changes.
	 */
	auth: WalAuthoritativeDelta[]

	/**
	 * Inverse deltas (only for rollback paths).
	 * Used to undo the operation if recovery decides to roll back.
	 */
	undo: WalInverseDelta[]

	/**
	 * Derived deltas (applied after authoritative).
	 * Best-effort; can be skipped in favor of rebuild.
	 */
	derived: WalDerivedDelta[]

	/**
	 * Current phase of the operation.
	 */
	phase: WalPhase

	/**
	 * Optional segmentation info for large entries.
	 * If present, deltas are stored across segment keys.
	 */
	segmented?: WalSegmentInfo
}

/**
 * WAL entry header (stored when segmented).
 * Contains metadata but not the full deltas.
 */
export interface WALEntryHeader {
	id: string
	timestamp: number
	namespace?: string
	model: string
	op: WalOp
	phase: WalPhase
	segmented: WalSegmentInfo
}

/**
 * Input for beginning a new WAL entry.
 * ID and timestamp are generated by the WAL manager.
 */
export type WALEntryInput = Omit<WALEntry, 'id' | 'timestamp' | 'phase'>

// ─────────────────────────────────────────────────────────────
// Recovery Types
// ─────────────────────────────────────────────────────────────

/**
 * Result of WAL recovery.
 */
export interface RecoveryResult {
	/**
	 * Total number of orphaned WAL entries found.
	 */
	found: number

	/**
	 * Number of entries replayed (forward recovery).
	 */
	replayed: number

	/**
	 * Number of entries rolled back.
	 */
	rolledBack: number

	/**
	 * Any errors encountered during recovery.
	 */
	errors: Error[]
}

/**
 * WAL configuration options.
 */
export interface WALConfig {
	/**
	 * Threshold in milliseconds for considering an entry "stale".
	 * Stale pending entries are rolled back instead of replayed.
	 * Default: 5 minutes (300000ms)
	 */
	staleThresholdMs?: number

	/**
	 * Clock skew tolerance in milliseconds.
	 * Entries with timestamps slightly in the future are still valid.
	 * Default: 5 seconds (5000ms)
	 */
	clockSkewToleranceMs?: number

	/**
	 * Maximum size for a single WAL entry value before segmentation.
	 * Default: 100KB or adapter.maxValueSize * 0.8
	 */
	maxEntrySize?: number
}
