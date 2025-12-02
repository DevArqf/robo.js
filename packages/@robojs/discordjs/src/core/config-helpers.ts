/**
 * Configuration helper functions for Discord commands and context menus.
 *
 * These helpers provide type-safe ways to create configurations
 * with full TypeScript inference.
 */
import type { CommandConfig, ContextConfig, SmartCommandConfig, SmartContextConfig } from '../types/index.js'

/**
 * Creates a command configuration with proper type inference.
 * This is a type-safe identity function that helps TypeScript infer option types.
 *
 * @example
 * ```ts
 * import { createCommandConfig } from '@robojs/discordjs'
 *
 * export const config = createCommandConfig({
 *   description: 'Greet someone',
 *   options: [
 *     { name: 'user', type: 'user', required: true },
 *     { name: 'message', type: 'string' }
 *   ]
 * })
 *
 * // TypeScript knows: options.user is User, options.message is string | undefined
 * export default (interaction, options) => {
 *   return `Hello ${options.user.username}! ${options.message ?? 'Welcome!'}`
 * }
 * ```
 *
 * @example
 * ```ts
 * // With choices - TypeScript infers literal types
 * export const config = createCommandConfig({
 *   description: 'Pick a color',
 *   options: [
 *     {
 *       name: 'color',
 *       type: 'string',
 *       required: true,
 *       choices: [
 *         { name: 'Red', value: 'red' },
 *         { name: 'Blue', value: 'blue' }
 *       ]
 *     }
 *   ]
 * })
 *
 * // TypeScript knows: options.color is 'red' | 'blue'
 * export default (interaction, options) => {
 *   if (options.color === 'red') {
 *     return 'You picked red!'
 *   }
 *   return 'You picked blue!'
 * }
 * ```
 *
 * @param config - The command configuration object
 * @returns The same configuration with inferred types
 */
export function createCommandConfig<C extends CommandConfig>(config: SmartCommandConfig<C>): C {
	return config as C
}

/**
 * Creates a context menu configuration with proper type validation.
 * This is a type-safe identity function that helps TypeScript validate config properties.
 *
 * @example
 * ```ts
 * import { createContextConfig } from '@robojs/discordjs'
 *
 * // User context menu
 * export const config = createContextConfig({
 *   description: 'Get user info'
 * })
 *
 * export default (interaction, user) => {
 *   return `User: ${user.username} (${user.id})`
 * }
 * ```
 *
 * @example
 * ```ts
 * // Message context menu with permissions
 * export const config = createContextConfig({
 *   description: 'Pin this message',
 *   defaultMemberPermissions: 'ManageMessages',
 *   contexts: ['Guild']
 * })
 *
 * export default async (interaction, message) => {
 *   await message.pin()
 *   return 'Message pinned!'
 * }
 * ```
 *
 * @param config - The context menu configuration object
 * @returns The same configuration with validated types
 */
export function createContextConfig<C extends ContextConfig>(config: SmartContextConfig<C>): C {
	return config as C
}
