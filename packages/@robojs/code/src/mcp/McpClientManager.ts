/**
 * MCP Client Manager for @robojs/code SDK
 *
 * Manages connections to MCP servers using @langchain/mcp-adapters.
 * Supports:
 * - Local MCP servers with URL discovery via LocalServiceDiscovery
 * - Remote MCP servers via backend gateway with auth headers
 * - Tool loading and lifecycle management
 */

import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import { codeLogger } from '../core/logger.js'
import type { ExecutionProvider, LocalServiceDiscovery } from '../types/execution.js'
import type {
	McpConfig,
	McpServerConfig,
	McpServerInfo,
	McpServerStatus,
	McpToolMetadata,
	DISCOVERED_URL
} from './types.js'

/**
 * Tool definition from MCP server
 */
export interface McpToolDefinition {
	/**
	 * Tool name (may be prefixed with serverId for uniqueness)
	 */
	name: string

	/**
	 * Tool description
	 */
	description: string

	/**
	 * JSON Schema for tool parameters
	 */
	inputSchema: Record<string, unknown>

	/**
	 * Metadata for event attribution
	 */
	metadata: McpToolMetadata

	/**
	 * Execute the tool
	 */
	execute: (args: unknown) => Promise<unknown>
}

/**
 * Options for McpClientManager
 */
export interface McpClientManagerOptions {
	/**
	 * MCP configuration
	 */
	config: McpConfig

	/**
	 * Execution provider for starting local MCP servers
	 */
	provider: ExecutionProvider

	/**
	 * Optional service discovery for local MCP URLs
	 */
	serviceDiscovery?: LocalServiceDiscovery

	/**
	 * Abort signal for cleanup
	 */
	signal?: AbortSignal
}

/**
 * Manages MCP server connections and tool loading
 */
export class McpClientManager {
	private readonly config: McpConfig
	private readonly provider: ExecutionProvider
	private readonly serviceDiscovery?: LocalServiceDiscovery
	private readonly signal?: AbortSignal

	private client: MultiServerMCPClient | null = null
	private serverInfoMap: Map<string, McpServerInfo> = new Map()
	private tools: Map<string, McpToolDefinition> = new Map()
	private localSessions: Map<string, string> = new Map() // serverId -> sessionId

	constructor(options: McpClientManagerOptions) {
		this.config = options.config
		this.provider = options.provider
		this.serviceDiscovery = options.serviceDiscovery
		this.signal = options.signal
	}

	/**
	 * Initialize and connect to all configured MCP servers
	 */
	async connect(): Promise<void> {
		if (!this.config.enabled) {
			codeLogger.debug('MCP is disabled, skipping connection')
			return
		}

		const serverEntries = Object.entries(this.config.servers)
		if (serverEntries.length === 0) {
			codeLogger.debug('No MCP servers configured')
			return
		}

		codeLogger.info(`Connecting to ${serverEntries.length} MCP server(s)`)

		// Resolve URLs and prepare server configs
		const resolvedServers: Record<string, { transport: 'http'; url: string; headers?: Record<string, string> }> = {}

		for (const [serverId, serverConfig] of serverEntries) {
			try {
				this.updateServerStatus(serverId, 'connecting')
				const resolvedUrl = await this.resolveServerUrl(serverId, serverConfig)

				resolvedServers[serverId] = {
					transport: 'http', // mcp-adapters uses 'http' not 'streamable_http'
					url: resolvedUrl,
					headers: serverConfig.headers
				}

				this.updateServerStatus(serverId, 'connected', { resolvedUrl })
				codeLogger.info(`Resolved MCP server '${serverId}' at ${resolvedUrl}`)
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				this.updateServerStatus(serverId, 'error', { error: errorMessage })
				codeLogger.error(`Failed to resolve MCP server '${serverId}': ${errorMessage}`)
			}
		}

		// Only create client if we have at least one resolved server
		const resolvedCount = Object.keys(resolvedServers).length
		if (resolvedCount === 0) {
			codeLogger.warn('No MCP servers could be resolved, MCP will be unavailable')
			return
		}

		try {
			// Create the multi-server client
			this.client = new MultiServerMCPClient(resolvedServers)
			await this.loadTools()
			codeLogger.info(`MCP connected: ${this.tools.size} tool(s) from ${resolvedCount} server(s)`)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			codeLogger.error(`Failed to create MCP client: ${errorMessage}`)
			throw error
		}
	}

