export default {
	cors: true,
	/**
	 * Plugin-declared default prefix for @robojs/mock routes.
	 * This makes mock routes accessible at /mock/* by default.
	 * Users can override this via pluginPrefixes in their server config.
	 */
	prefix: 'mock'
}
