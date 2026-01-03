/**
 * Flashcore v1 Sorted Index (Phase 6, spec rev 4.3)
 *
 * A B+Tree-based sorted index for range queries and ordered pagination.
 *
 * Key properties:
 * - O(log n) insert/remove/lookup
 * - Efficient range queries (gt, gte, lt, lte)
 * - Stable ordering with secondary sort by id
 * - Null/undefined values are excluded from the index
 * - Serialization for persistence
 */

import { DEFAULT_BTREE_ORDER } from '../core/constants.js'

/**
 * Serialized index data for persistence.
 */
export interface SortedIndexData {
	version: 1
	field: string
	entries: Array<[unknown, string]> // [value, id] pairs in sorted order
}

/**
 * Range query options.
 */
export interface RangeOptions {
	/** Greater than */
	gt?: unknown
	/** Greater than or equal */
	gte?: unknown
	/** Less than */
	lt?: unknown
	/** Less than or equal */
	lte?: unknown
	/** Maximum number of results */
	limit?: number
	/** Order: 'asc' (default) or 'desc' */
	order?: 'asc' | 'desc'
}

/**
 * Internal entry storing value and ID.
 */
interface IndexEntry {
	value: unknown
	id: string
}

/**
 * B+Tree leaf node.
 */
interface LeafNode {
	type: 'leaf'
	entries: IndexEntry[]
	next: LeafNode | null
	prev: LeafNode | null
}

/**
 * B+Tree internal node.
 */
interface InternalNode {
	type: 'internal'
	keys: unknown[] // Separator keys
	children: (InternalNode | LeafNode)[]
}

type BTreeNode = InternalNode | LeafNode

/**
 * SortedIndex implementation using a B+Tree.
 *
 * Provides efficient range queries and ordered iteration.
 * Values are compared using standard JavaScript comparison.
 * Records with the same value are secondarily sorted by id.
 */
export class SortedIndex {
	readonly field: string
	private root: BTreeNode
	private order: number
	private count: number
	private firstLeaf: LeafNode | null
	private lastLeaf: LeafNode | null

	constructor(field: string, options?: { order?: number }) {
		this.field = field
		this.order = options?.order ?? DEFAULT_BTREE_ORDER
		this.count = 0

		// Start with an empty leaf
		const leaf: LeafNode = { type: 'leaf', entries: [], next: null, prev: null }
		this.root = leaf
		this.firstLeaf = leaf
		this.lastLeaf = leaf
	}

	/**
	 * Insert a value-id pair into the index.
	 * Null/undefined values are ignored.
	 */
	insert(value: unknown, id: string): void {
		// Skip null/undefined values
		if (value === null || value === undefined) {
			return
		}

		// Skip non-comparable values (objects, arrays, etc.)
		if (!this.isComparable(value)) {
			return
		}

		const entry: IndexEntry = { value, id }
		this.insertEntry(entry)
		this.count++
	}

	/**
	 * Remove a value-id pair from the index.
	 * Returns true if found and removed.
	 */
	remove(value: unknown, id: string): boolean {
		if (value === null || value === undefined) {
			return false
		}

		const leaf = this.findLeaf(value)
		const index = this.findEntryIndex(leaf.entries, value, id)

		if (index === -1) {
			return false
		}

		leaf.entries.splice(index, 1)
		this.count--

		// Note: For simplicity, we don't rebalance on delete
		// This is acceptable for embedded use; rebuild can fix imbalances

		return true
	}

	/**
	 * Check if a value-id pair exists in the index.
	 */
	has(value: unknown, id: string): boolean {
		if (value === null || value === undefined) {
			return false
		}

		const leaf = this.findLeaf(value)
		return this.findEntryIndex(leaf.entries, value, id) !== -1
	}

	/**
	 * Find all IDs for a specific value.
	 */
	find(value: unknown): string[] {
		if (value === null || value === undefined) {
			return []
		}

		const leaf = this.findLeaf(value)
		const ids: string[] = []

		// Scan forward from the found position
		let currentLeaf: LeafNode | null = leaf
		let started = false

		while (currentLeaf) {
			for (const entry of currentLeaf.entries) {
				const cmp = this.compareValues(entry.value, value)
				if (cmp === 0) {
					ids.push(entry.id)
					started = true
				} else if (started || cmp > 0) {
					// Past the matching entries
					return ids
				}
			}
			currentLeaf = currentLeaf.next
		}

		return ids
	}

