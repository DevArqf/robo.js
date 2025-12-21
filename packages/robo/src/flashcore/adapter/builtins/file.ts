/**
 * Flashcore v4.3 File Adapter
 *
 * A persistent file-based adapter with:
 * - Deterministic key storage (filesystem-safe encoding)
 * - Atomic writes (temp file + rename)
 * - Directory-based scan support
 */

import { readFile, writeFile, rename, unlink, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
	FlashcoreAdapter,
	BatchOperation,
	AdapterCapabilitiesReport
} from '../types.js'

/**
 * Options for the FileAdapter.
 */
export interface FileAdapterOptions {
	/**
	 * Base directory for storage.
	 * Default: '.robo/flashcore'
	 */
	baseDir?: string

	/**
	 * File extension for stored files.
	 * Default: '.json'
	 */
	extension?: string

	/**
	 * Use synchronous operations (for simpler semantics).
	 * Default: false (async for better performance)
	 */
	sync?: boolean

	/**
	 * Pretty-print JSON output.
	 * Default: false
	 */
	pretty?: boolean
}

// Characters safe for use in filenames on all platforms
const SAFE_FILENAME_CHARS = /^[A-Za-z0-9_.-]+$/
const ENCODED_PREFIX = '_e_'

/**
 * Encode a key to be safe for use as a filename.
 *
 * Keys that contain only safe characters are used as-is.
 * Keys with special characters are base64url encoded with a prefix.
 */
function encodeFilename(key: string): string {
	// Short-circuit for already-safe keys
	if (key.length < 200 && SAFE_FILENAME_CHARS.test(key)) {
		return key
	}

	// Base64url encode for safety
	const encoded = Buffer.from(key, 'utf-8').toString('base64url')
	return ENCODED_PREFIX + encoded
}

/**
 * Decode a filename back to the original key.
 */
function decodeFilename(filename: string): string {
	if (!filename.startsWith(ENCODED_PREFIX)) {
		return filename
	}

	const encoded = filename.slice(ENCODED_PREFIX.length)
	return Buffer.from(encoded, 'base64url').toString('utf-8')
}

/**
 * File-based storage adapter using the filesystem.
 *
 * Features:
 * - Atomic writes via temp file + rename
 * - Filesystem-safe key encoding
 * - scan(prefix) via directory listing
 * - setIfNotExists via exclusive file creation
 *
 * Storage layout:
 * .robo/flashcore/
 *   ├── {encoded-key}.json
 *   ├── {encoded-key}.json
 *   └── ...
 */
export class FileAdapter<K extends string = string, V = unknown> implements FlashcoreAdapter<K, V> {
	readonly name = 'FileAdapter'

	private baseDir: string
	private extension: string
	private pretty: boolean
	private initialized = false

	constructor(options: FileAdapterOptions = {}) {
		this.baseDir = options.baseDir ?? '.robo/flashcore'
		this.extension = options.extension ?? '.json'
		this.pretty = options.pretty ?? false
		// Note: options.sync is accepted but not yet implemented (all operations are async)
	}

	// ─────────────────────────────────────────────────────────────
	// Lifecycle
	// ─────────────────────────────────────────────────────────────

	async init(): Promise<void> {
		if (this.initialized) return

		// Ensure base directory exists
		await this.ensureDir(this.baseDir)
		this.initialized = true
	}

	async shutdown(): Promise<void> {
		// No cleanup needed for file adapter
		this.initialized = false
	}

	// ─────────────────────────────────────────────────────────────
	// Required Methods
	// ─────────────────────────────────────────────────────────────

