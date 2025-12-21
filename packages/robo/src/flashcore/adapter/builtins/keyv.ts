/**
 * Flashcore v4.3 Keyv Adapter
 *
 * Wraps a Keyv instance as a Flashcore adapter.
 * Minimal capabilities - no scan, no atomic operations.
 */

import type { FlashcoreAdapter } from '../types.js'

/**
 * Keyv instance interface.
 * Minimal typing to avoid requiring keyv as a dependency.
 */
export interface KeyvLike<V = unknown> {
	get(key: string): Promise<V | undefined>
	set(key: string, value: V, ttl?: number): Promise<true>
	delete(key: string): Promise<boolean>
	has?(key: string): Promise<boolean>
	clear(): Promise<void>
	on?(event: string, callback: (...args: unknown[]) => void): void
}

export interface KeyvAdapterOptions {
	/**
	 * Optional TTL for all entries (in milliseconds).
	 */
	ttl?: number
}

/**
 * Keyv adapter for Flashcore.
 *
 * Wraps any Keyv-compatible instance, including:
 * - In-memory (default Keyv)
 * - Redis (@keyv/redis)
 * - MongoDB (@keyv/mongo)
 * - PostgreSQL (@keyv/postgres)
 * - MySQL (@keyv/mysql)
 * - SQLite (@keyv/sqlite)
 * - And many more...
 *
 * Limitations:
 * - No scan capability (Keyv doesn't expose key listing)
 * - No atomic batch operations
 * - No setIfNotExists
 * - WAL recovery is disabled
 * - Bulk operations are disabled
 *
 * Use this adapter for simple KV storage when you need external storage
 * but don't need advanced features.
 */
export class KeyvAdapter<V = unknown> implements FlashcoreAdapter<string, V> {
	readonly name = 'KeyvAdapter'

	private keyv: KeyvLike<V>
	private ttl?: number

	constructor(keyv: KeyvLike<V>, options: KeyvAdapterOptions = {}) {
		this.keyv = keyv
		this.ttl = options.ttl
	}

	// ─────────────────────────────────────────────────────────────
	// Required Methods
	// ─────────────────────────────────────────────────────────────

	async get(key: string): Promise<V | undefined> {
		return this.keyv.get(key)
	}

	async set(key: string, value: V): Promise<boolean> {
		await this.keyv.set(key, value, this.ttl)
		return true
	}

	async delete(key: string): Promise<boolean> {
		return this.keyv.delete(key)
	}

	async has(key: string): Promise<boolean> {
		// Use native has if available (some Keyv stores support it)
		if (typeof this.keyv.has === 'function') {
			return this.keyv.has(key)
		}

		// Fallback: check if get returns a value
		// Note: This has the same truthiness bug as old Flashcore,
		// but we can't do better without native has support
		const value = await this.keyv.get(key)
		return value !== undefined
	}

	async clear(): Promise<void> {
		await this.keyv.clear()
	}

	// ─────────────────────────────────────────────────────────────
	// Optional Lifecycle
	// ─────────────────────────────────────────────────────────────

	init(): void {
		// Keyv handles its own initialization
		// Optionally register error handler
		if (typeof this.keyv.on === 'function') {
			this.keyv.on('error', (err: unknown) => {
				console.error('[KeyvAdapter] Error:', err)
			})
		}
	}

	// ─────────────────────────────────────────────────────────────
	// NOTE: No advanced capabilities
	// ─────────────────────────────────────────────────────────────
	//
	// Keyv is a simple KV abstraction and doesn't expose:
	// - scan/keys listing
	// - atomic operations
	// - conditional puts
	//
	// If you need these features, use a native adapter for your
	// storage backend instead of going through Keyv.
	// ─────────────────────────────────────────────────────────────
}

/**
 * Create a KeyvAdapter from a Keyv instance.
 */
export function createKeyvAdapter<V = unknown>(
	keyv: KeyvLike<V>,
	options?: KeyvAdapterOptions
): KeyvAdapter<V> {
	return new KeyvAdapter<V>(keyv, options)
}

/**
 * Dynamically import Keyv and create an adapter.
 *
 * @param keyvOptions - Options passed to Keyv constructor
 * @returns KeyvAdapter wrapping a new Keyv instance
 */
export async function createKeyvAdapterFromOptions<V = unknown>(
	keyvOptions?: unknown
): Promise<KeyvAdapter<V>> {
	let Keyv: new (options?: unknown) => KeyvLike<V>

	try {
		const module = await import('keyv')
		Keyv = module.default
	} catch (error) {
		throw new Error(
			'Failed to import Keyv. Did you remember to install `keyv`?',
			{ cause: error }
		)
	}

	const keyv = new Keyv(keyvOptions)
	return new KeyvAdapter<V>(keyv)
}
