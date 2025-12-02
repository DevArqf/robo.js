import type { Config } from 'robo.js'

/**
 * Plugin configuration for @robojs/cli
 *
 * The namespace 'cli' is used for portal access:
 * - portal.cli.cli
 */
export default <Config>{
	// Portal namespace for all routes in this plugin
	namespace: 'cli',

	// Mark this as a plugin package
	type: 'plugin'
}
