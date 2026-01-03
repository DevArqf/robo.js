/**
 * MCP (Model Context Protocol) configuration types for @robojs/code SDK
 *
 * Supports WebContainer-first MCP integration via Streamable HTTP transport.
 * Local MCP servers are discovered via LocalServiceDiscovery.
 * Remote MCP servers use backend gateway URLs with auth headers.
 */

import type { ProposedChanges } from '../types/changes.js'

/**
 * MCP transport type for @ai-sdk/mcp
 * - 'http' for Streamable HTTP transport (recommended for WebContainer)
 * - 'sse' for Server-Sent Events transport
 * - 'streamable_http' is an alias for 'http' (backwards compatibility)
 *
 * Note: stdio MCP requires child_process and is Node-only, not supported here.
 */
export type McpTransport = 'http' | 'sse' | 'streamable_http'

/**
 * Special URL value indicating the server URL should be discovered
 * at runtime via LocalServiceDiscovery
 */
export const DISCOVERED_URL = '__DISCOVERED__' as const

/**
 * Configuration for a single MCP server
 */
export interface McpServerConfig {
	/**
	 * Transport type - always 'streamable_http' for WebContainer
	 */
	transport: McpTransport

	/**
	 * Server URL - either a direct URL or '__DISCOVERED__' for local discovery
	 *
	 * When set to '__DISCOVERED__', the URL will be resolved at runtime
	 * via LocalServiceDiscovery.waitForUrl()
	 */
	url: string | typeof DISCOVERED_URL

	/**
	 * Optional HTTP headers (typically for auth on remote servers)
	 */
	headers?: Record<string, string>

	/**
	 * Whether this is a remote server (accessed via backend gateway)
	 *
	 * Remote servers use the "patch-plan" rule:
	 * - They cannot directly modify the WebContainer filesystem
	 * - They return ProposedChanges which are applied by core tools
	 * - Changes require approval like any other file modification
	 */
	isRemote?: boolean

	/**
	 * Command to start a local MCP server (for discovery mode)
	 * Only used when url === '__DISCOVERED__'
	 */
	startCommand?: {
		command: string
		args: string[]
		env?: Record<string, string>
	}

	/**
	 * Expected port for local service discovery
	 * Helps correlate server-ready events to the correct service
	 */
	expectedPort?: number
}

/**
 * MCP configuration for CodeAgent
 */
export interface McpConfig {
	/**
	 * Whether MCP integration is enabled.
	 *
	 * - `true`: MCP is enabled
	 * - `false`: MCP is explicitly disabled
	 * - `undefined`: Auto-enable if servers are configured
	 *
	 * @default undefined (auto-enabled when servers are defined)
	 */
	enabled?: boolean

	/**
	 * Map of server IDs to server configurations
	 *
	 * Server IDs are used in events to identify which MCP server
	 * a tool call originated from.
	 *
	 * Example:
	 * ```typescript
	 * {
	 *   roboLocal: {
	 *     transport: 'streamable_http',
	 *     url: '__DISCOVERED__',
	 *     startCommand: { command: 'node', args: ['mcp-server.js'] }
	 *   },
	 *   roboRemote: {
	 *     transport: 'streamable_http',
	 *     url: 'https://api.example.com/mcp/robo',
	 *     headers: { Authorization: 'Bearer <token>' },
	 *     isRemote: true
	 *   }
	 * }
	 * ```
	 */
	servers: Record<string, McpServerConfig>

	/**
	 * Timeout for connecting to MCP servers (ms)
	 * @default 30000
	 */
	connectionTimeout?: number

	/**
	 * Timeout for tool execution (ms)
	 * @default 60000
	 */
	toolTimeout?: number
}

/**
 * MCP tool metadata attached to tools registered from MCP servers
 * Used by StreamAdapter to emit mcp_call/mcp_result events
 */
export interface McpToolMetadata {
	/**
	 * Server ID this tool came from
	 */
	serverId: string

	/**
	 * Whether this tool is from a remote server (patch-plan rule applies)
	 */
	isRemote: boolean

	/**
	 * Original tool name from the MCP server
	 */
	originalName: string
}

/**
 * Result from a remote MCP tool (patch-plan rule)
 * Remote tools cannot modify files directly - they return proposed changes
 */
export interface McpRemoteToolResult {
	/**
	 * Proposed changes to apply (create/modify/delete files)
	 */
	proposedChanges?: ProposedChanges

	/**
	 * Any other data returned by the tool
	 */
	data?: unknown

	/**
	 * Notes or explanations about the proposed changes
	 */
	notes?: string
}

/**
 * Status of an MCP server connection
 */
export type McpServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

/**
 * Information about a connected MCP server
 */
export interface McpServerInfo {
	/**
	 * Server ID from configuration
	 */
	serverId: string

	/**
	 * Current connection status
	 */
	status: McpServerStatus

	/**
	 * Resolved URL (after discovery if applicable)
	 */
	resolvedUrl?: string

	/**
	 * Number of tools available from this server
	 */
	toolCount: number

	/**
	 * Error message if status is 'error'
	 */
	error?: string

	/**
	 * Session ID for local servers (for cleanup)
	 */
	sessionId?: string
}

/**
 * Default MCP configuration
 */
export const DEFAULT_MCP_CONFIG: Partial<McpConfig> = {
	// enabled is undefined by default (auto-enables when servers are defined)
	connectionTimeout: 30000,
	toolTimeout: 60000
}
