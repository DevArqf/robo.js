/**
 * Configuration options for @robojs/dev plugin
 */
export interface DevPluginConfig {
	/**
	 * Modes where dev tools are active
	 * @default ['development']
	 */
	enabledModes?: string[]

	/**
	 * Discord channel ID for error forwarding
	 */
	debugChannelId?: string

	/**
	 * Role ID to ping on critical errors
	 */
	errorPingRoleId?: string

	/**
	 * Enable /dev commands
	 * @default true
	 */
	commands?: boolean

	/**
	 * Forward errors to debug channel
	 * @default true
	 */
	errorForwarding?: boolean
}
