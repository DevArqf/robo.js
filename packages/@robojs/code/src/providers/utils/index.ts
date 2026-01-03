/**
 * Utility exports for @robojs/code providers
 */

// Path utilities
export {
	normalizePath,
	hasTraversalAttempt,
	validatePath,
	matchesDenyPath,
	validatePathWithPolicy,
	isWithinBase,
	joinPath,
	dirname,
	basename
} from './path.js'

// Buffer utilities
export {
	TerminalBuffer,
	TerminalBufferManager,
	createTerminalBuffer,
	DEFAULT_MAX_BUFFER_BYTES,
	type TruncationEvent,
	type TruncationCallback,
	type TerminalBufferConfig,
	type TerminalBufferStats,
	type AggregateBufferStats
} from './buffer.js'
