/**
 * Flashcore v1 (spec rev 4.3) Relation Validation
 *
 * Foreign key validation and relation schema validation.
 */

import type { NormalizedSchema, RelationDef } from '../schema/types.js'
import type { RelationValidationError } from './types.js'
import { FlashcoreError, ValidationError } from '../core/errors.js'

/**
 * Validate that a foreign key points to an existing record.
 *
 * @param modelName - Source model name (for error messages)
 * @param fkField - Foreign key field name
 * @param fkValue - Foreign key value (target record ID)
 * @param targetModel - Target model to look up
 * @param getModel - Function to get model instance by name
 * @throws ValidationError if the referenced record doesn't exist
 */
export async function validateForeignKey(
	modelName: string,
	fkField: string,
	fkValue: string | null | undefined,
	targetModel: string,
	getModel: (name: string) => unknown | undefined
): Promise<void> {
	// Null/undefined FK is allowed for optional relations
	if (fkValue === null || fkValue === undefined) {
		return
	}

	const model = getModel(targetModel) as {
		findUnique: (args: { where: { id: string } }) => Promise<unknown | null>
	} | undefined

	if (!model) {
		throw new FlashcoreError(
			`Cannot validate FK '${fkField}' in '${modelName}': ` +
			`target model '${targetModel}' not found.`
		)
	}

	const record = await model.findUnique({ where: { id: fkValue } })

	if (!record) {
		throw new ValidationError(
			`Foreign key constraint failed: '${modelName}.${fkField}' references ` +
			`non-existent '${targetModel}' record with id '${fkValue}'.`,
			{
				field: fkField,
				value: fkValue
			}
		)
	}
}

/**
 * Validate all foreign keys in a record's data.
 *
 * @param modelName - Model name
 * @param schema - Normalized schema
 * @param data - Record data being created/updated
 * @param getModel - Function to get model instance by name
 * @param updatedFields - Set of fields being updated (for update validation)
 */
export async function validateForeignKeys(
	modelName: string,
	schema: NormalizedSchema,
	data: Record<string, unknown>,
	getModel: (name: string) => unknown | undefined,
	updatedFields?: Set<string>
): Promise<void> {
	const validations: Promise<void>[] = []

	for (const [, relation] of schema.relations) {
		// For belongsTo relations, validate the FK field exists in target
		if (relation.type === 'belongsTo' && relation.foreignKey) {
			const fkValue = data[relation.foreignKey]

			// If updating, only validate if the FK field is being updated
			if (updatedFields && !updatedFields.has(relation.foreignKey)) {
				continue
			}

			// Only validate if the FK field is in the data
			if (relation.foreignKey in data) {
				validations.push(
					validateForeignKey(
						modelName,
						relation.foreignKey,
						fkValue as string | null | undefined,
						relation.model,
						getModel
					)
				)
			}
		}
	}

	// Run all validations in parallel
	await Promise.all(validations)
}

/**
 * Check if a field is a foreign key for a relation.
 *
 * @param schema - Normalized schema
 * @param fieldName - Field name to check
 * @returns Relation definition if it's a FK, undefined otherwise
 */
export function getForeignKeyRelation(
	schema: NormalizedSchema,
	fieldName: string
): RelationDef | undefined {
	for (const relation of schema.relations.values()) {
		if (relation.type === 'belongsTo' && relation.foreignKey === fieldName) {
			return relation
		}
	}
	return undefined
}

/**
 * Validate relation schema definitions at build/registration time.
 * Checks that:
 * - Target model exists
 * - Foreign key field exists in the appropriate model
 * - Foreign key field is indexed (warning if not)
 *
 * @param models - Map of model name to normalized schema
 * @returns Array of validation errors
 */
