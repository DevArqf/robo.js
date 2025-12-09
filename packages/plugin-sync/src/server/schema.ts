import type { BuiltInSchema, SchemaField, SchemaValidationResult } from './types.js'

/**
 * Validate data against a schema (Zod or built-in).
 */
export function validateSchema(schema: unknown, data: unknown): SchemaValidationResult {
	// Check if it's a Zod schema (has .safeParse method)
	if (isZodSchema(schema)) {
		return validateZodSchema(schema, data)
	}

	// Otherwise treat as built-in schema
	return validateBuiltInSchema(schema as BuiltInSchema, data)
}

/**
 * Check if a schema is a Zod schema.
 */
function isZodSchema(schema: unknown): schema is { safeParse: (data: unknown) => { success: boolean; error?: { errors: Array<{ path: (string | number)[]; message: string }> } } } {
	return (
		schema !== null &&
		typeof schema === 'object' &&
		'safeParse' in schema &&
		typeof (schema as Record<string, unknown>).safeParse === 'function'
	)
}

/**
 * Validate using Zod schema.
 */
function validateZodSchema(
	schema: { safeParse: (data: unknown) => { success: boolean; error?: { errors: Array<{ path: (string | number)[]; message: string }> } } },
	data: unknown
): SchemaValidationResult {
	const result = schema.safeParse(data)

	if (result.success) {
		return { success: true }
	}

	const errors = result.error?.errors.map((e) => ({
		path: e.path.join('.'),
		message: e.message
	})) || []

	return { success: false, errors }
}

/**
 * Validate using built-in schema.
 */
function validateBuiltInSchema(schema: BuiltInSchema, data: unknown): SchemaValidationResult {
	const errors: Array<{ path: string; message: string }> = []

	if (typeof data !== 'object' || data === null) {
		return { success: false, errors: [{ path: '', message: 'Expected object' }] }
	}

	const dataObj = data as Record<string, unknown>

	for (const [key, field] of Object.entries(schema)) {
		const value = dataObj[key]
		const fieldErrors = validateField(value, field, key)
		errors.push(...fieldErrors)
	}

	return {
		success: errors.length === 0,
		errors: errors.length > 0 ? errors : undefined
	}
}

/**
 * Validate a single field against its schema.
 */
function validateField(value: unknown, field: SchemaField, path: string): Array<{ path: string; message: string }> {
	const errors: Array<{ path: string; message: string }> = []

	// Handle undefined/null
	if (value === undefined) {
		if (!field.optional) {
			errors.push({ path, message: 'Required field is missing' })
		}
		return errors
	}

	if (value === null) {
		if (!field.nullable) {
			errors.push({ path, message: 'Field cannot be null' })
		}
		return errors
	}

	// Type check
	switch (field.type) {
		case 'string':
			if (typeof value !== 'string') {
				errors.push({ path, message: `Expected string, got ${typeof value}` })
				return errors
			}
			if (field.minLength !== undefined && value.length < field.minLength) {
				errors.push({ path, message: `String too short (min ${field.minLength})` })
			}
			if (field.maxLength !== undefined && value.length > field.maxLength) {
				errors.push({ path, message: `String too long (max ${field.maxLength})` })
			}
			if (field.pattern !== undefined) {
				const regex = new RegExp(field.pattern)
				if (!regex.test(value)) {
					errors.push({ path, message: `String does not match pattern ${field.pattern}` })
				}
			}
			if (field.enum !== undefined && !field.enum.includes(value)) {
				errors.push({ path, message: `Value not in enum: ${field.enum.join(', ')}` })
			}
			break

		case 'number':
			if (typeof value !== 'number' || isNaN(value)) {
				errors.push({ path, message: `Expected number, got ${typeof value}` })
				return errors
			}
			if (field.min !== undefined && value < field.min) {
				errors.push({ path, message: `Number too small (min ${field.min})` })
			}
			if (field.max !== undefined && value > field.max) {
				errors.push({ path, message: `Number too large (max ${field.max})` })
			}
			if (field.enum !== undefined && !field.enum.includes(value)) {
				errors.push({ path, message: `Value not in enum: ${field.enum.join(', ')}` })
			}
			break

		case 'boolean':
			if (typeof value !== 'boolean') {
				errors.push({ path, message: `Expected boolean, got ${typeof value}` })
			}
			break

		case 'array':
			if (!Array.isArray(value)) {
				errors.push({ path, message: `Expected array, got ${typeof value}` })
				return errors
			}
			if (field.minLength !== undefined && value.length < field.minLength) {
				errors.push({ path, message: `Array too short (min ${field.minLength})` })
			}
			if (field.maxLength !== undefined && value.length > field.maxLength) {
				errors.push({ path, message: `Array too long (max ${field.maxLength})` })
			}
			if (field.items) {
				for (let i = 0; i < value.length; i++) {
					errors.push(...validateField(value[i], field.items, `${path}[${i}]`))
				}
			}
			break

		case 'object':
			if (typeof value !== 'object' || value === null || Array.isArray(value)) {
				errors.push({ path, message: `Expected object, got ${Array.isArray(value) ? 'array' : typeof value}` })
				return errors
			}
			if (field.properties) {
				const valueObj = value as Record<string, unknown>
				for (const [propKey, propField] of Object.entries(field.properties)) {
					errors.push(...validateField(valueObj[propKey], propField, `${path}.${propKey}`))
				}
			}
			break
	}

	return errors
}
