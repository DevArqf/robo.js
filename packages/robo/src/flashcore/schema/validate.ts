/**
 * Flashcore v1 (spec rev 4.3) Schema Validation
 *
 * Validates record data against schema definitions.
 */

import { ValidationError } from '../core/errors.js'
import type { NormalizedSchema, NormalizedField, ValidationResult, ValidationError as ValidationErrorType } from './types.js'
import { getUnknownFields, getMissingRequiredFields } from './normalize.js'

/**
 * ID validation constraints.
 */
export const ID_CONSTRAINTS = {
	maxLength: 200,
	pattern: /^[A-Za-z0-9_-]+$/
}

/**
 * Record validator for schema-based validation.
 */
export class RecordValidator {
	constructor(private schema: NormalizedSchema) {}

	/**
	 * Validate data for create operation.
	 *
	 * @param data - Input data
	 * @returns Validation result
	 */
	validateCreate(data: unknown): ValidationResult {
		const errors: ValidationErrorType[] = []

		if (!isObject(data)) {
			return {
				valid: false,
				errors: [{ field: '', message: 'Data must be an object', code: 'NOT_OBJECT' }]
			}
		}

		const record = data as Record<string, unknown>

		// Check for unknown fields (strict mode)
		const unknown = getUnknownFields(record, this.schema)
		for (const field of unknown) {
			errors.push({
				field,
				message: `Unknown field "${field}" is not allowed`,
				code: 'UNKNOWN_FIELD'
			})
		}

		// Check for missing required fields
		const missing = getMissingRequiredFields(record, this.schema)
		for (const field of missing) {
			errors.push({
				field,
				message: `Required field "${field}" is missing`,
				code: 'REQUIRED_FIELD'
			})
		}

		// Validate ID if provided
		if ('id' in record && record.id !== undefined) {
			const idErrors = this.validateId(record.id)
			errors.push(...idErrors)
		}

		// Validate each field type
		for (const [fieldName, fieldDef] of this.schema.fields) {
			if (fieldName in record) {
				const value = record[fieldName]
				const fieldErrors = this.validateField(fieldName, value, fieldDef)
				errors.push(...fieldErrors)
			}
		}

		return {
			valid: errors.length === 0,
			errors
		}
	}

	/**
	 * Validate data for update operation.
	 *
	 * @param data - Input data
	 * @returns Validation result
	 */
	validateUpdate(data: unknown): ValidationResult {
		const errors: ValidationErrorType[] = []

		if (!isObject(data)) {
			return {
				valid: false,
				errors: [{ field: '', message: 'Data must be an object', code: 'NOT_OBJECT' }]
			}
		}

		const record = data as Record<string, unknown>

		// Check for unknown fields (strict mode)
		const unknown = getUnknownFields(record, this.schema)
		for (const field of unknown) {
			// Skip 'id' - it's handled separately
			if (field !== 'id') {
				errors.push({
					field,
					message: `Unknown field "${field}" is not allowed`,
					code: 'UNKNOWN_FIELD'
				})
			}
		}

		// Reject ID mutation
		if ('id' in record) {
			errors.push({
				field: 'id',
				message: 'Cannot update id field. ID is immutable.',
				code: 'ID_MUTATION'
			})
		}

		// Validate each provided field type
		for (const [fieldName, fieldDef] of this.schema.fields) {
			if (fieldName in record) {
				const value = record[fieldName]
				const fieldErrors = this.validateField(fieldName, value, fieldDef)
				errors.push(...fieldErrors)
			}
		}

		return {
			valid: errors.length === 0,
			errors
		}
	}

