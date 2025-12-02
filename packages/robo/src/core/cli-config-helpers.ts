/**
 * Configuration helper functions for CLI commands.
 *
 * These helpers provide type-safe ways to create configurations
 * with full TypeScript inference.
 */
import type { CliCommandConfig, SmartCliCommandConfig } from '../types/cli.js'

/**
 * Creates a CLI command configuration with proper type inference.
 * This is a type-safe identity function that helps TypeScript infer option types.
 *
 * @example
 * ```ts
 * import { createCliCommandConfig, type CliContext } from 'robo.js/cli.js'
 *
 * export const config = createCliCommandConfig({
 *   description: 'Start the development server',
 *   options: [
 *     { alias: '-p', name: '--port', description: 'Port number', type: 'number', default: 3000 },
 *     { alias: '-h', name: '--host', description: 'Host address', type: 'string' },
 *     { alias: '-v', name: '--verbose', description: 'Verbose output', type: 'boolean', required: true }
 *   ]
 * } as const)
 *
 * // TypeScript knows:
 * // - options.port is number (has default)
 * // - options.host is string | undefined (optional)
 * // - options.verbose is boolean (required)
 * export default function myCommand(ctx: CliContext<typeof config>) {
 *   const { port, host, verbose } = ctx.options
 *   // Full type safety!
 * }
 * ```
 *
 * @param config - The CLI command configuration object
 * @returns The same configuration with inferred types
 */
export function createCliCommandConfig<C extends CliCommandConfig>(config: SmartCliCommandConfig<C>): C {
	return config as C
}
