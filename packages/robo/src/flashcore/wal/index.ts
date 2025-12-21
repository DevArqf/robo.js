/**
 * Flashcore v1 (spec rev 4.3) WAL Module
 *
 * Write-Ahead Logging for crash-safe operations.
 */

// Types
export type {
	WalOp,
	WalPhase,
	WalAuthoritativeDelta,
	WalInverseDelta,
	WalDerivedDelta,
	ChunkPutDelta,
	ChunkPatchDelta,
	ChunkDeleteDelta,
	CatalogSetDelta,
	CatalogDeleteDelta,
	CatalogSetSegmentsDelta,
	UniqueAcquireDelta,
	UniqueReleaseDelta,
	SegmentPutDelta,
	SegmentDeleteDelta,
	FilterAddDelta,
	FilterRemoveDelta,
	IndexUpsertDelta,
	IndexRemoveDelta,
	WalSegmentInfo,
	WALEntry,
	WALEntryHeader,
	WALEntryInput,
	RecoveryResult,
	WALConfig
} from './types.js'

// Manager
export { WriteAheadLog, setWALManager, getWALManager, isWALEnabled } from './manager.js'

// Delta builders
export type { DeltaBuildResult, UniqueChange, UniqueUpdate, SegmentWrite } from './deltas.js'

export {
	buildCreateDeltas,
	buildCreateSegmentedDeltas,
	buildUpdateDeltas,
	buildUpdateSegmentedDeltas,
	buildUpdateChunkToSegmentsDeltas,
	buildUpdateSegmentsToChunkDeltas,
	buildDeleteDeltas,
	buildDeleteSegmentedDeltas,
	computePatch,
	applyPatch
} from './deltas.js'

// Recovery
export type { RecoveryContext } from './recovery.js'

export {
	recoverWAL,
	applyCatalogSetDelta,
	applyCatalogSetSegmentsDelta,
	applyCatalogDeleteDelta,
	replayEntryWithContext,
	rollbackEntryWithContext
} from './recovery.js'
