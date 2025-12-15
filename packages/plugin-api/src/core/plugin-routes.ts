/**
 * Plugin Route Registry
 *
 * Manages URL prefix mappings for plugin routes, enabling:
 * - Transparent prefix stripping at router level
 * - Plugin static asset serving
 * - Per-plugin API and static route prefixes
 */

import { existsSync } from 'node:fs'
import path from 'node:path'
import { logger } from './logger.js'

/**
 * Plugin prefix configuration - supports both simple string and granular object.
 *
 * Examples:
 * - `'/mock'` - Both API and static under /mock/* (exclusive by default)
 * - `{ api: '/mock-api', static: '/mock-static' }` - Separate prefixes
 * - `{ api: '/other', static: false }` - API prefixed, static at root
 * - `{ api: '/mock', exclusive: false }` - Both prefixed and non-prefixed routes work
 */
export type PluginPrefixConfig =
	| string
	| {
			api?: string | false
			static?: string | false
			/**
			 * Whether routes are ONLY accessible via the prefix (default: true).
			 * - `true`: Only `/mock/api/health` works, `/api/health` returns 404
			 * - `false`: Both `/mock/api/health` and `/api/health` work
			 */
			exclusive?: boolean
	  }

/**
 * Centralized plugin prefix configuration in @robojs/server config.
 *
 * Example:
 * ```typescript
 * // config/plugins/robojs/server.ts
 * export default {
 *   pluginPrefixes: {
 *     '@robojs/mock': '/mock',
 *     '@robojs/other': { api: '/api-prefix', static: false }
 *   }
 * }
 * ```
 */
export type PluginPrefixMap = Record<string, PluginPrefixConfig>

/**
 * Resolved plugin route configuration with normalized prefixes and asset info.
 */
export interface ResolvedPluginRoute {
	/** Plugin package name */
	name: string
	/** API route prefix (null if no prefix) */
	apiPrefix: string | null
	/** Static asset prefix (null if no prefix) */
	staticPrefix: string | null
	/** Path to plugin's public directory (null if none exists) */
	publicDir: string | null
	/** Whether routes are exclusive to the prefix (default: true) */
	exclusive: boolean
}

/**
 * Plugin Route Registry
 *
 * Centralizes plugin prefix management and provides utilities for:
 * - Matching incoming paths against plugin prefixes
 * - Stripping prefixes for transparent routing
 * - Resolving plugin static asset paths
 */
export class PluginRouteRegistry {
	private _plugins: Map<string, ResolvedPluginRoute> = new Map()
	private _apiPrefixes: Array<{ prefix: string; plugin: string }> = []
	private _staticPrefixes: Array<{ prefix: string; plugin: string }> = []

	/**
	 * Register plugins with their prefix configurations.
	 */
	public register(pluginPrefixes: PluginPrefixMap): void {
		for (const [pluginName, config] of Object.entries(pluginPrefixes)) {
			const resolved = this._resolveConfig(pluginName, config)
			this._plugins.set(pluginName, resolved)

			if (resolved.apiPrefix) {
				this._apiPrefixes.push({ prefix: resolved.apiPrefix, plugin: pluginName })
			}
			if (resolved.staticPrefix) {
				this._staticPrefixes.push({ prefix: resolved.staticPrefix, plugin: pluginName })
			}

			logger.debug(`Registered plugin ${pluginName}:`, {
				apiPrefix: resolved.apiPrefix,
				staticPrefix: resolved.staticPrefix,
				publicDir: resolved.publicDir,
				exclusive: resolved.exclusive
			})
		}

		// Sort prefixes by length (longest first) for correct matching
		this._apiPrefixes.sort((a, b) => b.prefix.length - a.prefix.length)
		this._staticPrefixes.sort((a, b) => b.prefix.length - a.prefix.length)
	}

	/**
	 * Get resolved config for a specific plugin.
	 */
	public getPlugin(name: string): ResolvedPluginRoute | undefined {
		return this._plugins.get(name)
	}

	/**
	 * Get all registered plugins.
	 */
	public getPlugins(): Map<string, ResolvedPluginRoute> {
		return this._plugins
	}

	/**
	 * Match a path against API prefixes and return the matching prefix.
	 * Returns null if no prefix matches.
	 */
	public matchApiPrefix(pathname: string): { prefix: string; plugin: string } | null {
		return this._matchPrefix(pathname, this._apiPrefixes)
	}

	/**
	 * Match a path against static prefixes and return the matching prefix.
	 * Returns null if no prefix matches.
	 */
	public matchStaticPrefix(pathname: string): { prefix: string; plugin: string } | null {
		return this._matchPrefix(pathname, this._staticPrefixes)
	}

