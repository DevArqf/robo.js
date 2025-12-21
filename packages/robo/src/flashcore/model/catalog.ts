/**
 * Flashcore v4.3 Catalog
 *
 * Authoritative mapping from record ID to chunk location.
 * The catalog is the source of truth for record existence.
 */

import type { CatalogData } from '../schema/types.js'

/**
 * Version number for catalog format.
 */
export const CATALOG_VERSION = 1

/**
 * Catalog entry for a single record.
 */
export interface CatalogEntry {
	id: string
	kind: 'chunk' | 'segments'
	chunkId?: number
	segmentIds?: string[]
}

/**
 * Chunk statistics.
 */
export interface ChunkStats {
	count: number
}

/**
 * Catalog class for managing ID -> chunk mappings.
 *
 * The catalog is authoritative:
 * - If a record is in the catalog, it exists
 * - If a record is not in the catalog, it doesn't exist
 * - Derived structures (filter, indexes) are rebuilt from catalog + chunks
 */
export class Catalog {
	/**
	 * Mapping from record ID to chunk ID.
	 * For Phase 1, all records use 'chunk' kind.
	 */
	private entries = new Map<string, CatalogEntry>()

	/**
	 * Stats for each chunk (record count).
	 */
	private chunkStats = new Map<number, ChunkStats>()

	/**
	 * Get the chunk ID for a record.
	 *
	 * @param id - Record ID
	 * @returns Chunk ID or null if not found
	 */
	getChunkFor(id: string): number | null {
		const entry = this.entries.get(id)
		if (!entry || entry.kind !== 'chunk') {
			return null
		}
		return entry.chunkId ?? null
	}

	/**
	 * Get the full entry for a record.
	 *
	 * @param id - Record ID
	 * @returns Catalog entry or undefined
	 */
	getEntry(id: string): CatalogEntry | undefined {
		return this.entries.get(id)
	}

	/**
	 * Check if a record exists in the catalog.
	 *
	 * @param id - Record ID
	 * @returns True if exists
	 */
	has(id: string): boolean {
		return this.entries.has(id)
	}

	/**
	 * Add a record to the catalog.
	 *
	 * @param id - Record ID
	 * @param chunkId - Chunk where record is stored
	 */
	addEntry(id: string, chunkId: number): void {
		// Remove from old chunk if exists
		const existing = this.entries.get(id)
		if (existing && existing.kind === 'chunk' && existing.chunkId !== undefined) {
			const oldStats = this.chunkStats.get(existing.chunkId)
			if (oldStats && oldStats.count > 0) {
				oldStats.count--
			}
		}

		// Add to new location
		this.entries.set(id, {
			id,
			kind: 'chunk',
			chunkId
		})

		// Update chunk stats
		let stats = this.chunkStats.get(chunkId)
		if (!stats) {
			stats = { count: 0 }
			this.chunkStats.set(chunkId, stats)
		}
		stats.count++
	}

	/**
	 * Remove a record from the catalog.
	 *
	 * @param id - Record ID
	 * @returns True if removed
	 */
	removeEntry(id: string): boolean {
		const entry = this.entries.get(id)
		if (!entry) {
			return false
		}

		// Update chunk stats
		if (entry.kind === 'chunk' && entry.chunkId !== undefined) {
			const stats = this.chunkStats.get(entry.chunkId)
			if (stats && stats.count > 0) {
				stats.count--
			}
		}

		return this.entries.delete(id)
	}

	/**
	 * Get all chunk IDs that contain records.
	 *
	 * @returns Array of chunk IDs
	 */
	getChunkIds(): number[] {
		const ids = new Set<number>()
		for (const entry of this.entries.values()) {
			if (entry.kind === 'chunk' && entry.chunkId !== undefined) {
				ids.add(entry.chunkId)
			}
		}
		return Array.from(ids).sort((a, b) => a - b)
	}

	/**
	 * Get the total count of records.
	 *
	 * @returns Record count
	 */
	getCount(): number {
		return this.entries.size
	}

	/**
	 * Get all record IDs in the catalog.
	 *
	 * @returns Array of all record IDs
	 */
	getAllIds(): string[] {
		return Array.from(this.entries.keys())
	}

	/**
	 * Get the count of records in a specific chunk.
	 *
	 * @param chunkId - Chunk ID
	 * @returns Record count in chunk
	 */
	getChunkCount(chunkId: number): number {
		return this.chunkStats.get(chunkId)?.count ?? 0
	}

	/**
	 * Get sample IDs for verification purposes.
	 *
	 * @param n - Number of samples
	 * @returns Array of sample IDs
	 */
	getSampleIds(n: number): string[] {
		const ids = Array.from(this.entries.keys())
		if (ids.length <= n) {
			return ids
		}

		// Random sample
		const sample: string[] = []
		const used = new Set<number>()
		while (sample.length < n && sample.length < ids.length) {
			const idx = Math.floor(Math.random() * ids.length)
			if (!used.has(idx)) {
				used.add(idx)
				sample.push(ids[idx])
			}
		}
		return sample
	}

	/**
	 * Get all record IDs.
	 *
	 * @returns Iterator of record IDs
	 */
	*ids(): IterableIterator<string> {
		for (const id of this.entries.keys()) {
			yield id
		}
	}

	/**
	 * Iterate over all entries.
	 */
	*[Symbol.iterator](): IterableIterator<CatalogEntry> {
		for (const entry of this.entries.values()) {
			yield entry
		}
	}

	/**
	 * Clear all entries.
	 */
	clear(): void {
		this.entries.clear()
		this.chunkStats.clear()
	}

	/**
	 * Serialize catalog for storage.
	 *
	 * @returns Serialized catalog data
	 */
	serialize(): CatalogData {
		const entries: Array<{ id: string; chunkId: number }> = []

		for (const entry of this.entries.values()) {
			if (entry.kind === 'chunk' && entry.chunkId !== undefined) {
				entries.push({ id: entry.id, chunkId: entry.chunkId })
			}
		}

		const chunkStats: Array<{ chunkId: number; count: number }> = []
		for (const [chunkId, stats] of this.chunkStats) {
			chunkStats.push({ chunkId, count: stats.count })
		}

		return {
			version: CATALOG_VERSION,
			entries,
			chunkStats,
			count: this.entries.size
		}
	}

	/**
	 * Deserialize catalog from storage.
	 *
	 * @param data - Stored catalog data
	 * @returns Catalog instance
	 */
	static deserialize(data: CatalogData): Catalog {
		const catalog = new Catalog()

		// Validate version
		if (data.version !== CATALOG_VERSION) {
			// Future: handle migrations between versions
			console.warn(`Catalog version mismatch: expected ${CATALOG_VERSION}, got ${data.version}`)
		}

		// Restore entries
		for (const entry of data.entries) {
			catalog.entries.set(entry.id, {
				id: entry.id,
				kind: 'chunk',
				chunkId: entry.chunkId
			})
		}

		// Restore chunk stats
		for (const stat of data.chunkStats) {
			catalog.chunkStats.set(stat.chunkId, { count: stat.count })
		}

		return catalog
	}

	/**
	 * Create an empty catalog.
	 *
	 * @returns New empty catalog
	 */
	static empty(): Catalog {
		return new Catalog()
	}
}
