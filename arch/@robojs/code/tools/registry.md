# Tool Registry

> **For AI Agents**: Read this when adding new tools, generating schemas for LLM binding, or understanding tool lookup mechanisms.

## Overview

The ToolRegistry stores and manages tool definitions, generates JSON schemas for LLM function calling, and provides type-safe tool lookup.

**Key File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/runtime/registry.ts`

---

## ToolRegistry Class

### API

```typescript
class ToolRegistry {
  register<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): void
  get(name: string): ToolDefinition | undefined
  getAll(): ToolDefinition[]
  getSchemas(): ToolSchema[]
  has(name: string): boolean
  unregister(name: string): void
  clear(): void
  get size(): number
}
```

---

## Tool Definition

```typescript
interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string                          // Unique identifier
  description: string                   // For LLM understanding
  schema: z.ZodType<TInput>             // Zod schema for validation
  execute: (
    args: TInput,
    context: ToolContext
  ) => Promise<ToolResult<TOutput>>
  mutates?: boolean                     // Can modify filesystem
  requiresApproval?: boolean            // Needs user approval
}
```

### Example Tool

```typescript
import { z } from 'zod'

const fsReadTool: ToolDefinition<{ path: string }, string> = {
  name: 'fs_read',
  description: 'Read the contents of a file',

  schema: z.object({
    path: z.string().describe('File path to read')
  }),

  async execute(args, context) {
    const { path } = args

    try {
      const content = await context.provider.readFile(path)

      // Track for stale detection
      const stat = await context.provider.stat(path)
      context.fileTracker?.record({
        path,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        readAt: Date.now(),
        exists: true
      })

      return successResult(content)
    } catch (error) {
      return errorResult(`Failed to read ${path}: ${error.message}`, {
        errorCode: 'EXECUTION_FAILED',
        recoverable: true
      })
    }
  }
}
```

---

## Schema Generation

### getSchemas()

Converts Zod schemas to JSON Schema for LLM binding:

```typescript
getSchemas(): ToolSchema[] {
  return Array.from(this.tools.values()).map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.schema, {
        target: 'openApi3',
        $refStrategy: 'none'
      })
    }
  }))
}
```

### OpenAPI 3 Format

```typescript
// Zod schema
z.object({
  path: z.string().describe('File path'),
  content: z.string().describe('File content')
})

// Converted to JSON Schema
{
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'File path'
    },
    content: {
      type: 'string',
      description: 'File content'
    }
  },
  required: ['path', 'content'],
  additionalProperties: false
}
```

---

## Registration

### Adding Tools

```typescript
const registry = new ToolRegistry()

// Register core tools
registry.register(fsReadTool)
registry.register(fsWriteTool)

// Register custom tool
registry.register({
  name: 'custom_tool',
  description: 'Does custom work',
  schema: z.object({ input: z.string() }),
  async execute(args, context) {
    return successResult({ result: 'done' })
  }
})
```

### Overwrite Warning

```typescript
registry.register(fsReadTool)     // OK
registry.register(fsReadTool)     // Warns: "Tool fs_read already registered, overwriting"
```

**Check first:**
```typescript
if (!registry.has('fs_read')) {
  registry.register(fsReadTool)
}
```

---

## Tool Lookup

### Safe Lookup

```typescript
const tool = registry.get('fs_read')

if (tool) {
  const result = await tool.execute({ path: '/file.ts' }, context)
}
```

### Required Lookup

```typescript
const tool = registry.get(toolName)

if (!tool) {
  throw new CodeAgentError(
    `Unknown tool: ${toolName}`,
    'UNKNOWN_TOOL',
    false  // Not recoverable
  )
}
```

---

## MCP Tool Integration

### Tool Name Prefixing

MCP tools registered with prefix:

```typescript
// MCP tool from server 'roboCloud'
const mcpTool = {
  name: 'generate_code',
  description: '...',
  schema: z.object({ ... }),
  execute: async (args) => {
    return await mcpClient.callTool('roboCloud', 'generate_code', args)
  }
}

// Registered as
registry.register({
  ...mcpTool,
  name: 'roboCloud__generate_code'  // Prefixed with serverId
})
```

### Namespace Isolation

Prevents name collisions:
```typescript
// Core tool
registry.register({ name: 'fs_read', ... })

// MCP tool with same name
registry.register({ name: 'myServer__fs_read', ... })

// No collision - different names
```

---

## Schema Quality

### Good Descriptions

LLM needs clear, actionable descriptions:

```typescript
// ❌ BAD
description: 'Read file'

// ✅ GOOD
description: 'Read the contents of a file from the project filesystem. Returns file content as string. Use fs_read_many for reading multiple files efficiently.'
```

### Parameter Descriptions

```typescript
schema: z.object({
  // ❌ BAD
  path: z.string(),

  // ✅ GOOD
  path: z.string().describe('Absolute path to file (e.g., /src/index.ts)')
})
```

### Constraints in Schema

```typescript
schema: z.object({
  maxResults: z.number()
    .int()
    .min(1)
    .max(1000)
    .default(100)
    .describe('Maximum number of search results to return (1-1000)')
})
```

---

## Related Documents

- [Executor](./executor.md) - How registered tools are executed
- [Policy](./policy.md) - Validation before execution
- [Filesystem Tools](./filesystem-tools.md) - All FS tool definitions
- [Terminal Tools](./terminal-tools.md) - All terminal tool definitions
- [MCP Tool Adapter](../mcp/tool-adapter.md) - Converting MCP tools
