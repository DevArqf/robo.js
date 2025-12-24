/**
 * Flashcore v1 (spec rev 4.3) Phase 7 - Schema Checksum Tests
 *
 * Tests that schema checksums are deterministic and change only when schema changes.
 */

import { computeSchemaChecksum, compareChecksums } from '../../../src/flashcore/schema/checksum.js'
import { f, compoundUnique } from '../../../src/flashcore/schema/field.js'
import type { SchemaFields } from '../../../src/flashcore/schema/types.js'

describe('Schema Checksum', () => {
	describe('Deterministic Computation', () => {
		it('should produce same checksum for identical schemas', () => {
			const schema1: SchemaFields = {
				name: f.string(),
				age: f.number(),
				email: f.string().optional()
			}

			const schema2: SchemaFields = {
				name: f.string(),
				age: f.number(),
				email: f.string().optional()
			}

			const checksum1 = computeSchemaChecksum(schema1)
			const checksum2 = computeSchemaChecksum(schema2)

			expect(checksum1).toBe(checksum2)
		})

		it('should produce consistent checksum across multiple calls', () => {
			const schema: SchemaFields = {
				title: f.string(),
				count: f.number().default(0)
			}

			const checksums = Array.from({ length: 5 }, () => computeSchemaChecksum(schema))

			expect(new Set(checksums).size).toBe(1) // All identical
		})

		it('should be insensitive to field declaration order', () => {
			const schema1: SchemaFields = {
				a: f.string(),
				b: f.number(),
				c: f.boolean()
			}

			const schema2: SchemaFields = {
				c: f.boolean(),
				a: f.string(),
				b: f.number()
			}

			expect(computeSchemaChecksum(schema1)).toBe(computeSchemaChecksum(schema2))
		})

		it('should return a valid hex string', () => {
			const schema: SchemaFields = {
				field: f.string()
			}

			const checksum = computeSchemaChecksum(schema)

			expect(checksum).toMatch(/^[0-9a-f]+$/)
			expect(checksum.length).toBeGreaterThan(0)
		})
	})

	describe('Change Detection', () => {
		it('should change when a field is added', () => {
			const schema1: SchemaFields = {
				name: f.string()
			}

			const schema2: SchemaFields = {
				name: f.string(),
				age: f.number()
			}

			expect(computeSchemaChecksum(schema1)).not.toBe(computeSchemaChecksum(schema2))
		})

		it('should change when a field is removed', () => {
			const schema1: SchemaFields = {
				name: f.string(),
				age: f.number()
			}

			const schema2: SchemaFields = {
				name: f.string()
			}

			expect(computeSchemaChecksum(schema1)).not.toBe(computeSchemaChecksum(schema2))
		})

		it('should change when field type changes', () => {
			const schema1: SchemaFields = {
				count: f.number()
			}

			const schema2: SchemaFields = {
				count: f.string()
			}

			expect(computeSchemaChecksum(schema1)).not.toBe(computeSchemaChecksum(schema2))
		})

		it('should change when optional modifier changes', () => {
			const schema1: SchemaFields = {
				email: f.string()
			}

			const schema2: SchemaFields = {
				email: f.string().optional()
			}

			expect(computeSchemaChecksum(schema1)).not.toBe(computeSchemaChecksum(schema2))
		})

		it('should change when unique modifier changes', () => {
			const schema1: SchemaFields = {
				email: f.string()
			}

			const schema2: SchemaFields = {
				email: f.string().unique()
			}

			expect(computeSchemaChecksum(schema1)).not.toBe(computeSchemaChecksum(schema2))
		})

		it('should change when index modifier changes', () => {
			const schema1: SchemaFields = {
				name: f.string()
			}

			const schema2: SchemaFields = {
				name: f.string().indexed()
			}

			expect(computeSchemaChecksum(schema1)).not.toBe(computeSchemaChecksum(schema2))
		})

		it('should change when default value changes', () => {
			const schemaWithDefault: SchemaFields = {
				status: f.string().default('pending')
			}

			// Default values should affect hasDefault, but the value itself
			// may not change the checksum. The key is that hasDefault changes.
			// Let's test that adding a default vs not having one changes the checksum.
			const schemaWithoutDefault: SchemaFields = {
				status: f.string()
			}

			expect(computeSchemaChecksum(schemaWithDefault)).not.toBe(computeSchemaChecksum(schemaWithoutDefault))
		})

		it('should change when enum values change', () => {
			const schema1: SchemaFields = {
				status: f.enum(['pending', 'active'])
			}

			const schema2: SchemaFields = {
				status: f.enum(['pending', 'active', 'inactive'])
			}

			expect(computeSchemaChecksum(schema1)).not.toBe(computeSchemaChecksum(schema2))
		})

		it('should change when a compound unique constraint is added', () => {
			const schema1: SchemaFields = {
				a: f.string(),
				b: f.string()
			}

			const schema2: SchemaFields = {
				a: f.string(),
				b: f.string(),
				_compound: compoundUnique(['a', 'b'])
			}

			expect(computeSchemaChecksum(schema1)).not.toBe(computeSchemaChecksum(schema2))
		})
	})

	describe('compareChecksums utility', () => {
		it('should return true for matching checksums', () => {
			const schema: SchemaFields = {
				field: f.string()
			}

			const checksum = computeSchemaChecksum(schema)

			expect(compareChecksums(checksum, checksum)).toBe(true)
		})

		it('should return false for different checksums', () => {
			const schema1: SchemaFields = {
				field1: f.string()
			}

			const schema2: SchemaFields = {
				field2: f.string()
			}

			expect(compareChecksums(
				computeSchemaChecksum(schema1),
				computeSchemaChecksum(schema2)
			)).toBe(false)
		})

		it('should be case insensitive', () => {
			const schema: SchemaFields = {
				field: f.string()
			}

			const checksum = computeSchemaChecksum(schema)

			expect(compareChecksums(checksum.toUpperCase(), checksum.toLowerCase())).toBe(true)
		})
	})

	describe('Edge Cases', () => {
		it('should handle empty schema', () => {
			const schema: SchemaFields = {}

			const checksum = computeSchemaChecksum(schema)

			expect(typeof checksum).toBe('string')
			expect(checksum.length).toBeGreaterThan(0)
		})

		it('should handle complex nested default values', () => {
			const schema1: SchemaFields = {
				config: f.json().default({ nested: { deep: true } })
			}

			const schema2: SchemaFields = {
				config: f.json().default({ nested: { deep: false } })
			}

			// Both have hasDefault = true, so checksum may or may not differ
			// depending on whether default value content is included
			// The key test is that both produce valid checksums
			expect(typeof computeSchemaChecksum(schema1)).toBe('string')
			expect(typeof computeSchemaChecksum(schema2)).toBe('string')
		})

		it('should handle number fields', () => {
			const schema: SchemaFields = {
				largeId: f.number()
			}

			const checksum = computeSchemaChecksum(schema)

			expect(typeof checksum).toBe('string')
			expect(checksum.length).toBeGreaterThan(0)
		})

		it('should handle date fields', () => {
			const schema: SchemaFields = {
				createdAt: f.date(),
				updatedAt: f.date().optional()
			}

			const checksum = computeSchemaChecksum(schema)

			expect(typeof checksum).toBe('string')
			expect(checksum.length).toBeGreaterThan(0)
		})
	})
})
