/**
 * Flashcore v4.3 Legacy File Adapter
 *
 * Wraps the existing .robo/data hashed-file storage for backward compatibility.
 * Uses SHA256 hashing for filenames, which means keys are NOT enumerable.
 *
 * This adapter is used to maintain access to existing Robo.js Flashcore data
 * after upgrading to v4.
 */

import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import zlib from 'node:zlib'
import type { FlashcoreAdapter } from '../types.js'

export interface LegacyFileAdapterOptions {
	/**
	 * Directory for data storage.
	 * Default: `${process.cwd()}/.robo/data`
	 */
	dataDir?: string
}

/**
 * Legacy file adapter for backward compatibility with existing .robo/data stores.
 *
 * Key characteristics:
 * - Filenames are SHA256 hashes of keys (not reversible)
 * - Values are gzip-compressed JSON
 * - No scan capability (keys are not enumerable)
 * - Fixes the `has()` truthiness bug from the original implementation
 *
 * Use this adapter to preserve access to existing Flashcore data.
 * For new projects, consider using a v4 adapter with deterministic key storage.
 */
export class LegacyFileAdapter<K = string, V = unknown> implements FlashcoreAdapter<K, V> {
	readonly name = 'LegacyFileAdapter'
	readonly dataDir: string

	constructor(options: LegacyFileAdapterOptions = {}) {
		this.dataDir = options.dataDir ?? path.join(process.cwd(), '.robo', 'data')
	}

	// ─────────────────────────────────────────────────────────────
	// Required Methods
	// ─────────────────────────────────────────────────────────────

	async get(key: K): Promise<V | undefined> {
		try {
			const fileName = this.getFilePath(key)
			const gunzip = zlib.createGunzip()

			await pipeline(createReadStream(fileName), gunzip)

			const decompressed = gunzip.read()
			return decompressed ? (JSON.parse(decompressed.toString()) as V) : undefined
		} catch {
			return undefined
		}
	}

	async set(key: K, value: V): Promise<boolean> {
		try {
			const fileName = this.getFilePath(key)
			const gzip = zlib.createGzip()

			gzip.write(JSON.stringify(value))
			gzip.end()

			await pipeline(gzip, createWriteStream(fileName))
			return true
		} catch {
			return false
		}
	}

	async delete(key: K): Promise<boolean> {
		try {
			const fileName = this.getFilePath(key)
			await fs.unlink(fileName)
			return true
		} catch (e) {
			// ENOENT means key doesn't exist (normal case)
			if (this.isNodeError(e) && e.code === 'ENOENT') {
				return false
			}
			// Other errors are logged but don't throw
			return false
		}
	}

	/**
	 * Check if a key exists.
	 *
	 * FIXED: Unlike the original implementation which used `!!get()`,
	 * this properly checks file existence to handle falsy stored values.
	 */
	async has(key: K): Promise<boolean> {
		try {
			const fileName = this.getFilePath(key)
			await fs.access(fileName)
			return true
		} catch {
			return false
		}
	}

	async clear(): Promise<boolean> {
		try {
			await fs.rm(this.dataDir, { recursive: true, force: true })
			await fs.mkdir(this.dataDir, { recursive: true })
			return true
		} catch {
			return false
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Optional Lifecycle
	// ─────────────────────────────────────────────────────────────

	async init(): Promise<void> {
		try {
			await fs.mkdir(this.dataDir, { recursive: true })
		} catch (e) {
			throw new Error(`Failed to create data directory for LegacyFileAdapter: ${e}`)
		}
	}

	// ─────────────────────────────────────────────────────────────
	// NOTE: No scan capability
	// ─────────────────────────────────────────────────────────────
	//
	// Legacy file adapter uses SHA256 hashed filenames, which means:
	// - Keys cannot be recovered from filenames
	// - Prefix-based scanning is not possible
	// - WAL recovery is NOT available with this adapter
	//
	// If you need scan capability, migrate to a v4 file adapter.
	// ─────────────────────────────────────────────────────────────

	// ─────────────────────────────────────────────────────────────
	// Private Helpers
	// ─────────────────────────────────────────────────────────────

	/**
	 * Get the file path for a key using SHA256 hash.
	 */
	private getFilePath(key: K): string {
		const hash = createHash('sha256').update(String(key)).digest('hex')
		return path.join(this.dataDir, hash)
	}

	/**
	 * Type guard for Node.js errors with code property.
	 */
	private isNodeError(error: unknown): error is NodeJS.ErrnoException {
		return error instanceof Error && 'code' in error
	}
}

/**
 * Create a new LegacyFileAdapter instance.
 */
export function createLegacyFileAdapter<K = string, V = unknown>(
	options?: LegacyFileAdapterOptions
): LegacyFileAdapter<K, V> {
	return new LegacyFileAdapter<K, V>(options)
}
