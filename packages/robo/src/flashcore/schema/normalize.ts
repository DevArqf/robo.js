/**
 * Flashcore v1 (spec rev 4.3) Schema Normalization
 *
 * Normalizes schema definitions into a consistent internal format.
 */

import { ValidationError as FlashcoreValidationError } from '../core/errors.js'
import { Field, RelationField } from './field.js'
import { computeSchemaChecksum } from './checksum.js'
import type {
	SchemaFields,
	NormalizedSchema,
	NormalizedField,
	FieldDef,
	RelationDef,
	CompoundUniqueConstraint
} from './types.js'

/**
 * Normalize a schema definition into internal format.
 *
 * Validates the schema structure and computes derived information
 * like required fields, unique fields, and indexed fields.
 *
 * @param schema - Raw schema definition from user
 * @returns Normalized schema for internal use
 * @throws FlashcoreValidationError if schema is invalid
 */
export function normalizeSchema(schema: SchemaFields): NormalizedSchema {
	const fields = new Map<string, NormalizedField>()
	const relations = new Map<string, RelationDef>()
	const uniqueFields: string[] = []
	const indexedFields: string[] = []
	const requiredFields: string[] = []
	const optionalFields: string[] = []
	const defaultFields = new Map<string, unknown | (() => unknown)>()
	const compoundUniques: CompoundUniqueConstraint[] = []

	let primaryKey: string | undefined

	for (const [name, field] of Object.entries(schema)) {
		// Handle compound unique constraints
		if (isCompoundUnique(field)) {
			compoundUniques.push(field)
			continue
		}

		// Validate field is a proper Field or RelationField
		if (!isField(field) && !isRelationField(field)) {
			throw new FlashcoreValidationError(
				`Invalid field definition for "${name}". Expected Field or RelationField.`,
				{ field: name }
			)
		}

		// Handle relation fields
		if (isRelationField(field)) {
			relations.set(name, field._def)
			continue
		}

		// Handle regular fields
		const def = field._def as FieldDef

		// Validate field definition
		validateFieldDef(name, def)

		// Create normalized field
		const normalizedField: NormalizedField = {
			name,
			type: def.type,
			optional: def.optional,
			unique: def.unique,
			indexed: def.indexed,
			indexTypes: def.indexTypes,
			primaryKey: def.primaryKey,
			version: def.version,
			hasDefault: def.hasDefault,
			default: def.default,
			enumValues: def.enumValues
		}

		fields.set(name, normalizedField)

		// Track primary key
		if (def.primaryKey) {
			if (primaryKey) {
				throw new FlashcoreValidationError(
					`Multiple primary keys defined: "${primaryKey}" and "${name}". Only one primary key is allowed.`,
					{ field: name }
				)
			}
			primaryKey = name
		}

		// Track unique fields
		if (def.unique) {
			uniqueFields.push(name)
		}

		// Track indexed fields
		if (def.indexed) {
			indexedFields.push(name)
		}

		// Track required vs optional
		if (def.optional || def.hasDefault) {
			optionalFields.push(name)
		} else if (!def.primaryKey) {
			// Primary key is auto-generated so not required from user
			requiredFields.push(name)
		}

		// Track default values
		if (def.hasDefault) {
			defaultFields.set(name, def.default)
		}
	}

	// Validate primary key exists
	if (!primaryKey) {
		throw new FlashcoreValidationError(
			'No primary key defined. Add `id: f.id()` or mark a field with `.primaryKey()`.'
		)
	}

	// Compute schema checksum
	const checksum = computeSchemaChecksum(schema)

	return {
		fields,
		primaryKey,
		uniqueFields,
		indexedFields,
		requiredFields,
		optionalFields,
		defaultFields,
		relations,
		compoundUniques,
		checksum
	}
}

/**
 * Validate a field definition.
 */