	/**
	 * Validate a record ID.
	 */
	validateId(id: unknown): ValidationErrorType[] {
		const errors: ValidationErrorType[] = []

		if (typeof id !== 'string') {
			errors.push({
				field: 'id',
				message: 'ID must be a string',
				code: 'INVALID_ID_TYPE'
			})
			return errors
		}

		if (id.length === 0) {
			errors.push({
				field: 'id',
				message: 'ID cannot be empty',
				code: 'EMPTY_ID'
			})
		}

		if (id.length > ID_CONSTRAINTS.maxLength) {
			errors.push({
				field: 'id',
				message: `ID exceeds maximum length of ${ID_CONSTRAINTS.maxLength} characters`,
				code: 'ID_TOO_LONG'
			})
		}

		if (!ID_CONSTRAINTS.pattern.test(id)) {
			errors.push({
				field: 'id',
				message: 'ID contains invalid characters. Only letters, numbers, underscores, and hyphens are allowed.',
				code: 'INVALID_ID_CHARS'
			})
		}

		return errors
	}

	/**
	 * Validate a single field value.
	 */
	validateField(
		name: string,
		value: unknown,
		field: NormalizedField
	): ValidationErrorType[] {
		const errors: ValidationErrorType[] = []

		// Allow null/undefined for optional fields
		if (value === null || value === undefined) {
			if (!field.optional && !field.hasDefault) {
				errors.push({
					field: name,
					message: `Field "${name}" cannot be null or undefined`,
					code: 'NULL_NOT_ALLOWED'
				})
			}
			return errors
		}

		// Type-specific validation
		switch (field.type) {
			case 'string':
				if (!this.validateString(value)) {
					errors.push({
						field: name,
						message: `Field "${name}" must be a string`,
						code: 'INVALID_TYPE'
					})
				}
				break

			case 'number':
				if (!this.validateNumber(value)) {
					errors.push({
						field: name,
						message: `Field "${name}" must be a number`,
						code: 'INVALID_TYPE'
					})
				}
				break

			case 'boolean':
				if (!this.validateBoolean(value)) {
					errors.push({
						field: name,
						message: `Field "${name}" must be a boolean`,
						code: 'INVALID_TYPE'
					})
				}
				break

			case 'date':
				if (!this.validateDate(value)) {
					errors.push({
						field: name,
						message: `Field "${name}" must be a Date or valid date string`,
						code: 'INVALID_TYPE'
					})
				}
				break

			case 'enum':
				if (!this.validateEnum(value, field.enumValues ?? [])) {
					errors.push({
						field: name,
						message: `Field "${name}" must be one of: ${field.enumValues?.join(', ')}`,
						code: 'INVALID_ENUM'
					})
				}
				break

			case 'json':
				// JSON accepts any serializable value
				if (!this.validateJson(value)) {
					errors.push({
						field: name,
						message: `Field "${name}" must be JSON-serializable`,
						code: 'INVALID_JSON'
					})
				}
				break
		}

		return errors
	}

	/**
	 * Validate string value.
	 */
	validateString(value: unknown): boolean {
		return typeof value === 'string'
	}

	/**
	 * Validate number value.
	 */
	validateNumber(value: unknown): boolean {
		return typeof value === 'number' && !Number.isNaN(value)
	}

	/**
	 * Validate boolean value.
	 */
	validateBoolean(value: unknown): boolean {
		return typeof value === 'boolean'
	}

	/**
	 * Validate date value.
	 */
	validateDate(value: unknown): boolean {
		if (value instanceof Date) {
			return !Number.isNaN(value.getTime())
		}
		if (typeof value === 'string') {
			const date = new Date(value)
			return !Number.isNaN(date.getTime())
		}
		return false
	}

	/**
	 * Validate enum value.
	 */
	validateEnum(value: unknown, allowed: string[]): boolean {
		return typeof value === 'string' && allowed.includes(value)
	}

	/**
	 * Validate JSON value.
	 */
	validateJson(value: unknown): boolean {
		try {
			JSON.stringify(value)
			return true
		} catch {
			return false
		}
	}
}

/**
 * Throw validation error if result has errors.
 */
export function throwIfInvalid(result: ValidationResult): void {
	if (!result.valid) {
		const messages = result.errors.map(e => `${e.field}: ${e.message}`).join('; ')
		const firstError = result.errors[0]
		throw new ValidationError(
			`Validation failed: ${messages}`,
			{ field: firstError?.field, value: firstError?.value }
		)
	}
}

/**
 * Type guard for objects.
 */
function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
