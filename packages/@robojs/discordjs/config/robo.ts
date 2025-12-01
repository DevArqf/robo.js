import type { Config } from 'robo.js'

/**
 * Plugin configuration for @robojs/discordjs
 *
 * The namespace 'discordjs' is used for portal access:
 * - portal.discordjs.commands
 * - portal.discordjs.events
 * - portal.discordjs.context
 */
export default <Config>{
	// Portal namespace for all routes in this plugin
	namespace: 'discordjs',

	// Mark this as a plugin package
	type: 'plugin'
}
