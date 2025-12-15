/**
 * Prepare Hook - WebSocket Handler Registration Setup
 *
 * This hook runs during Robo.start() BEFORE start hooks. Since prepare hooks
 * run alphabetically (mock < server), the server engine won't exist yet.
 *
 * To solve this, we register a callback that @robojs/server's prepare hook
 * will call after creating the engine. This ensures WebSocket handlers are
 * registered before any start hooks run.
 *
 * Execution order:
 * 1. @robojs/mock prepare hook - registers engine callback (this file)
 * 2. @robojs/server prepare hook - creates engine, calls callback
 * 3. @robojs/discordjs start hook - connects to gateway (handlers ready!)
 * 4. @robojs/mock start hook - starts voice gateway, creates session
 * 5. @robojs/server start hook - starts listening
 */
import type { NodeEngine } from '@robojs/server/engines.js'
import type { PrepareContext } from 'robo.js'
import { getGatewayServer } from '../core/gateway.js'
import { getStageServer } from '../core/stage.js'
import { mockLogger } from '../core/logger.js'
import { getMockPluginPrefix } from '../utils/server.js'
import type { MockPluginConfig } from '../types/plugin.js'
import type { BaseEngine } from '@robojs/server/engines.js'

// Extend globalThis to include our callback type
declare global {
	// eslint-disable-next-line no-var
	var __roboServerEngineCallbacks: Array<(engine: BaseEngine) => void> | undefined
}

/**
 * Prepare hook - Registers a callback for when the server engine is ready
 */
export default async (_context: PrepareContext<MockPluginConfig>) => {
	// Register a callback that @robojs/server will call after creating the engine
	// This ensures our WebSocket handlers are registered before start hooks run
	if (!globalThis.__roboServerEngineCallbacks) {
		globalThis.__roboServerEngineCallbacks = []
	}

	globalThis.__roboServerEngineCallbacks.push((engine: BaseEngine) => {
		mockLogger.debug('Server engine ready - registering WebSocket handlers')
		registerWebSocketHandlers(engine as NodeEngine)
		markHandlersRegistered()
	})

	mockLogger.debug('Registered engine callback for WebSocket handler setup')
}

/**
 * Register WebSocket handlers on the server engine
 * Exported so start hook can call this as fallback
 */
export function registerWebSocketHandlers(engine: NodeEngine): void {
	const gatewayServer = getGatewayServer()
	const stageServer = getStageServer()

	// Get plugin prefix for WebSocket path registration
	const pluginPrefix = getMockPluginPrefix()

	// Register Discord Gateway WebSocket upgrade handler at root path
	// Discord clients connect to: ws://host/?v=10&encoding=json
	engine.registerWebsocket('/', (req, socket, head) => {
		gatewayServer.handleUpgrade(req, socket, head)
	})

	// Register Stage WebSocket upgrade handler
	// Stage clients connect to: ws://host/stage/ws?token=mock:session_xxx
	const stageWsHandler = (
		req: Parameters<typeof stageServer.handleUpgrade>[0],
		socket: Parameters<typeof stageServer.handleUpgrade>[1],
		head: Parameters<typeof stageServer.handleUpgrade>[2]
	) => {
		stageServer.handleUpgrade(req, socket, head)
	}
	engine.registerWebsocket('/stage/ws', stageWsHandler)

	// Also register at prefixed path for when plugin has a static prefix (e.g., /mock)
	if (pluginPrefix) {
		engine.registerWebsocket(`${pluginPrefix}/stage/ws`, stageWsHandler)
		mockLogger.debug(`Registered Stage WebSocket at prefixed path: ${pluginPrefix}/stage/ws`)
	}

	mockLogger.debug('WebSocket handlers registered on server engine')
}

/**
 * Track whether handlers have been registered (to avoid double registration)
 */
let handlersRegistered = false

export function areHandlersRegistered(): boolean {
	return handlersRegistered
}

export function markHandlersRegistered(): void {
	handlersRegistered = true
}

export function resetHandlersRegistered(): void {
	handlersRegistered = false
}
