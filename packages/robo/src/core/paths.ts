/**
 * Centralized Path Management for .robo/ directories.
 *
 * Provides type-safe, mode-aware path resolution for build outputs,
 * manifests, types, and plugin directories.
 */

import path from 'node:path'

/**
 * Context provided to dynamic buildDirectory functions.
 */
export interface BuildDirectoryContext {
	/** The current mode (e.g., 'production', 'development', 'beta') */
	mode: string
	/** The base directory (defaults to process.cwd()) */
	baseDir: string
}

/**
 * Build directory option - can be a static string or a dynamic function.
 *
 * @example
 * // Static string (bypasses mode logic)
 * buildDirectory: 'dist'
 *
 * @example
 * // Dynamic function (can use mode)
 * buildDirectory: (context) => `dist/${context.mode}`
 */
export type BuildDirectoryOption = string | ((context: BuildDirectoryContext) => string)

/**
 * Configuration for RoboPaths.
 */
export interface RoboPathsConfig {
	/** Base directory (defaults to process.cwd()) */
	baseDir?: string
	/** Custom build directory override (from config.experimental.buildDirectory) */
	customBuildDir?: BuildDirectoryOption
}

/**
 * API for resolving .robo/ paths.
 */
export interface RoboPathsAPI {
	/** Configure the paths utility */
	configure(config: RoboPathsConfig): void

	/** Get the .robo base directory */
	robo(): string

	/** Get the build output directory for a mode */
	build(mode?: string): string

	/** Get the manifest directory for a mode */
	manifest(mode: string): string

	/** Get the types directory */
	types(): string

	/** Get path to a hook in the build directory */
	hook(mode: string, hookName: string): string

	/** Get path to a build hook in the build directory */
	buildHook(mode: string, hookName: string): string

	/** Get path to a routes definition directory in the build */
	routesDir(mode: string): string

	/** Get plugin build path (plugins don't use mode-specific builds) */
	pluginBuild(pluginName: string): string

	/** Get plugin manifest path */
	pluginManifest(pluginName: string, mode: string): string

	/** Get plugin routes directory */
	pluginRoutesDir(pluginName: string): string

	/** Get plugin hook path */
	pluginHook(pluginName: string, hookName: string): string

	/** Get plugin build hook path */
	pluginBuildHook(pluginName: string, hookName: string): string
}

class RoboPathsImpl implements RoboPathsAPI {
	private _baseDir: string = process.cwd()
	private _customBuildDir?: BuildDirectoryOption

	configure(config: RoboPathsConfig): void {
		if (config.baseDir !== undefined) {
			this._baseDir = config.baseDir
		}
		// Always update customBuildDir if the key is present (allows clearing with undefined)
		if ('customBuildDir' in config) {
			this._customBuildDir = config.customBuildDir
		}
	}

	robo(): string {
		return path.join(this._baseDir, '.robo')
	}

	build(mode?: string): string {
		// Custom build directory takes precedence
		if (this._customBuildDir) {
			const resolved =
				typeof this._customBuildDir === 'function'
					? this._customBuildDir({ mode: mode ?? 'production', baseDir: this._baseDir })
					: this._customBuildDir

			return path.join(this._baseDir, resolved)
		}

		// Default: mode-specific build directory
		return mode ? path.join(this._baseDir, '.robo', 'build', mode) : path.join(this._baseDir, '.robo', 'build')
	}

	manifest(mode: string): string {
		return path.join(this._baseDir, '.robo', 'manifest', mode)
	}

	types(): string {
		return path.join(this._baseDir, '.robo', 'types')
	}

	hook(mode: string, hookName: string): string {
		return path.join(this.build(mode), 'robo', `${hookName}.js`)
	}

	buildHook(mode: string, hookName: string): string {
		return path.join(this.build(mode), 'robo', 'build', `${hookName}.js`)
	}

	routesDir(mode: string): string {
		return path.join(this.build(mode), 'robo', 'routes')
	}

	// Plugin paths - plugins don't use mode-specific builds
	pluginBuild(pluginName: string): string {
		return path.join(this._baseDir, 'node_modules', pluginName, '.robo', 'build')
	}

	pluginManifest(pluginName: string, mode: string): string {
		return path.join(this._baseDir, 'node_modules', pluginName, '.robo', 'manifest', mode)
	}

	pluginRoutesDir(pluginName: string): string {
		return path.join(this.pluginBuild(pluginName), 'robo', 'routes')
	}

	pluginHook(pluginName: string, hookName: string): string {
		return path.join(this.pluginBuild(pluginName), 'robo', `${hookName}.js`)
	}

	pluginBuildHook(pluginName: string, hookName: string): string {
		return path.join(this.pluginBuild(pluginName), 'robo', 'build', `${hookName}.js`)
	}
}

/** Singleton instance for centralized path management */
export const RoboPaths: RoboPathsAPI = new RoboPathsImpl()
