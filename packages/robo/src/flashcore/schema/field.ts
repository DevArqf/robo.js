/**
 * Flashcore v1 (spec rev 4.3) Schema Field Builders
 *
 * Provides fluent API for defining model schema fields.
 */

import type {
	FieldDef,
	FieldType,
	RelationDef,
	RelationType,
	OnDeleteAction,
	CompoundUniqueConstraint
} from './types.js'

/**
 * Field builder class with fluent modifiers.
 */
export class Field<
	Type extends FieldType = FieldType,
	Optional extends boolean = false,
	Custom = unknown
> {
	readonly _def: FieldDef
	readonly _isRelation = false as const

	constructor(type: Type) {
		this._def = {
			type,
			optional: false as Optional,
			unique: false,
			indexed: false,
			indexTypes: [],
			primaryKey: false,
			version: false,
			hasDefault: false,
			default: undefined,
			enumValues: undefined
		}
	}

	/**
	 * Mark this field as the primary key.
	 */
	primaryKey(): this {
		this._def.primaryKey = true
		return this
	}

	/**
	 * Mark this field as unique (creates unique constraint).
	 */
	unique(): this {
		this._def.unique = true
		return this
	}

	/**
	 * Mark this field as indexed (creates sorted index).
	 */
	indexed(): this {
		this._def.indexed = true
		return this
	}

	/**
	 * Mark this field with custom index type(s).
	 */
	indexedWith(type: string | string[]): this {
		this._def.indexed = true
		if (Array.isArray(type)) {
			this._def.indexTypes.push(...type)
		} else {
			this._def.indexTypes.push(type)
		}
		return this
	}

	/**
	 * Mark this field as optional.
	 */
	optional(): Field<Type, true, Custom> {
		this._def.optional = true
		return this as unknown as Field<Type, true, Custom>
	}

	/**
	 * Set a default value for this field.
	 * Can be a static value or a factory function.
	 */
	default(value: InferType<Type, Custom> | (() => InferType<Type, Custom>)): this {
		this._def.hasDefault = true
		this._def.default = value
		return this
	}

	/**
	 * Mark this field as a version field for optimistic locking.
	 */
	version(): this {
		this._def.version = true
		return this
	}

	/**
	 * Set allowed enum values (for enum type).
	 */
	values<T extends string>(values: T[]): this {
		this._def.enumValues = values
		return this
	}
}

/**
 * Helper type to infer runtime type from field type.
 */
type InferType<T extends FieldType, Custom = unknown> =
	T extends 'string' ? string :
	T extends 'number' ? number :
	T extends 'boolean' ? boolean :
	T extends 'date' ? Date :
	T extends 'json' ? Custom :
	T extends 'enum' ? string :
	never

/**
 * Relation field builder for model relationships.
 */
export class RelationField {
	readonly _def: RelationDef
	readonly _isRelation = true as const

	constructor(
		type: RelationType,
		model: string,
		foreignKey?: string
	) {
		this._def = {
			type,
			model,
			foreignKey,
			onDelete: 'restrict'
		}
	}

	/**
	 * Set the delete behavior for this relation.
	 */
	onDelete(action: OnDeleteAction): this {
		this._def.onDelete = action
		return this
	}
}

/**
 * Create a compound unique constraint across multiple fields.
 */
export function compoundUnique(fields: string[]): CompoundUniqueConstraint {
	return {
		_type: 'compoundUnique',
		fields
	}
}

/**
 * Field builder factory object.
 *
 * Usage:
 * ```typescript
 * const schema = {
 *   id: f.id(),
 *   name: f.string(),
 *   age: f.number().optional(),
 *   email: f.string().unique(),
 *   createdAt: f.date().default(() => new Date()),
 * }
 * ```
 */
export const f = {
	/**
	 * Create an ID field (string, primary key).
	 */
	id: () => new Field('string').primaryKey(),

	/**
	 * Create a string field.
	 */
	string: () => new Field('string'),

	/**
	 * Create a number field.
	 */
	number: () => new Field('number'),

	/**
	 * Create a boolean field.
	 */
	boolean: () => new Field('boolean'),

	/**
	 * Create a date field.
	 */
	date: () => new Field('date'),

	/**
	 * Create a JSON field with optional type parameter.
	 */
	json: <T = unknown>() => new Field<'json', false, T>('json'),

	/**
	 * Create an enum field with allowed values.
	 */
	enum: <T extends string>(values: T[]) => new Field('enum').values(values),

	/**
	 * Create a belongs-to relation (many-to-one, stores FK locally).
	 */
	relation: (model: string, foreignKey: string) =>
		new RelationField('belongsTo', model, foreignKey),

	/**
	 * Create a has-many relation (one-to-many inverse).
	 */
	hasMany: (model: string, opts: { foreignKey: string }) =>
		new RelationField('hasMany', model, opts.foreignKey),

	/**
	 * Create a has-one relation (one-to-one inverse).
	 */
	hasOne: (model: string, opts: { foreignKey: string }) =>
		new RelationField('hasOne', model, opts.foreignKey),

	/**
	 * Create a many-to-many relation (implicit junction table).
	 */
	manyToMany: (model: string) =>
		new RelationField('manyToMany', model)
}

export type { FieldDef, RelationDef, FieldType, RelationType, OnDeleteAction }
