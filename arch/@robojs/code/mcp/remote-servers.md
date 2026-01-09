# Remote MCP Servers

> **For AI Agents**: Read this when integrating backend MCP gateways or implementing the patch-plan rule.

## Overview

Remote MCP servers accessed via backend gateway URLs with authentication. Cannot directly modify filesystem - use ProposedChanges pattern.

## Configuration

```typescript
{
  serverId: {
    transport: 'http',
    url: 'https://api.example.com/mcp/robo',
    headers: {
      Authorization: 'Bearer sessionToken',
      'X-Tenant-ID': 'tenant-123'
    },
    isRemote: true  // Enables patch-plan rule
  }
}
```

## Patch-Plan Rule

Remote tools return proposals instead of direct modifications:

```typescript
// Remote tool result
{
  proposedChanges: {
    changes: [
      { path: '/src/auth.ts', type: 'create', content: '...' },
      { path: '/src/routes.ts', type: 'modify', content: '...' }
    ]
  },
  data: { success: true },
  notes: 'Generated authentication with OAuth2 support'
}

// Adapter triggers approval
{
  requiresApproval: true,
  pendingChanges: [...],
  pendingDiffs: [...],
  approvalReason: 'Generated authentication with OAuth2 support'
}
```

## Authentication

Headers passed to every MCP request:

```typescript
const client = await experimental_createMCPClient({
  transport: 'http',
  url: config.url,
  headers: config.headers  // Auth, tenant, etc.
})
```

## Related

- [Tool Adapter](./tool-adapter.md)
- [Configuration](./configuration.md)