function validateFieldDef(name: string, def: FieldDef): void {
	// Validate enum has values
	if (def.type === 'enum' && (!def.enumValues || def.enumValues.length === 0)) {
		throw new FlashcoreValidationError(
			`Enum field "${name}" must have at least one value. Use f.enum(['value1', 'value2']).`,
			{ field: name }
		)
	}

	// Validate version field is number type
	if (def.version && def.type !== 'number') {
		throw new FlashcoreValidationError(
			`Version field "${name}" must be of type number.`,
			{ field: name }
		)
	}
}

/**
 * Type guard for Field instances.
 */
function isField(value: unknown): value is Field {
	return value instanceof Field ||
		(typeof value === 'object' && value !== null && '_def' in value && '_isRelation' in value && !(value as { _isRelation: boolean })._isRelation)
}

/**
 * Type guard for RelationField instances.
 */
function isRelationField(value: unknown): value is RelationField {
	return value instanceof RelationField ||
		(typeof value === 'object' && value !== null && '_def' in value && '_isRelation' in value && (value as { _isRelation: boolean })._isRelation)
}

/**
 * Type guard for compound unique constraints.
 */
function isCompoundUnique(value: unknown): value is CompoundUniqueConstraint {
	return typeof value === 'object' && value !== null && '_type' in value && (value as { _type: string })._type === 'compoundUnique'
}

/**
 * Apply default values to a record.
 *
 * @param data - Input data
 * @param schema - Normalized schema
 * @returns Data with defaults applied
 */
export function applyDefaults(
	data: Record<string, unknown>,
	schema: NormalizedSchema
): Record<string, unknown> {
	const result = { ...data }

	for (const [fieldName, defaultValue] of schema.defaultFields) {
		// Only apply default if field is not present
		if (!(fieldName in result) || result[fieldName] === undefined) {
			// If default is a factory function, invoke it
			if (typeof defaultValue === 'function') {
				result[fieldName] = (defaultValue as () => unknown)()
			} else {
				result[fieldName] = defaultValue
			}
		}
	}

	return result
}

/**
 * Normalize a record shape by:
 * - Removing undefined values
 * - Preserving null values
 * - Ensuring consistent field order
 *
 * @param record - Input record
 * @param schema - Normalized schema
 * @returns Normalized record
 */
export function normalizeRecordShape(
	record: Record<string, unknown>,
	schema: NormalizedSchema
): Record<string, unknown> {
	const result: Record<string, unknown> = {}

	// Process fields in schema order for consistency
	for (const fieldName of schema.fields.keys()) {
		const value = record[fieldName]
		// Omit undefined, preserve null
		if (value !== undefined) {
			result[fieldName] = value
		}
	}

	// Include primary key
	const pkValue = record[schema.primaryKey]
	if (pkValue !== undefined) {
		result[schema.primaryKey] = pkValue
	}

	return result
}

/**
 * Get field names that are unknown (not in schema).
 *
 * @param data - Input data
 * @param schema - Normalized schema
 * @returns Array of unknown field names
 */
export function getUnknownFields(
	data: Record<string, unknown>,
	schema: NormalizedSchema
): string[] {
	const unknown: string[] = []

	for (const key of Object.keys(data)) {
		if (!schema.fields.has(key) && !schema.relations.has(key)) {
			unknown.push(key)
		}
	}

	return unknown
}

/**
 * Get missing required fields.
 *
 * @param data - Input data
 * @param schema - Normalized schema
 * @returns Array of missing field names
 */
export function getMissingRequiredFields(
	data: Record<string, unknown>,
	schema: NormalizedSchema
): string[] {
	const missing: string[] = []

	for (const fieldName of schema.requiredFields) {
		// Check if field is present and not undefined
		if (!(fieldName in data) || data[fieldName] === undefined) {
			// If field has a default, it's not truly missing
			if (!schema.defaultFields.has(fieldName)) {
				missing.push(fieldName)
			}
		}
	}

	return missing
}