	/**
	 * Strip a prefix from a path, returning the remaining path.
	 * Returns '/' if the path equals the prefix exactly.
	 */
	public stripPrefix(pathname: string, prefix: string): string {
		if (!pathname.startsWith(prefix)) {
			return pathname
		}
		const stripped = pathname.slice(prefix.length)
		return stripped.startsWith('/') ? stripped : '/' + stripped
	}

	/**
	 * Check if any plugins have static assets configured.
	 */
	public hasStaticPlugins(): boolean {
		return this._staticPrefixes.length > 0
	}

	/**
	 * Get the public directory path for a plugin.
	 * Returns null if the plugin has no public directory.
	 */
	public getPublicDir(pluginName: string): string | null {
		return this._plugins.get(pluginName)?.publicDir ?? null
	}

	/**
	 * Check if a plugin uses exclusive prefix mode.
	 * Returns true if the plugin exists and has exclusive=true (default).
	 */
	public isExclusive(pluginName: string): boolean {
		return this._plugins.get(pluginName)?.exclusive ?? true
	}

	/**
	 * Get all API prefixes with their plugin info.
	 * Used for route registration.
	 */
	public getApiPrefixes(): Array<{ prefix: string; plugin: string; exclusive: boolean }> {
		return this._apiPrefixes.map((p) => ({
			...p,
			exclusive: this._plugins.get(p.plugin)?.exclusive ?? true
		}))
	}

	private _matchPrefix(
		pathname: string,
		prefixes: Array<{ prefix: string; plugin: string }>
	): { prefix: string; plugin: string } | null {
		for (const entry of prefixes) {
			// Match exact prefix or prefix followed by /
			if (pathname === entry.prefix || pathname.startsWith(entry.prefix + '/')) {
				return entry
			}
		}
		return null
	}

	private _resolveConfig(pluginName: string, config: PluginPrefixConfig): ResolvedPluginRoute {
		let apiPrefix: string | null = null
		let staticPrefix: string | null = null
		let exclusive = true // Default to exclusive

		if (typeof config === 'string') {
			// Simple string: both API and static use the same prefix
			apiPrefix = this._normalizePrefix(config)
			staticPrefix = apiPrefix
		} else {
			// Object: separate API and static prefixes
			if (config.api !== false && config.api !== undefined) {
				apiPrefix = this._normalizePrefix(config.api)
			}
			if (config.static !== false && config.static !== undefined) {
				staticPrefix = this._normalizePrefix(config.static)
			}
			// Check for explicit exclusive setting
			if (config.exclusive !== undefined) {
				exclusive = config.exclusive
			}
		}

		// Detect plugin's public directory
		const publicDir = this._detectPublicDir(pluginName)

		return {
			name: pluginName,
			apiPrefix,
			staticPrefix,
			publicDir,
			exclusive
		}
	}

	private _normalizePrefix(prefix: string): string {
		// Ensure prefix starts with / and doesn't end with /
		let normalized = prefix.trim()
		if (!normalized.startsWith('/')) {
			normalized = '/' + normalized
		}
		if (normalized.endsWith('/') && normalized.length > 1) {
			normalized = normalized.slice(0, -1)
		}
		return normalized
	}

	private _detectPublicDir(pluginName: string): string | null {
		// In development: check node_modules/{plugin}/public
		// In production: check .robo/public/{plugin-namespace}
		const isProduction = process.env.NODE_ENV === 'production'

		if (isProduction) {
			// Production: assets are copied to .robo/public/{namespace}
			const namespace = this._getPluginNamespace(pluginName)
			const prodPath = path.join(process.cwd(), '.robo', 'public', namespace)
			if (existsSync(prodPath)) {
				return prodPath
			}
		} else {
			// Development: serve from node_modules
			const devPath = path.join(process.cwd(), 'node_modules', pluginName, 'public')
			if (existsSync(devPath)) {
				return devPath
			}
		}

		return null
	}

	private _getPluginNamespace(pluginName: string): string {
		// Convert @scope/name to scope-name or just name
		return pluginName.replace(/^@/, '').replace(/\//g, '-')
	}
}

/**
 * Global plugin route registry instance.
 */
let _registry: PluginRouteRegistry | null = null

/**
 * Get the global plugin route registry.
 * Creates a new instance if none exists.
 */
export function getPluginRouteRegistry(): PluginRouteRegistry {
	if (!_registry) {
		_registry = new PluginRouteRegistry()
	}
	return _registry
}

/**
 * Initialize the plugin route registry with prefix configuration.
 * Called during server startup.
 */
export function initPluginRoutes(pluginPrefixes?: PluginPrefixMap): PluginRouteRegistry {
	_registry = new PluginRouteRegistry()
	if (pluginPrefixes) {
		_registry.register(pluginPrefixes)
	}
	return _registry
}

/**
 * Reset the plugin route registry (for testing).
 */
export function resetPluginRouteRegistry(): void {
	_registry = null
}
