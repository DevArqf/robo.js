/**
 * JSON utilities for handling special types like BigInt and circular references
 */

/**
 * JSON.stringify replacer that converts BigInt values to strings.
 * BigInt values are serialized as strings with their numeric value.
 *
 * @example
 * JSON.stringify({ id: 123456789012345678n }, bigIntReplacer)
 * // => '{"id":"123456789012345678"}'
 */
export function bigIntReplacer(_key: string, value: unknown): unknown {
	if (typeof value === 'bigint') {
		return value.toString()
	}
	return value
}

/**
 * Creates a replacer function that handles both BigInt and circular references.
 * Uses a WeakSet to track seen objects and replaces circular refs with "[Circular]".
 *
 * @returns A replacer function for JSON.stringify
 */
export function createSafeReplacer(): (key: string, value: unknown) => unknown {
	const seen = new WeakSet<object>()

	return function (_key: string, value: unknown): unknown {
		// Handle BigInt
		if (typeof value === 'bigint') {
			return value.toString()
		}

		// Handle circular references for objects
		if (typeof value === 'object' && value !== null) {
			if (seen.has(value)) {
				return '[Circular]'
			}
			seen.add(value)
		}

		return value
	}
}

/**
 * Safely stringify an object, handling BigInt values and circular references.
 * This is a drop-in replacement for JSON.stringify when the object may contain
 * BigInts or circular references (common in Discord.js objects).
 *
 * @param value - The value to stringify
 * @param space - Optional indentation (same as JSON.stringify)
 * @returns JSON string representation
 *
 * @example
 * safeStringify({ userId: 123456789012345678n, name: 'Test' })
 * // => '{"userId":"123456789012345678","name":"Test"}'
 *
 * @example
 * const obj = { name: 'test' }
 * obj.self = obj // circular reference
 * safeStringify(obj)
 * // => '{"name":"test","self":"[Circular]"}'
 */
export function safeStringify(value: unknown, space?: string | number): string {
	return JSON.stringify(value, createSafeReplacer(), space)
}
