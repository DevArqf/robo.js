/**
 * Flashcore v1 (spec rev 4.3) Index Module
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

export { CuckooFilter, type CuckooFilterData, type CuckooFilterOptions } from './filter.js'

export { SortedIndex, type SortedIndexData, type RangeOptions } from './sorted.js'

export {
	IndexPersistenceManager,
	setIndexPersistenceManager,
	getIndexPersistenceManager,
	type IndexPersistenceOptions,
	type EpochData,
	type FlushResult
} from './persistence.js'

export {
	QueryPlanner,
	executeIndexPlan,
	filterMightContain,
	type AvailableIndexes,
	type QueryArgs,
	type WhereInput,
	type OrderByInput,
	type QueryPlan
} from '../query/planner.js'
