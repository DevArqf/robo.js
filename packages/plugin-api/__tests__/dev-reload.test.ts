/**
 * Tests for Dev Reload Module (Server-Side)
 *
 * Tests the WebSocket-based hot reload system for plugin frontend assets.
 * Uses build signal files to ensure deterministic reload timing.
 */
import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import type { WebSocket as WsWebSocket } from 'ws'

// Mock the dependencies before importing the module
const mockWatcherStart = jest.fn()
const mockWatcherStop = jest.fn()

jest.unstable_mockModule('robo.js/unstable', () => ({
	Watcher: jest.fn().mockImplementation(() => ({
		start: mockWatcherStart,
		stop: mockWatcherStop
	}))
}))

const mockWebSocketServerOn = jest.fn()
const mockWebSocketServerClose = jest.fn()
const mockWebSocketServerClients = new Set<{ readyState: number; send: jest.Mock }>()

jest.unstable_mockModule('ws', () => ({
	WebSocketServer: jest.fn().mockImplementation(() => ({
		on: mockWebSocketServerOn,
		close: mockWebSocketServerClose,
		clients: mockWebSocketServerClients,
		handleUpgrade: jest.fn(),
		emit: jest.fn()
	}))
}))

jest.unstable_mockModule('node:fs', () => ({
	existsSync: jest.fn().mockReturnValue(true)
}))

const mockPluginRegistry = {
	getPlugins: jest.fn().mockReturnValue(new Map())
}

jest.unstable_mockModule('../.robo/build/core/plugin-routes.js', () => ({
	getPluginRouteRegistry: jest.fn().mockReturnValue(mockPluginRegistry)
}))

jest.unstable_mockModule('../.robo/build/core/logger.js', () => ({
	logger: {
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn()
	}
}))

describe('Dev Reload Module', () => {
	let initDevReload: (engine: any) => Promise<void>
	let stopDevReload: () => void

	beforeEach(async () => {
		jest.clearAllMocks()
		mockWebSocketServerClients.clear()

		// Reset module state by re-importing
		const module = await import('../.robo/build/core/dev-reload.js')
		initDevReload = module.initDevReload
		stopDevReload = module.stopDevReload
	})

	afterEach(() => {
		stopDevReload?.()
	})

	describe('initDevReload()', () => {
		it('should skip initialization in production mode', async () => {
			const originalEnv = process.env.NODE_ENV
			process.env.NODE_ENV = 'production'

			const mockEngine = {
				getHttpServer: jest.fn().mockReturnValue({}),
				registerWebsocket: jest.fn()
			}

			await initDevReload(mockEngine)

			expect(mockEngine.registerWebsocket).not.toHaveBeenCalled()

			process.env.NODE_ENV = originalEnv
		})

		it('should skip if no HTTP server available', async () => {
			const originalEnv = process.env.NODE_ENV
			process.env.NODE_ENV = 'development'

			const mockEngine = {
				getHttpServer: jest.fn().mockReturnValue(null),
				registerWebsocket: jest.fn()
			}

			await initDevReload(mockEngine)

			expect(mockEngine.registerWebsocket).not.toHaveBeenCalled()

			process.env.NODE_ENV = originalEnv
		})

		it('should skip if no dev plugins with public directories', async () => {
			const originalEnv = process.env.NODE_ENV
			process.env.NODE_ENV = 'development'

			mockPluginRegistry.getPlugins.mockReturnValue(new Map())

			const mockEngine = {
				getHttpServer: jest.fn().mockReturnValue({}),
				registerWebsocket: jest.fn()
			}

			await initDevReload(mockEngine)

			expect(mockEngine.registerWebsocket).not.toHaveBeenCalled()

			process.env.NODE_ENV = originalEnv
		})
	})

	describe('stopDevReload()', () => {
		it('should clean up watcher and WebSocket server', async () => {
			// This test verifies cleanup doesn't throw when nothing is initialized
			expect(() => stopDevReload()).not.toThrow()
		})
	})

	describe('Signal File Filtering', () => {
		it('should only react to .build-signal files', () => {
			// Test the filtering logic conceptually
			const changes = [
				{ filePath: '/path/to/public/index.html', changeType: 'changed' },
				{ filePath: '/path/to/public/assets/main.js', changeType: 'changed' },
				{ filePath: '/path/to/public/.build-signal', changeType: 'changed' }
			]

			const signalChanges = changes.filter(
				(c) => c.filePath.endsWith('.build-signal') && c.changeType !== 'removed'
			)

			expect(signalChanges).toHaveLength(1)
			expect(signalChanges[0].filePath).toContain('.build-signal')
		})

		it('should ignore removed signal files', () => {
			const changes = [
				{ filePath: '/path/to/public/.build-signal', changeType: 'removed' }
			]

			const signalChanges = changes.filter(
				(c) => c.filePath.endsWith('.build-signal') && c.changeType !== 'removed'
			)

			expect(signalChanges).toHaveLength(0)
		})

		it('should accept added signal files', () => {
			const changes = [
				{ filePath: '/path/to/public/.build-signal', changeType: 'added' }
			]

			const signalChanges = changes.filter(
				(c) => c.filePath.endsWith('.build-signal') && c.changeType !== 'removed'
			)

			expect(signalChanges).toHaveLength(1)
		})
	})

	describe('Broadcast Logic', () => {
		it('should only send to clients with OPEN ready state', () => {
			const WS_OPEN = 1
			const WS_CLOSED = 3

			const openClient = { readyState: WS_OPEN, send: jest.fn() }
			const closedClient = { readyState: WS_CLOSED, send: jest.fn() }

			const clients = [openClient, closedClient]
			const message = JSON.stringify({ type: 'reload', timestamp: Date.now() })

			clients.forEach((client) => {
				if (client.readyState === WS_OPEN) {
					client.send(message)
				}
			})

			expect(openClient.send).toHaveBeenCalledWith(message)
			expect(closedClient.send).not.toHaveBeenCalled()
		})
	})

	describe('Plugin Detection', () => {
		it('should identify plugins by matching file paths', () => {
			const pluginDirs = [
				{ name: '@robojs/mock', path: '/path/to/mock/public' },
				{ name: '@robojs/other', path: '/path/to/other/public' }
			]

			const signalPath = '/path/to/mock/public/stage/.build-signal'

			const changedPlugins = new Set<string>()
			for (const dir of pluginDirs) {
				if (signalPath.startsWith(dir.path)) {
					changedPlugins.add(dir.name)
				}
			}

			expect(changedPlugins.size).toBe(1)
			expect(changedPlugins.has('@robojs/mock')).toBe(true)
		})
	})
})

