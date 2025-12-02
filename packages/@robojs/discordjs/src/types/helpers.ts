/**
 * Type helper utilities for configuration inference.
 *
 * These utilities enable TypeScript to properly infer option types from configs,
 * providing a better developer experience with full type safety.
 */
import type { CommandConfig, CommandOptionTypes } from './commands.js'
import type { ContextConfig } from './context.js'

/**
 * Extracts the literal `value` type from a single choice entry.
 * Example: { name: 'Red', value: 'red' } -> 'red'
 */
export type ChoiceValueOf<C> = C extends { value: infer V } ? V : never

/**
 * For an option `K`, produces a union of all `choices[].value` literals.
 * If no choices are declared, results in `never`.
 * Example: choices: [{value:'red'},{value:'blue'}] -> 'red' | 'blue'
 */
export type ChoiceUnionOfOption<K> = K extends { choices: readonly (infer C)[] } ? ChoiceValueOf<C> : never

/**
 * Gets the discriminant "type name" of an option `K`.
 * If `type` is omitted, we default to `'string'` (matching Discord.js behavior).
 */
export type TypeNameOfOption<K> = K extends { type: infer T }
	? T extends keyof CommandOptionTypes
		? T
		: 'string'
	: 'string'

/**
 * Maps an option's discriminant type to its runtime value via `CommandOptionTypes`.
 * Example: 'user' -> User, 'channel' -> GuildBasedChannel, 'integer' -> number
 */
export type BaseValueOfOption<K> = CommandOptionTypes[TypeNameOfOption<K>]

/**
 * The final value type for an option `K`.
 * - For choosable primitives (`'string' | 'number' | 'integer'`), if choices exist,
 *   we replace the base value with the literal union of `choices[].value`.
 * - For all other types (user, role, channel, etc.), we keep the base value.
 */
export type ValueOfOption<K> = TypeNameOfOption<K> extends 'string' | 'number' | 'integer'
	? [ChoiceUnionOfOption<K>] extends [never]
		? BaseValueOfOption<K>
		: ChoiceUnionOfOption<K>
	: BaseValueOfOption<K>

/**
 * Ensures the config only contains valid CommandConfig properties.
 */
export type ExactConfig<C extends CommandConfig> = {
	[K in keyof C]: K extends keyof CommandConfig ? C[K] : never
}

/**
 * Enforces that no extra properties exist beyond CommandConfig.
 * Returns an error message type if extra properties are found.
 */
export type EnforceConfig<C extends CommandConfig> = Exclude<keyof C, keyof CommandConfig> extends never
	? C
	: 'Extra properties are not allowed in CommandConfig'

/**
 * Ensures the config only contains valid ContextConfig properties.
 */
export type ExactContextConfig<C extends ContextConfig> = {
	[K in keyof C]: K extends keyof ContextConfig ? C[K] : never
}

/**
 * Enforces that no extra properties exist beyond ContextConfig.
 * Returns an error message type if extra properties are found.
 */
export type EnforceContextConfig<C extends ContextConfig> = Exclude<keyof C, keyof ContextConfig> extends never
	? C
	: 'Extra properties are not allowed in ContextConfig'
