/**
 * Build Complete Hook - Vite Production Build
 *
 * This hook runs during `robo build` (production builds only) to:
 * 1. Bundle frontend assets using Vite
 * 2. Output to .robo/public/ for production serving
 *
 * In development mode, the Vite dev server handles this instead (see start.ts).
 */
import { logger } from '../../core/logger.js'
import { hasDependency } from '../../core/runtime-utils.js'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { BuildCompleteContext } from 'robo.js'
import type { ConfigEnv, UserConfig } from 'vite'

/**
 * Build complete hook - Bundles frontend assets with Vite for production
 */
export default async function (context: BuildCompleteContext): Promise<void> {
	const { mode } = context

	// Skip in development mode - dev server handles this
	if (mode === 'development') {
		logger.debug('Skipping Vite build in development mode')
		return
	}

	// Check if Vite is available
	if (!(await hasDependency('vite', true))) {
		logger.debug('Vite not installed. Skipping Vite build...')
		return
	}

	try {
		await buildVite()
	} catch (error) {
		logger.error('Failed to build Vite:', error)
	}
}

/**
 * Build frontend assets with Vite.
 * Loads config from config/vite.ts, config/vite.mjs, or vite.config.ts/js.
 */
async function buildVite(): Promise<void> {
	const time = Date.now()
	logger.debug('Building Vite...')
	const { build, loadConfigFromFile } = await import('vite')

	// Load Vite config
	let config: UserConfig | undefined
	const configEnv: ConfigEnv = {
		command: 'build',
		isPreview: false,
		isSsrBuild: false,
		mode: 'production'
	}

	// Check config paths in order of preference
	const configPaths = [
		path.join(process.cwd(), 'config', 'vite.ts'),
		path.join(process.cwd(), 'config', 'vite.mjs'),
		path.join(process.cwd(), 'vite.config.ts'),
		path.join(process.cwd(), 'vite.config.js')
	]

	for (const configPath of configPaths) {
		if (existsSync(configPath)) {
			config = (await loadConfigFromFile(configEnv, configPath))?.config
			break
		}
	}

	if (!config) {
		logger.debug('No Vite config found. Skipping...')
		return
	}
	logger.debug('Vite config loaded:', config)

	// Build with Vite
	await build({
		logLevel: 'warn',
		...(config ?? {}),
		build: {
			...(config?.build ?? {}),
			emptyOutDir: true,
			outDir: path.join('.robo', 'public')
		}
	})
	logger.debug('Vite build completed in', Date.now() - time, 'ms')
}
