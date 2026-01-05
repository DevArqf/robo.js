# Tool Executor

> **For AI Agents**: Read this when implementing tool execution, understanding serial execution guarantees, or debugging tool timeout/abort issues.

## Overview

The ToolExecutor is the runtime engine that executes tools serially, enforces policies, handles timeouts/aborts, and can be forked for per-run isolation.

**Key Files:**
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/runtime/executor.ts` - Main executor
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/runtime/serializer.ts` - Serial queue

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    TOOL EXECUTOR                              │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  execute(toolCall) ───→ Validate Args (Zod)                 │
│                              ↓                                │
│                         Check Policy                          │
│                              ↓                                │
│                    Enqueue in Serial Queue                    │
│                              ↓                                │
│                      [Wait for Queue]                         │
│                              ↓                                │
│                    Execute Tool Function                      │
│                              ↓                                │
│                      Wrap Result/Error                        │
│                              ↓                                │
│                      Emit Events                              │
│                              ↓                                │
│                      Return Result                            │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## ToolExecutor Class

### Constructor

```typescript
class ToolExecutor {
  constructor(
    registry: ToolRegistry,
    config: ToolExecutorConfig
  )
}

interface ToolExecutorConfig {
  context: ToolContext           // Execution context
  serialize?: boolean            // Enforce serial execution (default: true)
  timeout?: number               // Per-tool timeout in ms (default: 30000)
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

## Main API

### execute(toolCall)

Execute a single tool call:

```typescript
async execute(toolCall: PendingToolCall): Promise<ToolCallResult> {
  const startTime = Date.now()

  // 1. Emit tool_call event
  this.context.onEvent?.({
    type: 'tool_call',
    source: this.getSource(toolCall.name),
    name: toolCall.name,
    args: toolCall.args
  })

  // 2. Lookup tool
  const tool = this.registry.get(toolCall.name)
  if (!tool) {
    return this.handleError(toolCall, new Error(`Unknown tool: ${toolCall.name}`), startTime)
  }

  // 3. Validate arguments
  const parseResult = tool.schema.safeParse(toolCall.args)
  if (!parseResult.success) {
    return this.handleError(toolCall, new Error(`Invalid args: ${parseResult.error}`), startTime)
  }

  // 4. Execute with timeout
  const executeWithTimeout = async () => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Tool execution timeout')), this.timeout)
    })

    const executionPromise = tool.execute(parseResult.data, this.context)

    return Promise.race([executionPromise, timeoutPromise])
  }

  let result: ToolResult

  try {
    // 5. Serialize if configured
    if (this.serialize) {
      result = await this.queue.enqueue(() => executeWithTimeout())
    } else {
      result = await executeWithTimeout()
    }
  } catch (error) {
    return this.handleError(toolCall, error, startTime)
  }

  // 6. Emit tool_result event
  this.context.onEvent?.({
    type: 'tool_result',
    source: this.getSource(toolCall.name),
    name: toolCall.name,
    result
  })

  // 7. Return with metadata
  return {
    callId: toolCall.id,
    toolName: toolCall.name,
    result,
    durationMs: Date.now() - startTime,
    startedAt: startTime,
    completedAt: Date.now()
  }
}
```

---

### executeMany(toolCalls)

Execute multiple tool calls (stops on approval required):

```typescript
async executeMany(toolCalls: PendingToolCall[]): Promise<ToolCallResult[]> {
  const results: ToolCallResult[] = []

  for (const toolCall of toolCalls) {
    const result = await this.execute(toolCall)
    results.push(result)

    // Stop if approval required
    if (result.result.requiresApproval) {
      break
    }
  }

  return results
}
```

**Why stop on approval?**
- Tools after approval may depend on applied changes
- Approval rejection may make remaining tools invalid
- User should see changes before continuing

---

## Forking for Run Isolation

### fork(overrides)

Create new executor with same registry but different context:

```typescript
fork(overrides: Partial<ToolContext>): ToolExecutor {
  return new ToolExecutor(this.registry, {
    context: { ...this.context, ...overrides },
    serialize: this.serialize,
    timeout: this.timeout
  })
}
```

### Why Fork?

Each run needs isolated execution:
- **FileReadTracker**: Independent stale detection per run
- **runId**: Separate correlation ID
- **signal**: Independent abort control
- **onEvent**: Different event sinks

**Usage:**
```typescript
// In CodeAgent.start()
const toolExecutor = this.toolExecutor.fork({
  runId: newRunId,
  signal: abortController.signal,
  onEvent: (event) => runInfo.eventQueue.push(event),
  fileTracker: new FileReadTracker()
})
```

---

## Serial Execution

### SerialExecutionQueue

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/runtime/serializer.ts`

```typescript
class SerialExecutionQueue {
  enqueue<T>(execute: () => Promise<T>): Promise<T>
  getStats(): ExecutionQueueStats
  drain(): Promise<void>
  abort(reason: string): void
  reset(): void
  isIdle(): boolean
  isAborted(): boolean  // Check if queue has been aborted
}
```

