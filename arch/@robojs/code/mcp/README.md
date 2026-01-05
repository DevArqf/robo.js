# MCP Integration

> **For AI Agents**: Read this when integrating Model Context Protocol servers, configuring local/remote MCP, or extending agent capabilities with custom tools.

## Overview

MCP (Model Context Protocol) integration allows extending the agent with domain-specific tools, resources, and prompts from external servers. The SDK supports HTTP/SSE transports for WebContainer compatibility.

**Key Files:**
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/mcp/McpClientManager.ts` - Client manager
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/mcp/McpToolAdapter.ts` - Tool adapter
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/mcp/types.ts` - Type definitions

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   MCP INTEGRATION                             │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  CodeAgent                                                   │
│      ↓                                                        │
│  McpClientManager (lazy init on first run)                   │
│      ├─ Local MCP Servers                                    │
│      │   ├─ Start process via provider.startSession()        │
│      │   ├─ Wait for URL via serviceDiscovery                │
│      │   └─ Connect via HTTP/SSE transport                   │
│      │                                                        │
│      └─ Remote MCP Servers                                   │
│          ├─ Direct URL connection                             │
│          ├─ Auth headers                                      │
│          └─ Patch-plan rule (ProposedChanges)                │
│                         ↓                                     │
│  McpToolAdapter                                              │
│      ├─ Converts MCP tools to SDK ToolDefinition             │
│      ├─ Prefixes names: serverId__toolName                   │
│      ├─ Attaches metadata: serverId, isRemote                │
│      └─ Handles ProposedChanges for remote tools             │
│                         ↓                                     │
│  ToolRegistry                                                │
│      └─ MCP tools registered alongside core tools            │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Documents

1. [Client Manager](./client-manager.md) - Server lifecycle, tool loading
2. [Tool Adapter](./tool-adapter.md) - MCP → SDK conversion
3. [Local Servers](./local-servers.md) - URL discovery, auto-start
4. [Remote Servers](./remote-servers.md) - Gateway integration, patch-plan
5. [Configuration](./configuration.md) - McpConfig, transport types

---

## Quick Reference

### McpConfig

```typescript
{
  enabled?: boolean,  // Auto-enables when servers defined
  servers: {
    [serverId: string]: McpServerConfig
  },
  connectionTimeout?: number,  // 30s default
  toolTimeout?: number         // 60s default
}
```

### Local Server

```typescript
{
  transport: 'http' | 'sse',
  url: '__DISCOVERED__',
  startCommand: { command: 'node', args: ['mcp-server.js'] },
  expectedPort: 3001
}
```

### Remote Server

```typescript
{
  transport: 'http',
  url: 'https://api.example.com/mcp/robo',
  headers: { Authorization: 'Bearer token' },
  isRemote: true
}
```

---

## Tool Name Prefixing

MCP tools prefixed to avoid collisions:

```
Original: generate_code
Registered: roboCloud__generate_code
```

---

## Patch-Plan Rule

Remote servers return ProposedChanges instead of direct mutations:

```typescript
// Remote MCP tool result
{
  proposedChanges: {
    changes: [
      { path: '/src/new.ts', type: 'create', content: '...' }
    ]
  },
  notes: 'Generated authentication module'
}

// Adapter converts to approval request
{
  requiresApproval: true,
  pendingChanges: [...],
  approvalReason: 'Generated authentication module'
}
```

---

## Related Documents

- [Client Manager](./client-manager.md)
- [Tool Adapter](./tool-adapter.md)
- [Local Servers](./local-servers.md)
- [Remote Servers](./remote-servers.md)
- [Configuration](./configuration.md)
