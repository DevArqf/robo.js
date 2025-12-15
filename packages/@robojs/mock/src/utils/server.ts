import { getPluginOptions, Manifest } from 'robo.js'

/**
 * Server configuration interface from @robojs/server
 */
interface ServerPluginConfig {
	port?: number
	hostname?: string
	pluginPrefixes?: Record<string, string | { api?: string; static?: string; exclusive?: boolean }>
}

/**
 * Gets the @robojs/server plugin configuration.
 * Falls back to environment variables and defaults.
 */
export function getServerConfig(): ServerPluginConfig {
	return (getPluginOptions('@robojs/server') as ServerPluginConfig) ?? {}
}

/**
 * Gets the configured port for the mock server.
 * Priority: plugin config > PORT env > 3000
 */
export function getServerPort(): number {
	const config = getServerConfig()
	return config.port ?? parseInt(process.env.PORT ?? '3000', 10)
}

/**
 * Gets the configured hostname for the mock server.
 * Priority: plugin config > ROBO_HOSTNAME env > 'localhost'
 */
export function getServerHostname(): string {
	const config = getServerConfig()
	return config.hostname ?? process.env.ROBO_HOSTNAME ?? 'localhost'
}

/**
 * Gets the base URL for the mock server (without any path).
 * @example 'http://localhost:3000'
 */
export function getMockServerUrl(): string {
	const port = getServerPort()
	const hostname = getServerHostname()
	return `http://${hostname}:${port}`
}

/**
 * Gets the REST API URL for the mock server.
 * @example 'http://localhost:3000/api'
 */
export function getMockRestApiUrl(): string {
	return `${getMockServerUrl()}/api`
}

/**
 * Gets the plugin prefix for @robojs/mock.
 *
 * Resolution order (highest to lowest priority):
 * 1. User's explicit `pluginPrefixes['@robojs/mock']` in server config
 * 2. Plugin's declared `prefix` from manifest (pre-computed at build)
 * 3. Empty string (no prefix)
 */
export function getMockPluginPrefix(): string {
	// Check user's explicit pluginPrefixes config first
	const config = getServerConfig()
	const userPrefix = config.pluginPrefixes?.['@robojs/mock']

	if (userPrefix) {
		if (typeof userPrefix === 'string') {
			return userPrefix
		}
		// Use static prefix for Stage UI (it's a static asset)
		if (userPrefix.static) {
			return userPrefix.static
		}
	}

	// Fall back to plugin's declared prefix from manifest
	try {
		const mockPlugin = Manifest.plugin('@robojs/mock')
		if (mockPlugin?.prefix) {
			const prefix = mockPlugin.prefix
			return prefix.startsWith('/') ? prefix : `/${prefix}`
		}
	} catch {
		// Manifest may not be available
	}

	return ''
}

/**
 * Gets the Stage UI URL for a given session token.
 * Automatically handles plugin prefix configuration.
 *
 * Note: Uses trailing slash on /stage/ so relative asset paths resolve correctly.
 * Without trailing slash: /mock/stage + ./assets/foo.js = /mock/assets/foo.js (wrong)
 * With trailing slash: /mock/stage/ + ./assets/foo.js = /mock/stage/assets/foo.js (correct)
 *
 * @param sessionToken - The session token (e.g., 'mock:sess_xxx')
 * @returns The full Stage UI URL
 * @example 'http://localhost:3000/stage/?token=mock%3Asess_xxx'
 */
export function getStageUIUrl(sessionToken: string): string {
	const baseUrl = getMockServerUrl()
	const prefix = getMockPluginPrefix()
	const encodedToken = encodeURIComponent(sessionToken)

	// Trailing slash is required for relative asset paths to resolve correctly
	return `${baseUrl}${prefix}/stage/?token=${encodedToken}`
}
