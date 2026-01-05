# Tool System

> **For AI Agents**: Read this when adding tools, understanding tool execution, or debugging tool-related issues. This layer provides all agent capabilities for file and terminal operations.

## Overview

The tool system provides 19 tools across three categories: filesystem (13), terminal (5), and changes (1). All tools execute serially through a queue, are validated against AgentPolicy, and track file staleness for data safety.

**Key Files:**
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/runtime/registry.ts` - Tool registry
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/runtime/executor.ts` - Tool executor
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/runtime/policy.ts` - Policy validator

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      TOOL SYSTEM                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LangGraph                                                      │
│      ↓                                                           │
│  ToolNode (tools)                                               │
│      ↓                                                           │
│  ToolExecutor                                                   │
│      ├─ Schema Validation (Zod)                                 │
│      ├─ Policy Check (PolicyValidator)                          │
│      ├─ Serial Queue (one at a time)                            │
│      └─ Stale Detection (FileReadTracker)                       │
│           ↓                                                      │
│  Tool Definition                                                │
│      ├─ fs_read, fs_write, fs_delete, ...   (13 FS tools)      │
│      ├─ terminal_run, terminal_session_start, ... (5 term tools)│
│      └─ apply_changes                       (1 change tool)     │
│           ↓                                                      │
│  ExecutionProvider                                              │
│      └─ Actual filesystem/terminal operations                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tool Inventory

### Filesystem Tools (13 total)

**Core Operations (7):**
1. `fs_read` - Read single file with truncation
2. `fs_read_many` - Read multiple files in one call
3. `fs_write` - Write/overwrite file with stale check
4. `fs_delete` - Delete file or directory
5. `fs_list` - List directory contents
6. `fs_search` - Search files by pattern
7. `fs_snapshot` - Get project snapshot (bounded)

**Scale Primitives (6):**
8. `fs_stat` - Get file metadata (size, mtime)
9. `fs_read_range` - Read byte range from file
10. `fs_read_head` - Read first N bytes
11. `fs_read_tail` - Read last N bytes
12. `fs_grep` - Search within file contents
13. `fs_outline` - Get code structure/symbols

### Terminal Tools (5 total)

**One-Shot Execution (2):**
1. `terminal_run` - Execute and wait for completion
2. `terminal_run_stream` - Execute with streaming output

**Session Management (3):**
3. `terminal_session_start` - Start long-running process
4. `terminal_session_stream` - Poll session for new output
5. `terminal_session_stop` - Stop running session

### Change Tools (1 total)

**Atomic Application (1):**
1. `apply_changes` - Atomically apply file changes with approval flow

---

## Components

### 1. Tool Registry
Tool registration and schema generation for LLM binding.

**Read:** [registry.md](./registry.md)

### 2. Tool Executor
Serial execution, forking, timeout enforcement, abort semantics.

**Read:** [executor.md](./executor.md)

### 3. Policy Enforcement
AgentPolicy validation for commands, files, and resources.

**Read:** [policy.md](./policy.md)

### 4. Filesystem Tools
All 13 filesystem tools with args, limits, and use cases.

**Read:** [filesystem-tools.md](./filesystem-tools.md)

### 5. Terminal Tools
One-shot vs session patterns for all 5 terminal tools.

**Read:** [terminal-tools.md](./terminal-tools.md)

### 6. Change Tools
apply_changes with validation→diff→approve→apply→rollback flow.

**Read:** [change-tools.md](./change-tools.md)

### 7. Stale Detection
FileReadTracker for detecting file modifications between read and write.

**Read:** [stale-detection.md](./stale-detection.md)

---

## Tool Definition Structure

```typescript
interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string
  description: string
  schema: z.ZodType<TInput>  // Zod schema for validation
  execute: (
    args: TInput,
    context: ToolContext
  ) => Promise<ToolResult<TOutput>>
  mutates?: boolean          // Can modify filesystem
  requiresApproval?: boolean // Needs user approval
}

interface ToolContext {
  provider: ExecutionProvider
  policy: AgentPolicy
  runId: string
  onEvent?: (event: AgentEvent) => void
  signal?: AbortSignal
  registerSession?: (sessionId: string) => void
  unregisterSession?: (sessionId: string) => void
  fileTracker?: FileReadTracker
}
```

---

## Execution Flow

```
1. LangGraph ToolNode receives tool_calls from LLM
2. ToolNode calls ToolExecutor.executeMany(toolCalls)
3. ToolExecutor validates args with Zod schema
4. ToolExecutor checks policy (command allowlist, file size, deny paths)
5. ToolExecutor enqueues in SerialExecutionQueue (FIFO)
6. Queue executes one tool at a time
7. Tool executes via provider.method()
8. Result wrapped in ToolResult
9. Exceptions converted to error ToolResult (recoverable)
10. ToolExecutor emits tool_call/tool_result events
11. If requiresApproval, execution stops early
12. ToolNode converts results to ToolMessage[]
13. Messages appended to state
```

---

## Default Tool Registry

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/index.ts:createDefaultToolRegistry`