	async get(key: K): Promise<V | undefined> {
		const filepath = this.keyToPath(key)

		try {
			const content = await readFile(filepath, 'utf-8')
			return JSON.parse(content) as V
		} catch (err) {
			// File doesn't exist
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
				return undefined
			}
			throw err
		}
	}

	async set(key: K, value: V): Promise<boolean> {
		const filepath = this.keyToPath(key)

		// Ensure parent directory exists
		await this.ensureDir(dirname(filepath))

		// Atomic write: write to temp file, then rename
		const tempPath = `${filepath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`
		const content = this.pretty
			? JSON.stringify(value, null, 2)
			: JSON.stringify(value)

		try {
			await writeFile(tempPath, content, 'utf-8')
			await rename(tempPath, filepath)
			return true
		} catch (err) {
			// Clean up temp file on failure
			try {
				await unlink(tempPath)
			} catch {
				// Ignore cleanup errors
			}
			throw err
		}
	}

	async delete(key: K): Promise<boolean> {
		const filepath = this.keyToPath(key)

		try {
			await unlink(filepath)
			return true
		} catch (err) {
			// File doesn't exist - technically still "deleted"
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
				return false
			}
			throw err
		}
	}

	async has(key: K): Promise<boolean> {
		const filepath = this.keyToPath(key)

		try {
			await stat(filepath)
			return true
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
				return false
			}
			throw err
		}
	}

	async clear(): Promise<void> {
		try {
			// Remove and recreate the entire directory
			await rm(this.baseDir, { recursive: true, force: true })
			await mkdir(this.baseDir, { recursive: true })
		} catch {
			// Directory might not exist, that's fine
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Optional Capabilities
	// ─────────────────────────────────────────────────────────────

	/**
	 * Scan for keys with a given prefix.
	 * Scans the directory and filters by prefix after decoding filenames.
	 */
	async scan(prefix: K): Promise<K[]> {
		const results: K[] = []
		const prefixStr = String(prefix)

		try {
			const files = await readdir(this.baseDir)

			for (const file of files) {
				// Skip non-data files
				if (!file.endsWith(this.extension)) continue

				// Remove extension to get encoded key
				const encoded = file.slice(0, -this.extension.length)
				const key = decodeFilename(encoded) as K

				// Filter by prefix
				if (String(key).startsWith(prefixStr)) {
					results.push(key)
				}
			}
		} catch (err) {
			// Directory doesn't exist yet
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
				return []
			}
			throw err
		}

		return results
	}

	/**
	 * Set a key only if it doesn't exist.
	 * Uses exclusive file creation flag to ensure atomicity.
	 */
	async setIfNotExists(key: K, value: V): Promise<boolean> {
		const filepath = this.keyToPath(key)

		// Ensure parent directory exists
		await this.ensureDir(dirname(filepath))

		// Use O_EXCL flag for atomic check-and-create
		// Node.js writeFile with flag 'wx' opens with O_WRONLY | O_CREAT | O_EXCL
		const content = this.pretty
			? JSON.stringify(value, null, 2)
			: JSON.stringify(value)

		try {
			await writeFile(filepath, content, { flag: 'wx', encoding: 'utf-8' })
			return true
		} catch (err) {
			// File already exists
			if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
				return false
			}
			throw err
		}
	}

	/**
	 * Compare and swap: atomically update if current value matches expected.
	 *
	 * Note: This implementation is NOT truly atomic on the filesystem level,
	 * but uses in-memory comparison. For true atomicity, use with chunk/catalog locks.
	 */
	async compareAndSwap(key: K, expected: V, next: V): Promise<boolean> {
		const current = await this.get(key)

		// Compare using JSON serialization
		const currentJson = JSON.stringify(current)
		const expectedJson = JSON.stringify(expected)

		if (currentJson !== expectedJson) {
			return false
		}

		await this.set(key, next)
		return true
	}

	/**
	 * Apply a batch of operations atomically.
	 *
	 * Note: This is NOT truly atomic at the filesystem level.
	 * For crash safety, use WAL at a higher level.
	 */
	async atomicBatch(ops: BatchOperation<K, V>[]): Promise<void> {
		// First, validate all check operations
		for (const op of ops) {
			if (op.type === 'check') {
				const current = await this.get(op.key)
				const currentVersion = (current as { _version?: number } | undefined)?._version

				if (currentVersion !== op.expectedVersion) {
					throw new Error(
						`Batch operation failed: version check failed for key "${op.key}". ` +
						`Expected version ${op.expectedVersion}, got ${currentVersion}`
					)
				}
			}
		}

		// Apply all set/delete operations
		for (const op of ops) {
			switch (op.type) {
				case 'set':
					await this.set(op.key, op.value)
					break
				case 'delete':
					await this.delete(op.key)
					break
				// 'check' operations are already validated
			}
		}
	}

	/**
	 * Report extended capabilities.
	 */
	capabilities(): AdapterCapabilitiesReport {
		return {
			// File adapter has no true transaction isolation
			// but embedded mode uses in-process locks
			isolation: 'none'
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Helper Methods
	// ─────────────────────────────────────────────────────────────

	/**
	 * Convert a key to a filesystem path.
	 */
	private keyToPath(key: K): string {
		const encoded = encodeFilename(String(key))
		return join(this.baseDir, encoded + this.extension)
	}

	/**
	 * Ensure a directory exists.
	 */
	private async ensureDir(dir: string): Promise<void> {
		try {
			await mkdir(dir, { recursive: true })
		} catch (err) {
			// Directory might already exist
			if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
				throw err
			}
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Testing Utilities
	// ─────────────────────────────────────────────────────────────

	/**
	 * Get the storage directory path.
	 */
	getBaseDir(): string {
		return this.baseDir
	}

	/**
	 * Get all stored keys (for testing/debugging).
	 */
	async keys(): Promise<K[]> {
		return this.scan('' as K)
	}

	/**
	 * Get the number of stored keys.
	 */
	async size(): Promise<number> {
		const keys = await this.keys()
		return keys.length
	}
}

/**
 * Create a new FileAdapter instance.
 */
export function createFileAdapter<K extends string = string, V = unknown>(
	options?: FileAdapterOptions
): FileAdapter<K, V> {
	return new FileAdapter<K, V>(options)
}