	/**
	 * Resolve server URL (handles discovery for local servers)
	 */
	private async resolveServerUrl(serverId: string, config: McpServerConfig): Promise<string> {
		// If URL is already specified, return it directly
		if (config.url !== '__DISCOVERED__') {
			return config.url
		}

		// Local discovery required
		if (!this.serviceDiscovery) {
			throw new Error(
				`Server '${serverId}' requires URL discovery but no LocalServiceDiscovery is available`
			)
		}

		if (!config.startCommand) {
			throw new Error(
				`Server '${serverId}' requires URL discovery but no startCommand is configured`
			)
		}

		codeLogger.debug(`Starting local MCP server '${serverId}'...`)

		// Start the local MCP server as a session
		const sessionHandle = await this.provider.startSession(
			config.startCommand.command,
			config.startCommand.args,
			{
				env: config.startCommand.env,
				signal: this.signal
			}
		)

		// Track the session for cleanup
		this.localSessions.set(serverId, sessionHandle.id)

		// Wait for URL discovery
		const { serviceId } = await this.serviceDiscovery.start('mcp', {
			port: config.expectedPort
		})

		const timeout = this.config.connectionTimeout ?? 30000
		const { url } = await Promise.race([
			this.serviceDiscovery.waitForUrl(serviceId),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error(`Timeout waiting for MCP server '${serverId}'`)), timeout)
			)
		])

		return url
	}

	/**
	 * Load tools from all connected servers
	 */
	private async loadTools(): Promise<void> {
		if (!this.client) {
			return
		}

		this.tools.clear()

		// Get tools from the client
		const langchainTools = await this.client.getTools()

		for (const tool of langchainTools) {
			// Extract server ID from tool name (format: serverId__toolName)
			const parts = tool.name.split('__')
			const serverId = parts.length > 1 ? parts[0] : 'unknown'
			const originalName = parts.length > 1 ? parts.slice(1).join('__') : tool.name

			const serverConfig = this.config.servers[serverId]
			const isRemote = serverConfig?.isRemote ?? false

			const metadata: McpToolMetadata = {
				serverId,
				isRemote,
				originalName
			}

			const toolDef: McpToolDefinition = {
				name: tool.name,
				description: tool.description || '',
				inputSchema: tool.schema as Record<string, unknown>,
				metadata,
				execute: async (args: unknown) => {
					return await tool.invoke(args)
				}
			}

			this.tools.set(tool.name, toolDef)

			// Update server info with tool count
			const info = this.serverInfoMap.get(serverId)
			if (info) {
				info.toolCount = (info.toolCount || 0) + 1
			}
		}
	}

	/**
	 * Get all loaded tools
	 */
	getTools(): McpToolDefinition[] {
		return Array.from(this.tools.values())
	}

	/**
	 * Get a specific tool by name
	 */
	getTool(name: string): McpToolDefinition | undefined {
		return this.tools.get(name)
	}

	/**
	 * Get status of all servers
	 */
	getServerInfos(): McpServerInfo[] {
		return Array.from(this.serverInfoMap.values())
	}

	/**
	 * Get status of a specific server
	 */
	getServerInfo(serverId: string): McpServerInfo | undefined {
		return this.serverInfoMap.get(serverId)
	}

	/**
	 * Check if MCP is connected and has tools
	 */
	isConnected(): boolean {
		return this.client !== null && this.tools.size > 0
	}

	/**
	 * Disconnect and clean up all MCP connections
	 */
	async disconnect(): Promise<void> {
		codeLogger.debug('Disconnecting MCP client...')

		// Close the multi-server client
		if (this.client) {
			try {
				await this.client.close()
			} catch (error) {
				codeLogger.warn(`Error closing MCP client: ${error}`)
			}
			this.client = null
		}

		// Stop local MCP server sessions
		for (const [serverId, sessionId] of this.localSessions) {
			try {
				codeLogger.debug(`Stopping local MCP session for '${serverId}'`)
				await this.provider.stopSession({ id: sessionId })
			} catch (error) {
				codeLogger.warn(`Error stopping MCP session '${serverId}': ${error}`)
			}
		}
		this.localSessions.clear()

		// Stop any service discovery services
		if (this.serviceDiscovery) {
			// Note: Services are tracked by service discovery and cleaned up there
		}

		// Clear tools and server info
		this.tools.clear()
		for (const [serverId] of this.serverInfoMap) {
			this.updateServerStatus(serverId, 'disconnected')
		}

		codeLogger.info('MCP client disconnected')
	}

	/**
	 * Update server status and info
	 */
	private updateServerStatus(
		serverId: string,
		status: McpServerStatus,
		extra?: Partial<McpServerInfo>
	): void {
		const existing = this.serverInfoMap.get(serverId) || {
			serverId,
			status: 'disconnected' as McpServerStatus,
			toolCount: 0
		}

		this.serverInfoMap.set(serverId, {
			...existing,
			status,
			...extra
		})
	}
}

/**
 * Create an MCP client manager
 */
export function createMcpClientManager(options: McpClientManagerOptions): McpClientManager {
	return new McpClientManager(options)
}