	/**
	 * Range query returning IDs matching the criteria.
	 */
	range(options: RangeOptions): string[] {
		const { gt, gte, lt, lte, limit, order = 'asc' } = options
		const ids: string[] = []

		if (order === 'asc') {
			// Forward scan
			const startValue = gte ?? gt
			let leaf: LeafNode | null = startValue !== undefined ? this.findLeaf(startValue) : this.firstLeaf

			while (leaf) {
				for (const entry of leaf.entries) {
					// Check lower bound
					if (gte !== undefined && this.compareValues(entry.value, gte) < 0) continue
					if (gt !== undefined && this.compareValues(entry.value, gt) <= 0) continue

					// Check upper bound
					if (lte !== undefined && this.compareValues(entry.value, lte) > 0) return ids
					if (lt !== undefined && this.compareValues(entry.value, lt) >= 0) return ids

					ids.push(entry.id)

					if (limit !== undefined && ids.length >= limit) {
						return ids
					}
				}
				leaf = leaf.next
			}
		} else {
			// Backward scan
			const startValue = lte ?? lt
			let leaf: LeafNode | null = startValue !== undefined ? this.findLeaf(startValue) : this.lastLeaf

			while (leaf) {
				for (let i = leaf.entries.length - 1; i >= 0; i--) {
					const entry = leaf.entries[i]

					// Check upper bound
					if (lte !== undefined && this.compareValues(entry.value, lte) > 0) continue
					if (lt !== undefined && this.compareValues(entry.value, lt) >= 0) continue

					// Check lower bound
					if (gte !== undefined && this.compareValues(entry.value, gte) < 0) return ids
					if (gt !== undefined && this.compareValues(entry.value, gt) <= 0) return ids

					ids.push(entry.id)

					if (limit !== undefined && ids.length >= limit) {
						return ids
					}
				}
				leaf = leaf.prev
			}
		}

		return ids
	}

	/**
	 * Get all IDs in sorted order.
	 */
	getAll(order: 'asc' | 'desc' = 'asc'): string[] {
		return this.range({ order })
	}

	/**
	 * Get the number of entries in the index.
	 */
	getCount(): number {
		return this.count
	}

	/**
	 * Check if the index is empty.
	 */
	isEmpty(): boolean {
		return this.count === 0
	}

	/**
	 * Clear all entries from the index.
	 */
	clear(): void {
		const leaf: LeafNode = { type: 'leaf', entries: [], next: null, prev: null }
		this.root = leaf
		this.firstLeaf = leaf
		this.lastLeaf = leaf
		this.count = 0
	}

	/**
	 * Serialize the index for persistence.
	 */
	serialize(): SortedIndexData {
		const entries: Array<[unknown, string]> = []

		let leaf = this.firstLeaf
		while (leaf) {
			for (const entry of leaf.entries) {
				entries.push([this.serializeValue(entry.value), entry.id])
			}
			leaf = leaf.next
		}

		return {
			version: 1,
			field: this.field,
			entries
		}
	}

	/**
	 * Deserialize an index from persisted data.
	 */
	static deserialize(data: SortedIndexData): SortedIndex {
		if (data.version !== 1) {
			throw new Error(`Unsupported SortedIndex version: ${data.version}`)
		}

		const index = new SortedIndex(data.field)

		// Bulk insert (entries are already sorted)
		for (const [value, id] of data.entries) {
			const deserializedValue = index.deserializeValue(value)
			index.insert(deserializedValue, id)
		}

		return index
	}

	/**
	 * Create an index from entries (bulk load).
	 * Entries should be an array of { value, id }.
	 */
	static bulkLoad(
		field: string,
		entries: Array<{ value: unknown; id: string }>,
		options?: { order?: number }
	): SortedIndex {
		const index = new SortedIndex(field, options)

		// Sort entries first
		const sortedEntries = entries
			.filter((e) => e.value !== null && e.value !== undefined)
			.sort((a, b) => {
				const cmp = index.compareValues(a.value, b.value)
				if (cmp !== 0) return cmp
				return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
			})

		// Insert in sorted order (more efficient than random inserts)
		for (const entry of sortedEntries) {
			index.insert(entry.value, entry.id)
		}

		return index
	}

	/**
	 * Create an empty index.
	 */
	static empty(field: string, options?: { order?: number }): SortedIndex {
		return new SortedIndex(field, options)
	}

	/**
	 * Estimate memory usage in bytes.
	 */
	estimateMemoryUsage(): number {
		// Rough estimate: each entry uses ~100 bytes (value + id + node overhead)
		return this.count * 100 + 200
	}

	// ========================================================================
	// Private Methods
	// ========================================================================

	/**
	 * Check if a value is comparable (can be sorted).
	 */
	private isComparable(value: unknown): boolean {
		const type = typeof value
		return type === 'string' || type === 'number' || type === 'boolean' || value instanceof Date
	}

	/**
	 * Compare two values for sorting.
	 */
	private compareValues(a: unknown, b: unknown): number {
		// Handle Date comparison
		if (a instanceof Date && b instanceof Date) {
			return a.getTime() - b.getTime()
		}
		if (a instanceof Date) {
			a = a.getTime()
		}
		if (b instanceof Date) {
			b = b.getTime()
		}

		// Standard comparison
		if (a < b) return -1
		if (a > b) return 1
		return 0
	}

	/**
	 * Compare entries (value first, then id for stability).
	 */
	private compareEntries(a: IndexEntry, b: IndexEntry): number {
		const cmp = this.compareValues(a.value, b.value)
		if (cmp !== 0) return cmp
		return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
	}

