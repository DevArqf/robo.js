/**
 * MCP (Model Context Protocol) integration for @robojs/code SDK
 *
 * This module provides optional MCP client integration via @langchain/mcp-adapters.
 * It supports:
 * - WebContainer-first: Streamable HTTP transport only
 * - Local MCP servers with URL discovery via LocalServiceDiscovery
 * - Remote MCP servers via backend gateway with auth headers
 * - MCP tools registered with same serialization + policy as core tools
 * - Remote patch-plan rule: remote tools return ProposedChanges
 *
 * @example
 * ```typescript
 * import { createMcpClientManager, registerMcpTools } from '@robojs/code/mcp'
 *
 * const mcpManager = createMcpClientManager({
 *   config: {
 *     enabled: true,
 *     servers: {
 *       roboLocal: {
 *         transport: 'streamable_http',
 *         url: '__DISCOVERED__',
 *         startCommand: { command: 'node', args: ['mcp-server.js'] }
 *       }
 *     }
 *   },
 *   provider,
 *   serviceDiscovery
 * })
 *
 * await mcpManager.connect()
 * const tools = mcpManager.getTools()
 * registerMcpTools(toolRegistry, tools)
 * ```
 */

// Types
export type {
	McpTransport,
	McpServerConfig,
	McpConfig,
	McpToolMetadata,
	McpRemoteToolResult,
	McpServerStatus,
	McpServerInfo
} from './types.js'

export { DISCOVERED_URL, DEFAULT_MCP_CONFIG } from './types.js'

// Client Manager
export {
	McpClientManager,
	createMcpClientManager,
	type McpClientManagerOptions,
	type McpToolDefinition
} from './McpClientManager.js'

// Tool Adapter
export {
	adaptMcpTool,
	adaptMcpTools,
	registerMcpTools,
	type McpToolAdapterOptions
} from './McpToolAdapter.js'
