import type { SessionConfig } from './index.js'

/**
 * Configuration options for the @robojs/mock plugin.
 *
 * These options can be set in your project's plugin configuration:
 * ```typescript
 * // config/plugins/robojs/mock.ts
 * export default {
 *   autoOpenStage: true,
 *   defaultSessionConfig: {
 *     guilds: [{ name: 'Test Server' }]
 *   }
 * }
 * ```
 */
export interface MockPluginConfig {
	/**
	 * Automatically open the Stage UI in the browser when running `robo mock`.
	 * Can be overridden with the `--no-browser` CLI flag.
	 * @default true
	 */
	autoOpenStage?: boolean

	/**
	 * Default session configuration used when running `robo mock`.
	 * Provides initial state for guilds, users, channels, etc.
	 */
	defaultSessionConfig?: SessionConfig

	/**
	 * Directory path for storing mock session data.
	 * Relative to the .robo directory.
	 * @default 'mock'
	 */
	dataDirectory?: string
}

/**
 * Default plugin configuration values.
 */
export const DEFAULT_MOCK_PLUGIN_CONFIG: Required<MockPluginConfig> = {
	autoOpenStage: true,
	defaultSessionConfig: {
		guilds: [
			{
				name: 'Test Server',
				channels: [
					{ name: 'general', type: 0 },
					{ name: 'bot-commands', type: 0 }
				]
			}
		]
	},
	dataDirectory: 'mock'
}
