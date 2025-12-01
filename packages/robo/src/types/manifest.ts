import type { SeedEnvVariableConfig } from './config.js'

/**
 * Seed environment variable configuration.
 */
export type ManifestSeedEnvVariables = Record<string, SeedEnvVariableConfig | string>

/**
 * Seed environment configuration.
 */
export interface ManifestSeedEnv {
	description?: string
	variables?: ManifestSeedEnvVariables
	hook?: string
}

/**
 * Seed configuration for a plugin.
 * Defines environment variables and setup logic.
 */
export interface ManifestSeed {
	description?: string
	env?: ManifestSeedEnv
	hook?: string
}

/**
 * Minimal plugin manifest info for seed operations.
 * Used during CLI operations (robo add) to seed files and env variables.
 *
 * This is NOT the runtime manifest. For runtime access, use the `Manifest` API:
 * - `Manifest.routes(namespace, route)` - Get handler entries
 * - `Manifest.hooks(hookType)` - Get lifecycle hooks
 * - `Manifest.config()` - Get project config
 * - `Manifest.seeds(pluginName)` - Get seed config
 * - `Manifest.project()` - Get project metadata
 */
export interface PluginManifestInfo {
	/** Source language of the plugin */
	language: 'javascript' | 'typescript'
	/** Seed configuration for the plugin */
	seed?: ManifestSeed
}

export default {}