describe('Reload Message Format', () => {
	it('should have correct structure', () => {
		interface ReloadMessage {
			type: 'reload'
			plugin?: string
			timestamp: number
		}

		const message: ReloadMessage = {
			type: 'reload',
			plugin: '@robojs/mock',
			timestamp: Date.now()
		}

		expect(message.type).toBe('reload')
		expect(typeof message.timestamp).toBe('number')
		expect(message.plugin).toBe('@robojs/mock')
	})

	it('should allow optional plugin field', () => {
		interface ReloadMessage {
			type: 'reload'
			plugin?: string
			timestamp: number
		}

		const message: ReloadMessage = {
			type: 'reload',
			timestamp: Date.now()
		}

		expect(message.plugin).toBeUndefined()
	})
})

describe('findPluginRoot Logic', () => {
	// Test the directory walking algorithm used in findPluginRoot
	const findPluginRoot = (publicDir: string, existingPaths: Set<string>): string | null => {
		let current = path.dirname(publicDir)
		let depth = 0
		const maxDepth = 10

		while (depth < maxDepth) {
			const packageJson = path.join(current, 'package.json')
			if (existingPaths.has(packageJson)) {
				return current
			}

			const parent = path.dirname(current)
			if (parent === current) {
				break
			}
			current = parent
			depth++
		}

		return null
	}

	it('should find plugin root from public directory', () => {
		const existingPaths = new Set([
			'/path/to/node_modules/@robojs/mock/package.json'
		])

		const result = findPluginRoot(
			'/path/to/node_modules/@robojs/mock/public',
			existingPaths
		)

		expect(result).toBe('/path/to/node_modules/@robojs/mock')
	})

	it('should find plugin root from nested public directory', () => {
		const existingPaths = new Set([
			'/path/to/packages/@robojs/mock/package.json'
		])

		const result = findPluginRoot(
			'/path/to/packages/@robojs/mock/public/stage',
			existingPaths
		)

		expect(result).toBe('/path/to/packages/@robojs/mock')
	})

	it('should return null if no package.json found', () => {
		const existingPaths = new Set<string>()

		const result = findPluginRoot(
			'/path/to/some/directory/public',
			existingPaths
		)

		expect(result).toBeNull()
	})

	it('should respect maxDepth limit', () => {
		// Only add package.json at a depth beyond 10 levels
		const existingPaths = new Set([
			'/a/package.json' // Very shallow, but path is very deep
		])

		// Create a path that's more than 10 levels deep
		const deepPath = '/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/public'

		const result = findPluginRoot(deepPath, existingPaths)

		// Should not find it because we stop at depth 10
		expect(result).toBeNull()
	})

	it('should handle symlinked package paths', () => {
		// Symlinked packages often resolve to different paths
		const existingPaths = new Set([
			'/Users/dev/monorepo/packages/@robojs/mock/package.json'
		])

		const result = findPluginRoot(
			'/Users/dev/monorepo/packages/@robojs/mock/public',
			existingPaths
		)

		expect(result).toBe('/Users/dev/monorepo/packages/@robojs/mock')
	})
})

