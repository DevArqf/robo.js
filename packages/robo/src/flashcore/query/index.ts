/**
 * Flashcore v1 (spec rev 4.3) Query Module
 *
 * Query evaluation and sorting utilities.
 */

export { evaluateWhere } from './evaluate.js'
export { sortRecords } from './order.js'
export {
	QueryPlanner,
	executeIndexPlan,
	filterMightContain,
	type QueryPlan,
	type QueryArgs,
	type AvailableIndexes,
	type WhereInput,
	type OrderByInput
} from './planner.js'
