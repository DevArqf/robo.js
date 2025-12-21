/**
 * Flashcore v4.3 Scan Normalization
 *
 * Provides a unified async iterable interface for adapter scan methods,
 * regardless of whether the adapter returns arrays or async iterables.
 */

import type { FlashcoreAdapter } from './types.js'

/**
 * Type guard to check if a value is an async iterable.
 */
function isAsyncIterable<T>(value: unknown): value is AsyncIterable<T> {
	return (
		value !== null &&
		typeof value === 'object' &&
		Symbol.asyncIterator in value &&
		typeof (value as AsyncIterable<T>)[Symbol.asyncIterator] === 'function'
	)
}

/**
 * Type guard to check if a value is a regular iterable (like an array).
 */
function isIterable<T>(value: unknown): value is Iterable<T> {
	return (
		value !== null &&
		typeof value === 'object' &&
		Symbol.iterator in value &&
		typeof (value as Iterable<T>)[Symbol.iterator] === 'function'
	)
}

/**
 * Normalize adapter scan results into an async iterable.
 *
 * Adapters may return:
 * - K[] (synchronous array)
 * - Promise<K[]> (async array)
 * - AsyncIterable<K> (streaming)
 * - Promise<AsyncIterable<K>> (async streaming)
 *
 * This function normalizes all these to AsyncIterable<K> so callers
 * can always use `for await...of` without type checking.
 *
 * @param adapter - The adapter to scan
 * @param prefix - The prefix to scan for
 * @returns An async iterable of keys, or empty if scan is not supported
 *
 * @example
 * ```typescript
 * const adapter = new MemoryAdapter()
 * for await (const key of scanKeys(adapter, '_flashcore:wal:entry:')) {
 *   console.log(key)
 * }
 * ```
 */
export async function* scanKeys<K = string>(
	adapter: FlashcoreAdapter<K, unknown>,
	prefix: K
): AsyncIterable<K> {
	// Check if adapter supports scan
	if (typeof adapter.scan !== 'function') {
		return // Empty iterable for adapters without scan
	}

	// Call scan and get the result (may be sync or async)
	const result = adapter.scan(prefix)

	// Handle promise wrapper
	const resolved = result instanceof Promise ? await result : result

	// Handle async iterable (streaming response)
	if (isAsyncIterable<K>(resolved)) {
		yield* resolved
		return
	}

	// Handle regular iterable (array)
	if (isIterable<K>(resolved)) {
		for (const key of resolved) {
			yield key
		}
		return
	}

	// Fallback: if we got here, the adapter returned something unexpected
	// This shouldn't happen with properly typed adapters, but handle gracefully
	throw new Error(
		`Adapter scan returned unexpected type: ${typeof resolved}. ` +
		`Expected array or async iterable.`
	)
}

/**
 * Collect all scan results into an array.
 *
 * Useful when you need all keys at once rather than streaming.
 * Use with caution on large keysets.
 *
 * @param adapter - The adapter to scan
 * @param prefix - The prefix to scan for
 * @returns Array of all matching keys
 */
export async function scanKeysToArray<K = string>(
	adapter: FlashcoreAdapter<K, unknown>,
	prefix: K
): Promise<K[]> {
	const keys: K[] = []
	for await (const key of scanKeys(adapter, prefix)) {
		keys.push(key)
	}
	return keys
}

/**
 * Check if an adapter supports scanning.
 */
export function hasScanCapability(adapter: FlashcoreAdapter): boolean {
	return typeof adapter.scan === 'function'
}
