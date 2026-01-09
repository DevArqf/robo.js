# MCP Client Manager

> **For AI Agents**: Read this when implementing MCP server connections or debugging MCP initialization issues.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/mcp/McpClientManager.ts`

## Purpose

Manages lifecycle of multiple MCP clients (one per server), handles connection, tool loading, and cleanup.

## API

```typescript
class McpClientManager {
  async connect(): Promise<void>
  async disconnect(): Promise<void>
  isConnected(): boolean
  getTools(): McpToolDefinition[]
  getServerInfos(): McpServerInfo[]
  getServerInfo(serverId: string): McpServerInfo | undefined
}
```

## Server Status

```typescript
type McpServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface McpServerInfo {
  serverId: string
  status: McpServerStatus
  toolCount: number
  resolvedUrl?: string
  error?: string
}
```

## Connection Flow

1. For each server in config:
   - If local (__DISCOVERED__): start process + wait for URL
   - If remote: use provided URL
2. Create AI SDK MCP client with HTTP/SSE transport
3. Call client.tools() to load available tools
4. Prefix tool names with serverId using `serverId__toolName` format
5. Track client for cleanup

## Tool Prefixing

MCP tools are namespaced to prevent conflicts between servers. The format is:

```
{serverId}__{toolName}
```

**Example:**
- Server ID: `filesystem`
- Tool name: `read_file`
- Prefixed name: `filesystem__read_file`

This prefixing:
- Prevents tool name collisions between different MCP servers
- Allows the manager to route tool calls to the correct server
- Uses double underscore (`__`) as separator to avoid conflicts with tool names containing single underscores

## Related

- [Tool Adapter](./tool-adapter.md)
- [Local Servers](./local-servers.md)
- [Configuration](./configuration.md)