export function validateRelationsSchema(
	models: Map<string, NormalizedSchema>
): RelationValidationError[] {
	const errors: RelationValidationError[] = []

	for (const [modelName, schema] of models) {
		// Track manyToMany target models so we can surface ambiguous duplicates.
		// Without additional metadata (relation name / explicit junction config),
		// multiple manyToMany fields to the same target would be indistinguishable.
		const seenManyToManyTargets = new Map<string, string>() // targetModel -> fieldName

		for (const [fieldName, relation] of schema.relations) {
			if (relation.type === 'manyToMany') {
				const previousField = seenManyToManyTargets.get(relation.model)
				if (previousField) {
					errors.push({
						model: modelName,
						field: fieldName,
						message:
							`Duplicate manyToMany relation to '${relation.model}' found. ` +
							`Fields '${previousField}' and '${fieldName}' would share the same junction table.`,
						suggestion:
							'Remove one relation field or use an explicit junction model for multiple distinct relationships.',
						level: 'error'
					})
				} else {
					seenManyToManyTargets.set(relation.model, fieldName)
				}
			}

			// Check target model exists
			const targetSchema = models.get(relation.model)
			if (!targetSchema) {
				const suggestion = findSimilarModelName(relation.model, models)
				errors.push({
					model: modelName,
					field: fieldName,
					message: `Target model '${relation.model}' does not exist`,
					suggestion: suggestion
						? `Did you mean '${suggestion}'?`
						: undefined,
					level: 'error'
				})
				continue
			}

			// For hasMany/hasOne, check FK exists in target model
			if (relation.type === 'hasMany' || relation.type === 'hasOne') {
				if (!relation.foreignKey) {
					errors.push({
						model: modelName,
						field: fieldName,
						message: `Foreign key is required for ${relation.type} relation`,
						suggestion: `Use f.${relation.type}('${relation.model}', { foreignKey: '${modelName}Id' })`,
						level: 'error'
					})
					continue
				}

				const targetField = targetSchema.fields.get(relation.foreignKey)
				if (!targetField) {
					errors.push({
						model: modelName,
						field: fieldName,
						message: `Foreign key '${relation.foreignKey}' not found in model '${relation.model}'`,
						suggestion: `Add '${relation.foreignKey}: f.string().indexed()' to ${relation.model} schema`,
						level: 'error'
					})
					continue
				}

				// Warn if FK is not indexed (performance issue)
				if (!targetField.indexed) {
					errors.push({
						model: modelName,
						field: fieldName,
						message: `Foreign key '${relation.foreignKey}' in '${relation.model}' should be indexed for query performance`,
						suggestion: `Change to '${relation.foreignKey}: f.string().indexed()'`,
						level: 'warning'
					})
				}
			}

			// For belongsTo, check FK field exists locally
			if (relation.type === 'belongsTo') {
				if (!relation.foreignKey) {
					errors.push({
						model: modelName,
						field: fieldName,
						message: `Foreign key is required for belongsTo relation`,
						suggestion: `Use f.relation('${relation.model}', '${relation.model}Id')`,
						level: 'error'
					})
					continue
				}

				const localField = schema.fields.get(relation.foreignKey)
				if (!localField) {
					errors.push({
						model: modelName,
						field: fieldName,
						message: `Foreign key '${relation.foreignKey}' not found in this model`,
						suggestion: `Add '${relation.foreignKey}: f.string().indexed()' before the relation field`,
						level: 'error'
					})
					continue
				}

				// Warn if FK is not indexed
				if (!localField.indexed) {
					errors.push({
						model: modelName,
						field: fieldName,
						message: `Foreign key '${relation.foreignKey}' should be indexed for query performance`,
						suggestion: `Change to '${relation.foreignKey}: f.string().indexed()'`,
						level: 'warning'
					})
				}
			}

			// For manyToMany, no FK validation needed (junction table is auto-managed)
		}
	}

	return errors
}

/**
 * Find a similar model name using Levenshtein distance.
 */
function findSimilarModelName(
	target: string,
	models: Map<string, unknown>
): string | undefined {
	let bestMatch: string | undefined
	let bestDistance = Infinity

	for (const name of models.keys()) {
		const distance = levenshteinDistance(target.toLowerCase(), name.toLowerCase())
		if (distance < bestDistance && distance <= 3) {
			bestDistance = distance
			bestMatch = name
		}
	}

	return bestMatch
}

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
	const matrix: number[][] = []

	for (let i = 0; i <= b.length; i++) {
		matrix[i] = [i]
	}

	for (let j = 0; j <= a.length; j++) {
		matrix[0][j] = j
	}

	for (let i = 1; i <= b.length; i++) {
		for (let j = 1; j <= a.length; j++) {
			if (b.charAt(i - 1) === a.charAt(j - 1)) {
				matrix[i][j] = matrix[i - 1][j - 1]
			} else {
				matrix[i][j] = Math.min(
					matrix[i - 1][j - 1] + 1, // substitution
					matrix[i][j - 1] + 1,     // insertion
					matrix[i - 1][j] + 1      // deletion
				)
			}
		}
	}

	return matrix[b.length][a.length]
}

/**
 * Get all relations that require FK validation on create.
 */
export function getRelationsRequiringFKValidation(
	schema: NormalizedSchema
): Map<string, RelationDef> {
	const result = new Map<string, RelationDef>()

	for (const [fieldName, relation] of schema.relations) {
		if (relation.type === 'belongsTo' && relation.foreignKey) {
			result.set(fieldName, relation)
		}
	}

	return result
}

/**
 * Check if any fields being updated are foreign keys.
 */
export function hasUpdatedForeignKeys(
	schema: NormalizedSchema,
	updatedFields: Set<string>
): boolean {
	for (const relation of schema.relations.values()) {
		if (relation.type === 'belongsTo' && relation.foreignKey) {
			if (updatedFields.has(relation.foreignKey)) {
				return true
			}
		}
	}
	return false
}
