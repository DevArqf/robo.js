# Local MCP Servers

> **For AI Agents**: Read this when configuring local MCP servers in WebContainer environments.

## Overview

Local MCP servers run as terminal sessions with URL discovery via service discovery system.

## Configuration

```typescript
{
  serverId: {
    transport: 'http',
    url: '__DISCOVERED__',  // Magic value
    startCommand: {
      command: 'node',
      args: ['mcp-server.js'],
      env: { PORT: '3001' }
    },
    expectedPort: 3001
  }
}
```

## Discovery Flow

1. `McpClientManager.connect()` sees `url: '__DISCOVERED__'`
2. Calls `serviceDiscovery.start(serverId, { port: expectedPort })`
3. Spawns process via `provider.startSession(startCommand)`
4. Waits for server-ready event (timeout: 30s)
5. `serviceDiscovery.waitForUrl(serverId)` resolves with WebContainer URL
6. Creates MCP client with resolved URL

## Cleanup

```typescript
await mcpManager.disconnect()
// → Stops all local sessions
// → Closes all MCP clients
```

## Related

- [Service Discovery](../execution/service-discovery.md)
- [Client Manager](./client-manager.md)
