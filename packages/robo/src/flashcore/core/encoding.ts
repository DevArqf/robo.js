/**
 * Flashcore v1 Safe Key Encoding (spec rev 4.3)
 *
 * Provides reversible key encoding for safe storage across all adapters.
 * Keys with special characters are encoded using base64url.
 */

import { ENCODED_KEY_PREFIX, SAFE_KEY_CHARS, MAX_LENGTHS } from './constants.js'
import { ValidationError } from './errors.js'

/**
 * Encode data to base64url (URL-safe base64 without padding).
 */
function toBase64Url(data: string): string {
	// Convert string to UTF-8 bytes, then to base64
	const bytes = new TextEncoder().encode(data)
	const base64 = btoa(String.fromCharCode(...bytes))
	// Convert to base64url: replace + with -, / with _, remove padding
	return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Decode from base64url to string.
 */
function fromBase64Url(encoded: string): string {
	// Convert from base64url: replace - with +, _ with /, add padding
	let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
	// Add padding if needed
	while (base64.length % 4 !== 0) {
		base64 += '='
	}
	// Decode base64 to bytes, then to string
	const binary = atob(base64)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i)
	}
	return new TextDecoder().decode(bytes)
}

/**
 * Encoded key structure for v1 format.
 */
export interface EncodedKeyData {
	namespace: string[]
	key: string
}

/**
 * Check if a key needs encoding (contains unsafe characters).
 */
export function needsEncoding(key: string): boolean {
	return !SAFE_KEY_CHARS.test(key)
}

/**
 * Encode a (namespace, key) pair into a safe storage key.
 *
 * If the composed key contains only safe characters, it's stored as-is.
 * Otherwise, it's encoded as `_e:{base64url}` where the payload is JSON.
 *
 * @param namespace - Namespace segments (can be empty)
 * @param key - The key within the namespace
 * @returns Safe storage key
 */
export function encodeKey(namespace: string[], key: string): string {
	// Compose the key with namespace
	const composed = namespace.length > 0
		? `${namespace.join(':')}::${key}`
		: key

	// Check length
	if (composed.length > MAX_LENGTHS.composedKey) {
		throw new ValidationError(
			`Composed key exceeds maximum length of ${MAX_LENGTHS.composedKey} characters`,
			{ field: 'key', value: composed }
		)
	}

	// If safe, use as-is
	if (!needsEncoding(composed)) {
		return composed
	}

	// Encode as JSON payload in base64url
	const payload: EncodedKeyData = { namespace, key }
	const json = JSON.stringify(payload)
	const encoded = toBase64Url(json)

	return `${ENCODED_KEY_PREFIX}${encoded}`
}

/**
 * Decode a storage key back to (namespace, key) pair.
 *
 * Handles both plain keys and encoded `_e:{base64url}` keys.
 *
 * @param storageKey - The key from storage
 * @returns Decoded namespace and key
 */
export function decodeKey(storageKey: string): EncodedKeyData {
	// Check if it's an encoded key
	if (storageKey.startsWith(ENCODED_KEY_PREFIX)) {
		const encoded = storageKey.slice(ENCODED_KEY_PREFIX.length)
		const json = fromBase64Url(encoded)
		const payload = JSON.parse(json) as EncodedKeyData
		return payload
	}

	// Parse plain key format: namespace::key or just key
	const doubleColonIndex = storageKey.indexOf('::')
	if (doubleColonIndex !== -1) {
		const namespacePart = storageKey.slice(0, doubleColonIndex)
		const key = storageKey.slice(doubleColonIndex + 2)
		// Split namespace by single colons
		const namespace = namespacePart.split(':')
		return { namespace, key }
	}

	// No namespace
	return { namespace: [], key: storageKey }
}

/**
 * Encode a value for use in unique index keys.
 *
 * Values are encoded to be safe in key paths while remaining
 * somewhat readable when possible.
 *
 * @param value - The value to encode
 * @returns Safe key component
 */
export function encodeUniqueValue(value: unknown): string {
	// Handle common safe cases without encoding
	if (typeof value === 'string') {
		if (value.length > MAX_LENGTHS.uniqueFieldValue) {
			throw new ValidationError(
				`Unique field value exceeds maximum length of ${MAX_LENGTHS.uniqueFieldValue} characters`,
				{ field: 'uniqueValue', value }
			)
		}
		// If string is safe for keys, use it directly with ~ prefix (marks as safe literal)
		if (SAFE_KEY_CHARS.test(value) && value.length > 0) {
			return `~${value}`
		}
	}

	if (typeof value === 'number' && Number.isFinite(value)) {
		return `~${value}`
	}

	if (typeof value === 'boolean') {
		return `~${value}`
	}

	// Encode everything else as JSON in base64url
	const json = JSON.stringify(value)
	return toBase64Url(json)
}

/**
 * Decode a unique index value back to its original form.
 *
 * @param encoded - The encoded value from an index key
 * @returns The original value
 */
export function decodeUniqueValue(encoded: string): unknown {
	// Check for safe literal prefix
	if (encoded.startsWith('~')) {
		const literal = encoded.slice(1)
		// Try to parse as number
		const num = Number(literal)
		if (!Number.isNaN(num) && String(num) === literal) {
			return num
		}
		// Try boolean
		if (literal === 'true') return true
		if (literal === 'false') return false
		// Return as string
		return literal
	}

	// Decode from base64url JSON
	const json = fromBase64Url(encoded)
	return JSON.parse(json)
}

/**
 * SafeKeyEncoder class for stateful encoding operations.
 *
 * Provides encoding/decoding with version tracking for future
 * format migrations.
 */
export class SafeKeyEncoder {
	/**
	 * Current encoding format version.
	 */
	static readonly VERSION = 1

	/**
	 * Encode a (namespace, key) pair.
	 */
	encode(namespace: string[], key: string): string {
		return encodeKey(namespace, key)
	}

	/**
	 * Decode a storage key.
	 */
	decode(storageKey: string): EncodedKeyData {
		return decodeKey(storageKey)
	}

	/**
	 * Encode a unique field value.
	 */
	encodeValue(value: unknown): string {
		return encodeUniqueValue(value)
	}

	/**
	 * Decode a unique field value.
	 */
	decodeValue(encoded: string): unknown {
		return decodeUniqueValue(encoded)
	}

	/**
	 * Check if a key is encoded.
	 */
	isEncoded(key: string): boolean {
		return key.startsWith(ENCODED_KEY_PREFIX)
	}
}

/**
 * Default encoder instance.
 */
export const safeKeyEncoder = new SafeKeyEncoder()