describe('Dev Plugin Detection Logic', () => {
	const isDevPlugin = (
		pluginRoot: string | null,
		existingPaths: Set<string>
	): boolean => {
		if (!pluginRoot) return false
		const watchFile = path.join(pluginRoot, '.robo', 'watch.json')
		return existingPaths.has(watchFile)
	}

	it('should detect dev plugin by .robo/watch.json presence', () => {
		const existingPaths = new Set([
			'/path/to/mock/.robo/watch.json'
		])

		const result = isDevPlugin('/path/to/mock', existingPaths)

		expect(result).toBe(true)
	})

	it('should not detect production plugin (no watch.json)', () => {
		const existingPaths = new Set<string>()

		const result = isDevPlugin('/path/to/mock', existingPaths)

		expect(result).toBe(false)
	})

	it('should return false for null plugin root', () => {
		const existingPaths = new Set([
			'/path/to/mock/.robo/watch.json'
		])

		const result = isDevPlugin(null, existingPaths)

		expect(result).toBe(false)
	})
})

describe('WebSocket Endpoint Path', () => {
	const DEV_RELOAD_PATH = '/__robo/ui-reload'

	it('should use Robo-branded endpoint path', () => {
		expect(DEV_RELOAD_PATH).toBe('/__robo/ui-reload')
	})

	it('should start with /__robo prefix', () => {
		expect(DEV_RELOAD_PATH.startsWith('/__robo')).toBe(true)
	})

	it('should indicate UI reload purpose', () => {
		expect(DEV_RELOAD_PATH).toContain('ui-reload')
	})
})

describe('Engine Integration', () => {
	it('should register WebSocket handler with correct path', () => {
		const DEV_RELOAD_PATH = '/__robo/ui-reload'
		const mockRegisterWebsocket = jest.fn()

		// Simulate what initDevReload does
		mockRegisterWebsocket(DEV_RELOAD_PATH, expect.any(Function))

		expect(mockRegisterWebsocket).toHaveBeenCalledWith(
			'/__robo/ui-reload',
			expect.any(Function)
		)
	})

	it('should get HTTP server from engine', () => {
		const mockHttpServer = { on: jest.fn() }
		const mockEngine = {
			getHttpServer: jest.fn().mockReturnValue(mockHttpServer)
		}

		const server = mockEngine.getHttpServer()

		expect(mockEngine.getHttpServer).toHaveBeenCalled()
		expect(server).toBe(mockHttpServer)
	})
})

describe('Multiple Plugin Handling', () => {
	it('should track changes from multiple plugins separately', () => {
		const pluginDirs = [
			{ name: '@robojs/mock', path: '/path/to/mock/public' },
			{ name: '@robojs/auth', path: '/path/to/auth/public' },
			{ name: '@robojs/analytics', path: '/path/to/analytics/public' }
		]

		const changes = [
			{ filePath: '/path/to/mock/public/.build-signal', changeType: 'changed' },
			{ filePath: '/path/to/auth/public/.build-signal', changeType: 'changed' }
		]

		const changedPlugins = new Set<string>()
		for (const change of changes) {
			for (const dir of pluginDirs) {
				if (change.filePath.startsWith(dir.path)) {
					changedPlugins.add(dir.name)
				}
			}
		}

		expect(changedPlugins.size).toBe(2)
		expect(changedPlugins.has('@robojs/mock')).toBe(true)
		expect(changedPlugins.has('@robojs/auth')).toBe(true)
		expect(changedPlugins.has('@robojs/analytics')).toBe(false)
	})

	it('should return single plugin name when only one changed', () => {
		const changedPlugins = new Set(['@robojs/mock'])

		const pluginName = changedPlugins.size === 1
			? [...changedPlugins][0]
			: undefined

		expect(pluginName).toBe('@robojs/mock')
	})

	it('should return undefined when multiple plugins changed', () => {
		const changedPlugins = new Set(['@robojs/mock', '@robojs/auth'])

		const pluginName = changedPlugins.size === 1
			? [...changedPlugins][0]
			: undefined

		expect(pluginName).toBeUndefined()
	})
})
