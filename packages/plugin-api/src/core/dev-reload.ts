/**
 * Dev Reload Module
 *
 * Provides automatic browser reload when plugin frontend assets change during development.
 * Only active when NODE_ENV !== 'production'.
 *
 * How it works:
 * 1. Watches plugin public directories for `.build-signal` files
 * 2. When a signal file changes (written by Vite after build completes), broadcasts reload
 * 3. Client-side script (from @robojs/server/client) receives message and reloads the page
 *
 * The signal file approach ensures we only reload AFTER the build is complete,
 * avoiding race conditions where the browser reloads before assets are ready.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { Watcher } from 'robo.js/unstable'
import { WebSocketServer } from 'ws'
import { logger } from './logger.js'
import { getPluginRouteRegistry } from './plugin-routes.js'
import type { BaseEngine } from '../engines/base.js'

// WebSocket ready state constant (avoid importing WebSocket just for this)
const WS_OPEN = 1

const DEV_RELOAD_PATH = '/__robo/ui-reload'

// Signal file name written by Vite plugin after build completes
const BUILD_SIGNAL_FILE = '.build-signal'

let wss: WebSocketServer | null = null
let watcher: Watcher | null = null

interface ReloadMessage {
	type: 'reload'
	plugin?: string
	timestamp: number
}

/**
 * Initialize the dev reload system.
 * Only runs in development mode (NODE_ENV !== 'production').
 *
 * @param engine - The server engine to attach the WebSocket to
 */
export async function initDevReload(engine: BaseEngine): Promise<void> {
	// Only in development mode
	if (process.env.NODE_ENV === 'production') {
		return
	}

	const httpServer = engine.getHttpServer()
	if (!httpServer) {
		logger.debug('No HTTP server available for dev reload')
		return
	}

	// Find plugins with public directories that are in dev mode
	const pluginDirs = await findDevPluginPublicDirs()
	if (pluginDirs.length === 0) {
		logger.debug('No dev plugins with public directories found')
		return
	}

	// Create WebSocket server (noServer mode - we handle upgrades manually)
	wss = new WebSocketServer({ noServer: true })

	// Register WebSocket handler for the dev reload path
	engine.registerWebsocket(DEV_RELOAD_PATH, (req, socket, head) => {
		wss?.handleUpgrade(req, socket, head, (ws) => {
			wss?.emit('connection', ws, req)
		})
	})

	// Handle new connections
	wss.on('connection', (ws) => {
		logger.debug('Dev reload client connected')

		ws.on('close', () => {
			logger.debug('Dev reload client disconnected')
		})
	})

	// Start watching plugin public directories for build signal files
	const watchPaths = pluginDirs.map((d) => d.path)
	logger.debug(`Watching for build signals in:`, watchPaths)

	watcher = new Watcher(watchPaths, { exclude: [] })
	await watcher.start(async (changes) => {
		if (changes.length === 0) return

		// Only react to .build-signal file being added or modified (not deleted)
		// When Vite builds with emptyOutDir, it deletes the signal file first - ignore that
		const signalChanges = changes.filter(
			(c) => c.filePath.endsWith(BUILD_SIGNAL_FILE) && c.changeType !== 'removed'
		)
		if (signalChanges.length === 0) return

		// Find which plugin(s) had signal changes
		const changedPlugins = new Set<string>()
		for (const change of signalChanges) {
			for (const dir of pluginDirs) {
				if (change.filePath.startsWith(dir.path)) {
					changedPlugins.add(dir.name)
				}
			}
		}

		logger.debug(`Build complete for: ${[...changedPlugins].join(', ')}`)

		// Broadcast immediately - signal file means build is complete
		broadcast({
			type: 'reload',
			plugin: changedPlugins.size === 1 ? [...changedPlugins][0] : undefined,
			timestamp: Date.now()
		})
	})

	logger.info(`Dev reload active on ${DEV_RELOAD_PATH} (watching ${pluginDirs.length} plugin(s))`)
}

/**
 * Stop the dev reload system and clean up resources.
 */
export function stopDevReload(): void {
	if (watcher) {
		watcher.stop()
		watcher = null
	}

	if (wss) {
		wss.close()
		wss = null
	}
}

/**
 * Broadcast a message to all connected clients.
 */
function broadcast(message: ReloadMessage): void {
	if (!wss) return

	const data = JSON.stringify(message)
	let clientCount = 0

	wss.clients.forEach((client) => {
		if (client.readyState === WS_OPEN) {
			client.send(data)
			clientCount++
		}
	})

	if (clientCount > 0) {
		logger.debug(`Broadcasted reload to ${clientCount} client(s)`)
	}
}

/**
 * Find plugins that are in dev mode and have public directories.
 * A plugin is in dev mode if it has a .robo/watch.json file.
 */
async function findDevPluginPublicDirs(): Promise<Array<{ name: string; path: string }>> {
	const result: Array<{ name: string; path: string }> = []
	const registry = getPluginRouteRegistry()

	for (const [pluginName, config] of registry.getPlugins()) {
		// Check if plugin has a public directory
		const publicDir = config.publicDir
		if (!publicDir) continue

		// Check if plugin is in dev mode (has .robo/watch.json)
		// The publicDir is either in node_modules or a linked path
		// We need to find the plugin root and check for .robo/watch.json
		const pluginRoot = findPluginRoot(publicDir)
		if (!pluginRoot) continue

		const watchFile = path.join(pluginRoot, '.robo', 'watch.json')
		if (existsSync(watchFile)) {
			result.push({ name: pluginName, path: publicDir })
			logger.debug(`Found dev plugin with public dir: ${pluginName} -> ${publicDir}`)
		}
	}

	return result
}

/**
 * Find the plugin root directory from a public directory path.
 * Handles both node_modules and linked packages.
 */
function findPluginRoot(publicDir: string): string | null {
	// publicDir is like: /path/to/project/node_modules/@robojs/mock/public
	// or for symlinks: /path/to/packages/@robojs/mock/public
	// We want: /path/to/packages/@robojs/mock

	// Walk up from publicDir to find a directory containing package.json
	let current = path.dirname(publicDir) // Remove 'public'

	// Safety limit to prevent infinite loops
	let depth = 0
	const maxDepth = 10

	while (depth < maxDepth) {
		const packageJson = path.join(current, 'package.json')
		if (existsSync(packageJson)) {
			return current
		}

		const parent = path.dirname(current)
		if (parent === current) {
			// Reached root
			break
		}
		current = parent
		depth++
	}

	return null
}