	/**
	 * Find the leaf node where a value should be.
	 */
	private findLeaf(value: unknown): LeafNode {
		let node: BTreeNode = this.root

		while (node.type === 'internal') {
			let i = 0
			while (i < node.keys.length && this.compareValues(value, node.keys[i]) >= 0) {
				i++
			}
			node = node.children[i]
		}

		return node
	}

	/**
	 * Find the index of an entry in a sorted array.
	 */
	private findEntryIndex(entries: IndexEntry[], value: unknown, id: string): number {
		for (let i = 0; i < entries.length; i++) {
			if (this.compareValues(entries[i].value, value) === 0 && entries[i].id === id) {
				return i
			}
		}
		return -1
	}

	/**
	 * Find insertion position in a sorted array.
	 */
	private findInsertPosition(entries: IndexEntry[], entry: IndexEntry): number {
		let low = 0
		let high = entries.length

		while (low < high) {
			const mid = (low + high) >>> 1
			if (this.compareEntries(entries[mid], entry) < 0) {
				low = mid + 1
			} else {
				high = mid
			}
		}

		return low
	}

	/**
	 * Insert an entry into the tree.
	 */
	private insertEntry(entry: IndexEntry): void {
		const leaf = this.findLeaf(entry.value)
		const pos = this.findInsertPosition(leaf.entries, entry)

		// Check for duplicate
		if (pos < leaf.entries.length) {
			const existing = leaf.entries[pos]
			if (this.compareValues(existing.value, entry.value) === 0 && existing.id === entry.id) {
				// Already exists
				this.count-- // Will be incremented by caller
				return
			}
		}

		leaf.entries.splice(pos, 0, entry)

		// Split if necessary
		if (leaf.entries.length > this.order) {
			this.splitLeaf(leaf)
		}
	}

	/**
	 * Split a leaf node.
	 */
	private splitLeaf(leaf: LeafNode): void {
		const mid = Math.floor(leaf.entries.length / 2)
		const newLeaf: LeafNode = {
			type: 'leaf',
			entries: leaf.entries.splice(mid),
			next: leaf.next,
			prev: leaf
		}

		if (leaf.next) {
			leaf.next.prev = newLeaf
		}
		leaf.next = newLeaf

		if (this.lastLeaf === leaf) {
			this.lastLeaf = newLeaf
		}

		// Promote the first key of the new leaf to the parent
		const promotedKey = newLeaf.entries[0].value

		if (this.root === leaf) {
			// Create new root
			const newRoot: InternalNode = {
				type: 'internal',
				keys: [promotedKey],
				children: [leaf, newLeaf]
			}
			this.root = newRoot
		} else {
			this.insertIntoParent(leaf, promotedKey, newLeaf)
		}
	}

	/**
	 * Insert a key into the parent node after a split.
	 */
	private insertIntoParent(leftChild: BTreeNode, key: unknown, rightChild: BTreeNode): void {
		// Find the parent
		const parent = this.findParent(this.root, leftChild)
		if (!parent || parent.type !== 'internal') {
			return
		}

		// Find position to insert
		let pos = 0
		while (pos < parent.keys.length && this.compareValues(key, parent.keys[pos]) >= 0) {
			pos++
		}

		parent.keys.splice(pos, 0, key)
		parent.children.splice(pos + 1, 0, rightChild)

		// Split parent if necessary
		if (parent.keys.length >= this.order) {
			this.splitInternal(parent)
		}
	}

	/**
	 * Split an internal node.
	 */
	private splitInternal(node: InternalNode): void {
		const mid = Math.floor(node.keys.length / 2)
		const promotedKey = node.keys[mid]

		const newNode: InternalNode = {
			type: 'internal',
			keys: node.keys.splice(mid + 1),
			children: node.children.splice(mid + 1)
		}

		node.keys.splice(mid, 1) // Remove promoted key

		if (this.root === node) {
			const newRoot: InternalNode = {
				type: 'internal',
				keys: [promotedKey],
				children: [node, newNode]
			}
			this.root = newRoot
		} else {
			this.insertIntoParent(node, promotedKey, newNode)
		}
	}

	/**
	 * Find the parent of a node.
	 */
	private findParent(current: BTreeNode, target: BTreeNode): InternalNode | null {
		if (current.type === 'leaf') {
			return null
		}

		for (const child of current.children) {
			if (child === target) {
				return current
			}
			if (child.type === 'internal') {
				const result = this.findParent(child, target)
				if (result) return result
			}
		}

		return null
	}

	/**
	 * Serialize a value for persistence.
	 */
	private serializeValue(value: unknown): unknown {
		if (value instanceof Date) {
			return { __type: 'Date', value: value.toISOString() }
		}
		return value
	}

	/**
	 * Deserialize a value from persistence.
	 */
	private deserializeValue(value: unknown): unknown {
		if (
			value &&
			typeof value === 'object' &&
			'__type' in value &&
			(value as { __type: string }).__type === 'Date' &&
			'value' in value
		) {
			return new Date((value as unknown as { value: string }).value)
		}
		return value
	}
}
