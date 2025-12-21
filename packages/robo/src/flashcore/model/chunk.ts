/**
 * Flashcore v4.3 Chunk Manager
 *
 * Manages chunk storage for model records.
 * Chunks are the storage units where records are physically stored.
 */

import type { FlashcoreAdapter } from '../adapter/types.js'
import { buildModelKey } from '../core/keys.js'
import { DataCorruptionError } from '../core/errors.js'
import type { ChunkData } from '../schema/types.js'
import type { Catalog } from './catalog.js'

/**
 * Default number of records per chunk.
 * This is a simple fixed-size strategy for Phase 1.
 */
export const DEFAULT_RECORDS_PER_CHUNK = 50

/**
 * Chunk manager for a single model.
 *
 * Handles loading, saving, and assigning chunks.
 */
export class ChunkManager {
	private adapter: FlashcoreAdapter
	private modelName: string
	private namespace?: string
	private recordsPerChunk: number

	/**
	 * In-memory cache of loaded chunks.
	 * Simple cache with no eviction for Phase 1.
	 */
	private cache = new Map<number, ChunkData>()

	constructor(options: {
		adapter: FlashcoreAdapter
		modelName: string
		namespace?: string
		recordsPerChunk?: number
	}) {
		this.adapter = options.adapter
		this.modelName = options.modelName
		this.namespace = options.namespace
		this.recordsPerChunk = options.recordsPerChunk ?? DEFAULT_RECORDS_PER_CHUNK
	}

	/**
	 * Build the storage key for a chunk.
	 */
	private buildChunkKey(chunkId: number): string {
		return buildModelKey(this.modelName, `chunk:${chunkId}`, this.namespace)
	}

	/**
	 * Load a chunk from storage.
	 *
	 * @param chunkId - Chunk ID to load
	 * @returns Chunk data or empty object if not found
	 */
	async loadChunk(chunkId: number): Promise<ChunkData> {
		// Check cache first
		const cached = this.cache.get(chunkId)
		if (cached) {
			return cached
		}

		const key = this.buildChunkKey(chunkId)
		const data = await this.adapter.get(key)

		if (data === undefined || data === null) {
			// Empty chunk
			const empty: ChunkData = {}
			this.cache.set(chunkId, empty)
			return empty
		}

		// Validate chunk data is an object
		if (typeof data !== 'object' || Array.isArray(data)) {
			throw new DataCorruptionError(
				`Chunk ${chunkId} for model "${this.modelName}" is corrupted. ` +
				`Expected object, got ${Array.isArray(data) ? 'array' : typeof data}. ` +
				`Run 'robo db repair' to rebuild from catalog.`,
				{
					model: this.modelName,
					structure: 'chunk',
					repairGuidance: `Run 'robo db repair --model=${this.modelName}'`
				}
			)
		}

		// Cast and cache
		const chunk = data as ChunkData
		this.cache.set(chunkId, chunk)
		return chunk
	}

	/**
	 * Save a chunk to storage.
	 *
	 * @param chunkId - Chunk ID
	 * @param data - Chunk data
	 */
	async saveChunk(chunkId: number, data: ChunkData): Promise<void> {
		const key = this.buildChunkKey(chunkId)
		await this.adapter.set(key, data)

		// Update cache
		this.cache.set(chunkId, data)
	}

	/**
	 * Delete a chunk from storage.
	 *
	 * @param chunkId - Chunk ID to delete
	 */
	async deleteChunk(chunkId: number): Promise<void> {
		const key = this.buildChunkKey(chunkId)
		await this.adapter.delete(key)

		// Remove from cache
		this.cache.delete(chunkId)
	}

	/**
	 * Select a chunk for inserting a new record.
	 *
	 * Strategy for Phase 1: Find first chunk with room, or create new.
	 *
	 * @param catalog - Current catalog
	 * @returns Chunk ID to use
	 */
	selectChunkForInsert(catalog: Catalog): number {
		const chunkIds = catalog.getChunkIds()

		// Find first chunk with room
		for (const chunkId of chunkIds) {
			const count = catalog.getChunkCount(chunkId)
			if (count < this.recordsPerChunk) {
				return chunkId
			}
		}

		// All chunks full, create new one
		if (chunkIds.length === 0) {
			return 0
		}

		return Math.max(...chunkIds) + 1
	}

	/**
	 * Get a record from a chunk.
	 *
	 * @param chunkId - Chunk ID
	 * @param recordId - Record ID
	 * @returns Record or undefined
	 */
	async getRecord(chunkId: number, recordId: string): Promise<unknown | undefined> {
		const chunk = await this.loadChunk(chunkId)
		return chunk[recordId]
	}

	/**
	 * Set a record in a chunk.
	 *
	 * @param chunkId - Chunk ID
	 * @param recordId - Record ID
	 * @param record - Record data
	 */
	async setRecord(chunkId: number, recordId: string, record: unknown): Promise<void> {
		const chunk = await this.loadChunk(chunkId)
		chunk[recordId] = record
		await this.saveChunk(chunkId, chunk)
	}

	/**
	 * Delete a record from a chunk.
	 *
	 * @param chunkId - Chunk ID
	 * @param recordId - Record ID
	 * @returns True if record existed
	 */
	async deleteRecord(chunkId: number, recordId: string): Promise<boolean> {
		const chunk = await this.loadChunk(chunkId)
		if (!(recordId in chunk)) {
			return false
		}
		delete chunk[recordId]
		await this.saveChunk(chunkId, chunk)
		return true
	}

	/**
	 * Clear the chunk cache.
	 */
	clearCache(): void {
		this.cache.clear()
	}

	/**
	 * Invalidate a specific chunk from cache.
	 *
	 * @param chunkId - Chunk ID to invalidate
	 */
	invalidateChunk(chunkId: number): void {
		this.cache.delete(chunkId)
	}
}

/**
 * Create a chunk manager for a model.
 */
export function createChunkManager(options: {
	adapter: FlashcoreAdapter
	modelName: string
	namespace?: string
	recordsPerChunk?: number
}): ChunkManager {
	return new ChunkManager(options)
}
