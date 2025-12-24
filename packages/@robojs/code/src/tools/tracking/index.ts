/**
 * File tracking module for stale detection
 */

export {
	FileReadTracker,
	checkStaleness,
	type FileReadSnapshot,
	type StaleCheckResult,
	type StaleReason,
	type CurrentFileState
} from './file-tracker.js'
