/**
 * Flashcore v4.3 Index Module
 *
 * Index structures for query acceleration.
 */

export {
	UniqueIndexManager,
	acquireUniqueConstraints,
	releaseUniqueConstraints,
	type UniqueIndexEntry,
	type UniqueConstraintOptions
} from './unique.js'