### FIFO Guarantees

```typescript
// Three tools enqueued
queue.enqueue(() => tool1())  // Starts immediately
queue.enqueue(() => tool2())  // Waits for tool1
queue.enqueue(() => tool3())  // Waits for tool2

// Execution order: tool1 → tool2 → tool3 (guaranteed)
```

### Concurrency

Only one tool executes at a time:

```typescript
queue.enqueue(async () => {
  await longRunningOperation()  // Takes 10 seconds
})

queue.enqueue(async () => {
  await quickOperation()  // Waits 10 seconds, then runs
})
```

---

## Timeout Enforcement

### Per-Tool Timeout

Default: 30 seconds

```typescript
const executor = new ToolExecutor(registry, {
  context,
  timeout: 60_000  // 60s for slower tools
})
```

### Timeout Behavior

```typescript
// Tool exceeds timeout
try {
  await executor.execute({
    name: 'slow_tool',
    args: { ... }
  })
} catch (error) {
  // error.code === 'TIMEOUT'
  // error.message === 'Tool execution timeout'
  // error.recoverable === true
}
```

### Custom Timeout Per Tool

```typescript
// In tool definition
async execute(args, context) {
  // Check remaining time from signal/deadline
  const remainingMs = getRemainingTime(context.signal)

  if (remainingMs < 5000) {
    throw new Error('Insufficient time remaining')
  }

  // Continue with operation
}
```

---

## Abort Semantics

### Signal Propagation

Abort signal passed to tool context:

```typescript
async execute(args, context) {
  // Check if aborted
  if (context.signal?.aborted) {
    throw new Error('Aborted')
  }

  // Pass signal to provider operations
  await context.provider.run('npm', ['install'], {
    signal: context.signal
  })
}
```

### Abort All Pending

```typescript
// Abort executor (cancels queue)
await executor.abort('User cancelled')

// All pending tools rejected
// Currently executing tool receives abort signal
```

---

## ToolResult Structure

```typescript
interface ToolResult<T = unknown> {
  success: boolean              // Whether the tool execution succeeded
  data?: T                      // Result data (only present on success)
  error?: string                // Error message (only present on failure)
  errorCode?: string            // Error code for programmatic handling
  recoverable?: boolean         // Whether the error is recoverable (agent can retry)

  // Approval fields
  requiresApproval?: boolean    // Whether approval is required to proceed
  pendingChanges?: FileChange[] // File changes pending approval
  pendingDiffs?: FileDiff[]     // Diffs for pending changes
  approvalReason?: string       // Reason for requiring approval

  // Terminal approval
  pendingCommand?: {            // Command details for terminal approval
    executable: string
    args: string[]
    cwd?: string
  }
}
```

---

## Error Handling

### Exception to ToolResult

Executor converts exceptions to structured results:

```typescript
private handleError(
  toolCall: PendingToolCall,
  error: unknown,
  startTime: number
): ToolCallResult {
  const result: ToolResult = {
    success: false,
    error: error instanceof Error ? error.message : String(error),
    errorCode: 'EXECUTION_FAILED',
    recoverable: true
  }

  // Emit error result
  this.context.onEvent?.({
    type: 'tool_result',
    source: this.getSource(toolCall.name),
    name: toolCall.name,
    result
  })

  return {
    callId: toolCall.id,
    toolName: toolCall.name,
    result,
    durationMs: Date.now() - startTime,
    startedAt: startTime,
    completedAt: Date.now()
  }
}
```

**Benefits:**
- Agent sees errors as tool results (recoverable)
- Can retry with different args
- Doesn't crash entire run

---

## FileReadTracker Integration

### Automatic Tracking

Executor provides fileTracker in context:

```typescript
const executor = new ToolExecutor(registry, {
  context: {
    ...context,
    fileTracker: new FileReadTracker()
  }
})
```

### Tools Use Tracker

```typescript
// fs_read records snapshot
context.fileTracker?.record({
  path,
  mtimeMs: stat.mtimeMs,
  size: stat.size,
  readAt: Date.now(),
  exists: true
})

// fs_write checks staleness
const snapshot = context.fileTracker?.get(path)
if (snapshot) {
  const current = await context.provider.stat(path)
  const check = checkStaleness(snapshot, current)

  if (!check.isStale) {
    // Proceed with write
  } else {
    throw new Error(`File stale: ${check.reason}`)
  }
}

// Clear after write
context.fileTracker?.clear(path)
```

---

## Drain Pattern

### Wait for Completion

```typescript
// Enqueue many tools
for (const file of files) {
  executor.execute({ name: 'fs_read', args: { path: file } })
}

// Wait for all to finish
await executor.drain()

console.log('All reads complete')
```

---

## Related Documents

- [Registry](./registry.md) - Tool registration
- [Policy](./policy.md) - Policy validation
- [Stale Detection](./stale-detection.md) - FileReadTracker
- [Serial Queue](./executor.md#serial-execution) - Queue implementation
- [Orchestration](../orchestration/state-machine.md) - Integration with graph
