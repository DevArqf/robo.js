/**
 * Flashcore v4.3 Type Serialization
 *
 * Handles serialization/deserialization of special types (Date, BigInt)
 * for storage in key-value adapters.
 */

import type { NormalizedSchema, FieldType } from './types.js'

/**
 * Serialization markers for type detection.
 */
const MARKERS = {
	DATE: '__date__:',
	BIGINT: '__bigint__:'
} as const

/**
 * Type serializer for storing and retrieving records.
 */
export class TypeSerializer {
	constructor(private schema: NormalizedSchema) {}

	/**
	 * Serialize a record for storage.
	 * Converts Date objects to ISO strings with markers.
	 *
	 * @param record - Record to serialize
	 * @returns Serialized record
	 */
	serializeRecord(record: Record<string, unknown>): Record<string, unknown> {
		const result: Record<string, unknown> = {}

		for (const [key, value] of Object.entries(record)) {
			const field = this.schema.fields.get(key)
			if (field) {
				result[key] = this.serialize(value, field.type)
			} else if (key === this.schema.primaryKey) {
				// Primary key is always a string
				result[key] = value
			} else {
				// Unknown field (shouldn't happen after validation)
				result[key] = value
			}
		}

		return result
	}

	/**
	 * Deserialize a record from storage.
	 * Converts ISO strings with markers back to Date objects.
	 *
	 * @param record - Record from storage
	 * @returns Deserialized record
	 */
	deserializeRecord(record: Record<string, unknown>): Record<string, unknown> {
		const result: Record<string, unknown> = {}

		for (const [key, value] of Object.entries(record)) {
			const field = this.schema.fields.get(key)
			if (field) {
				result[key] = this.deserialize(value, field.type)
			} else if (key === this.schema.primaryKey) {
				// Primary key is always a string
				result[key] = value
			} else {
				// Unknown field
				result[key] = value
			}
		}

		return result
	}

	/**
	 * Serialize a single value based on field type.
	 *
	 * @param value - Value to serialize
	 * @param fieldType - Type of the field
	 * @returns Serialized value
	 */
	serialize(value: unknown, fieldType: FieldType): unknown {
		if (value === null || value === undefined) {
			return value
		}

		switch (fieldType) {
			case 'date':
				return this.serializeDate(value)

			case 'json':
				// JSON is stored as-is (adapter handles JSON serialization)
				return value

			case 'number':
				// Check for BigInt (optional support)
				if (typeof value === 'bigint') {
					return this.serializeBigInt(value)
				}
				return value

			default:
				return value
		}
	}

	/**
	 * Deserialize a single value based on field type.
	 *
	 * @param value - Value from storage
	 * @param fieldType - Type of the field
	 * @returns Deserialized value
	 */
	deserialize(value: unknown, fieldType: FieldType): unknown {
		if (value === null || value === undefined) {
			return value
		}

		switch (fieldType) {
			case 'date':
				return this.deserializeDate(value)

			case 'number':
				// Check for BigInt marker
				if (typeof value === 'string' && value.startsWith(MARKERS.BIGINT)) {
					return this.deserializeBigInt(value)
				}
				return value

			default:
				return value
		}
	}

	/**
	 * Serialize a Date value.
	 */
	private serializeDate(value: unknown): string {
		if (value instanceof Date) {
			return MARKERS.DATE + value.toISOString()
		}
		if (typeof value === 'string') {
			// Already a string - validate and re-format
			const date = new Date(value)
			if (!Number.isNaN(date.getTime())) {
				return MARKERS.DATE + date.toISOString()
			}
		}
		// Return as-is if not a valid date
		return String(value)
	}

	/**
	 * Deserialize a Date value.
	 */
	private deserializeDate(value: unknown): Date | unknown {
		if (typeof value === 'string') {
			if (value.startsWith(MARKERS.DATE)) {
				const isoString = value.slice(MARKERS.DATE.length)
				const date = new Date(isoString)
				if (!Number.isNaN(date.getTime())) {
					return date
				}
			}
			// Try parsing as ISO string directly (for backwards compatibility)
			const date = new Date(value)
			if (!Number.isNaN(date.getTime())) {
				return date
			}
		}
		return value
	}

	/**
	 * Serialize a BigInt value.
	 */
	private serializeBigInt(value: bigint): string {
		return MARKERS.BIGINT + value.toString()
	}

	/**
	 * Deserialize a BigInt value.
	 */
	private deserializeBigInt(value: string): bigint {
		const numStr = value.slice(MARKERS.BIGINT.length)
		return BigInt(numStr)
	}
}

/**
 * Check if a value is a serialized date.
 */
export function isSerializedDate(value: unknown): boolean {
	return typeof value === 'string' && value.startsWith(MARKERS.DATE)
}

/**
 * Check if a value is a serialized BigInt.
 */
export function isSerializedBigInt(value: unknown): boolean {
	return typeof value === 'string' && value.startsWith(MARKERS.BIGINT)
}
