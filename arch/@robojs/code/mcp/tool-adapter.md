# MCP Tool Adapter

> **For AI Agents**: Read this when converting MCP tools to SDK format or understanding the patch-plan rule for remote servers.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/mcp/McpToolAdapter.ts`

## Purpose

Converts MCP tool definitions to SDK ToolDefinition format with name prefixing, metadata attachment, and ProposedChanges handling for remote servers.

## Conversion

```typescript
// MCP tool (from @ai-sdk/mcp)
{
  description: 'Generate code',
  inputSchema: { type: 'object', properties: { prompt: { type: 'string' } } },
  execute: async (args) => mcpClient.callTool(args)
}

// Converted to SDK ToolDefinition
{
  name: 'roboCloud__generate_code',  // Prefixed with serverId__
  description: 'Generate code',
  schema: z.object({ prompt: z.string() }),  // Converted to Zod schema
  execute: async (args, context) => {
    const result = await mcpClient.callTool('generate_code', args)

    // If remote server + proposedChanges in result
    if (isRemote && result.proposedChanges) {
      return approvalRequired(
        result.proposedChanges.changes,
        generateDiffs(result.proposedChanges.changes),
        result.notes || 'Remote MCP tool proposed changes'
      )
    }

    return successResult(result.data)
  }
}
```

## Patch-Plan Rule

Remote MCP servers cannot directly modify WebContainer filesystem. Instead:
- Return `proposedChanges` with FileChange[]
- Adapter triggers approval flow
- After approval, core apply_changes applies modifications

## Metadata

Every MCP tool includes:
```typescript
{
  metadata: {
    serverId: string,
    isRemote: boolean,
    originalName: string
  }
}
```

## Related

- [Client Manager](./client-manager.md)
- [Remote Servers](./remote-servers.md)
