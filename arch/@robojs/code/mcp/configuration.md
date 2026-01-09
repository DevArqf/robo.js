# MCP Configuration

> **For AI Agents**: Reference for McpConfig structure, transport types, and auto-enable behavior.

## McpConfig Structure

```typescript
interface McpConfig {
  enabled?: boolean          // Auto-enables if servers defined
  servers: {
    [serverId: string]: McpServerConfig
  }
  connectionTimeout?: number // 30s default
  toolTimeout?: number       // 60s default
}

interface McpServerConfig {
  transport: 'http' | 'sse' | 'streamable_http'
  url: string | '__DISCOVERED__'
  headers?: Record<string, string>
  isRemote?: boolean
  startCommand?: {
    command: string
    args: string[]
    env?: Record<string, string>
  }
  expectedPort?: number
}
```

## Auto-Enable Behavior

| enabled | servers | Result |
|---------|---------|--------|
| undefined | Defined | MCP enabled |
| undefined | Empty | MCP disabled |
| true | Any | MCP enabled |
| false | Any | MCP disabled |

## Transport Types

- **http** - Streamable HTTP (recommended for WebContainer)
- **sse** - Server-Sent Events
- **streamable_http** - Alias for 'http'

**No stdio:** Not available in browser environments

## Related

- [Client Manager](./client-manager.md)
- [Local Servers](./local-servers.md)
- [Remote Servers](./remote-servers.md)