```typescript
export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry()

  // Filesystem tools
  registry.register(fsReadTool)
  registry.register(fsReadManyTool)
  registry.register(fsWriteTool)
  registry.register(fsDeleteTool)
  registry.register(fsListTool)
  registry.register(fsSearchTool)
  registry.register(fsSnapshotTool)
  registry.register(fsStatTool)
  registry.register(fsReadRangeTool)
  registry.register(fsReadHeadTool)
  registry.register(fsReadTailTool)
  registry.register(fsGrepTool)
  registry.register(fsOutlineTool)

  // Terminal tools
  registry.register(terminalRunTool)
  registry.register(terminalRunStreamTool)
  registry.register(terminalSessionStartTool)
  registry.register(terminalSessionStreamTool)
  registry.register(terminalSessionStopTool)

  // Change tools
  registry.register(applyChangesTool)

  return registry
}
```

---

## Tool Execution Guarantees

### 1. Serial Execution

Tools execute one at a time (FIFO queue):
```typescript
// Even if LLM requests parallel
[
  { name: 'fs_read', args: { path: '/a.ts' } },
  { name: 'fs_read', args: { path: '/b.ts' } },
  { name: 'fs_write', args: { path: '/c.ts', content: '...' } }
]

// Execution order is guaranteed:
// 1. fs_read(/a.ts)
// 2. fs_read(/b.ts)
// 3. fs_write(/c.ts)
```

### 2. Policy Enforcement

Every tool validated before execution:
- Commands checked against allowlist + argument policy
- Files checked against size limits + deny paths
- Resources checked against snapshot/diff limits

### 3. Stale Detection

File writes check if file changed since last read:
```typescript
// Agent reads file
fs_read({ path: '/src/index.ts' })  // Records: mtime=T1, size=1000

// File modified externally (e.g., user edit)
// Now: mtime=T2, size=1050

// Agent tries to write
fs_write({ path: '/src/index.ts', content: '...' })  // ❌ STALE_FILE error
```

### 4. Approval Flow

apply_changes tool triggers approval when configured:
```typescript
if (policy.autoApprove === false) {
  return approvalRequired(changes, diffs, reason)
}
```

---

## Usage Patterns

### Reading Files

```typescript
// Single file
const result = await toolExecutor.execute({
  name: 'fs_read',
  args: { path: '/src/index.ts' }
})

// Multiple files (more efficient)
const result = await toolExecutor.execute({
  name: 'fs_read_many',
  args: { paths: ['/src/a.ts', '/src/b.ts', '/package.json'] }
})
```

### Writing Files

```typescript
// Direct write (single file)
const result = await toolExecutor.execute({
  name: 'fs_write',
  args: { path: '/src/new.ts', content: 'export const x = 1' }
})

// Batch changes (with approval)
const result = await toolExecutor.execute({
  name: 'apply_changes',
  args: {
    changes: [
      { path: '/src/a.ts', type: 'create', content: '...' },
      { path: '/src/b.ts', type: 'modify', content: '...' },
      { path: '/src/old.ts', type: 'delete' }
    ]
  }
})
```

### Running Commands

```typescript
// One-shot
const result = await toolExecutor.execute({
  name: 'terminal_run',
  args: { command: 'npm', args: ['install'] }
})

// Session for long-running
const startResult = await toolExecutor.execute({
  name: 'terminal_session_start',
  args: { command: 'npm', args: ['run', 'dev'] }
})

const sessionId = startResult.data.sessionId

// Stream output
const streamResult = await toolExecutor.execute({
  name: 'terminal_session_stream',
  args: { sessionId }
})
```

---

## Related Documents

- [Registry](./registry.md) - Tool registration
- [Executor](./executor.md) - Execution engine
- [Policy](./policy.md) - Security enforcement
- [Filesystem Tools](./filesystem-tools.md) - All 13 FS tools
- [Terminal Tools](./terminal-tools.md) - All 5 terminal tools
- [Change Tools](./change-tools.md) - apply_changes workflow
- [Stale Detection](./stale-detection.md) - FileReadTracker
- [Orchestration](../orchestration/README.md) - How tools integrate with graph
