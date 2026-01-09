# Run Lifecycle

> **For AI Agents**: Read this when implementing run management, understanding the public API, or debugging start/stream/resume/abort workflows.

## Overview

The CodeAgent public API manages run lifecycle through four main methods: start, stream, resume, and abort. Each run has a unique runId that maps 1:1 to a LangGraph threadId.

**Key File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/CodeAgent.ts`

---

## Run Identity

### runId = threadId (1:1 Mapping)

```typescript
// Generated in CodeAgent.start()
const runId = uuid()  // Full UUID v4
const threadId = runId  // Same value, different semantic meaning

// Used for:
const config = { configurable: { thread_id: threadId } }
```

**Benefits:**
- Simplifies API (one ID for everything)
- Checkpoints naturally scoped to runs
- Multi-run isolation guaranteed
- Debugging easier with consistent correlation

---

## API Methods

### start(request: StartRunRequest)

**Purpose:** Create a new run and initialize state

**Request:**
```typescript
interface StartRunRequest {
  input: string                     // User instruction (required)
  mode?: RunMode                    // 'explain' | 'plan' | 'execute' (default: 'execute')
  continueFrom?: string             // Inherit state from previous runId
  modelAlias?: BrandedModelAlias    // Override model selection
  debugMode?: boolean               // Enable debug events
}
```

**Response:**
```typescript
interface StartRunResult {
  runId: string  // Unique run identifier
}
```

**Logic:**

1. **Generate runId**
   ```typescript
   const runId = uuid()  // Full UUID v4
   ```

2. **Initialize MCP (lazy, first run only)**
   ```typescript
   if (!this.mcpInitialized && this.mcpConfig) {
     this.mcpManager = await createMcpClientManager(...)
     await this.mcpManager.connect()
     this.mcpInitialized = true
   }
   ```

3. **Fork ToolExecutor for run isolation**
   ```typescript
   const toolExecutor = this.toolExecutor.fork({
     runId,
     onEvent: (event) => runInfo.eventQueue.push(event),
     signal: abortController.signal
   })
   ```

4. **Build LangGraph**
   ```typescript
   const graph = buildGraph({
     provider: this.provider,
     policy: this.policy,
     llm: this.llm,
     toolExecutor,
     projectIndexer: this.projectIndexer,
     projectOverviewBuilder: this.projectOverviewBuilder,
     checkpointer: new MemorySaver(),
     onEvent: (event) => runInfo.eventQueue.push(event),
     runId,
     signal: abortController.signal
   })
   ```

5. **Store RunInfo**
   ```typescript
   this.runs.set(runId, {
     runId,
     mode: request.mode ?? 'execute',
     input: request.input,
     status: 'running',
     createdAt: Date.now(),
     graph,
     toolExecutor,
     abortController,
     eventQueue: [],
     activeSessions: new Set(),
     pendingResume: null
   })
   ```

6. **Return runId**
   ```typescript
   return { runId }
   ```

**State Created:** None yet - graph not started until stream() called

---

### stream(runId: string, options?: StreamOptions)

**Purpose:** Start/continue execution and stream events

**Request:**
```typescript
interface StreamOptions {
  includeText?: boolean              // LLM text deltas (default: true)
  includePlan?: boolean              // Plan events (default: true)
  includeProgress?: boolean          // Progress updates (default: true)
  includeRationales?: boolean        // User-facing reasoning (default: false)
  includeToolCalls?: boolean         // Core tool calls (default: true)
  includeToolResults?: boolean       // Core tool results (default: true)
  includeMcpCalls?: boolean          // MCP tool calls (default: true)
  includeMcpResults?: boolean        // MCP tool results (default: true)
  includeDebugEvents?: boolean       // Debug events (default: false)
}
```

**Response:** AsyncGenerator<AgentEvent>

**Logic:**

1. **Lookup RunInfo**
   ```typescript
   const runInfo = this.runs.get(runId)
   if (!runInfo) throw new Error(`Run not found: ${runId}`)
   ```

2. **Create StreamAdapter**
   ```typescript
   const adapter = new StreamAdapter({
     runId,
     options,
     onEvent: (event) => eventQueue.push(event)
   })
   ```

3. **Determine Input State**
   ```typescript
   let input: AgentState | null

   if (runInfo.pendingResume) {
     // RESUME after interrupt
     await graph.updateState(config, buildResumeUpdate(runInfo.pendingResume))
     input = null  // ← CRITICAL: null resumes from checkpoint
     runInfo.pendingResume = null

   } else if (isFirstStream) {
     // FRESH START
     input = {
       mode: runInfo.mode,
       instruction: runInfo.input,
       messages: [new HumanMessage(runInfo.input)]
     }
     if (request.continueFrom) {
       // Inherit state from previous run
       const prevState = await this.getState(request.continueFrom)
       input = { ...input, ...inheritFields(prevState) }
     }

   } else {
     // CONTINUE (no interrupt)
     input = null
   }
   ```

4. **Emit start Event (first stream only)**
   ```typescript
   if (isFirstStream) {
     yield { type: 'start', runId, instruction, mode }
   }
   ```

5. **Stream Graph Execution**
   ```typescript
   try {
     for await (const update of graph.stream(input, {
       configurable: { thread_id: runId },
       streamMode: ['updates', 'custom']  // Dual mode
     })) {
       // Process update and yield events
       const events = adapter.transform(update)
       for (const event of events) {
         yield event
       }
     }
   } catch (error) {
     if (error.name === 'GraphRecursionError') {
       // Handle as limit interrupt (see above)
     } else {
       throw error
     }
   }
   ```

6. **Emit Terminal Event**
   ```typescript
   // If not already emitted by graph
   if (!terminalEventSent) {
     const state = await graph.getState(config)
     if (state.values.completionSummary) {
       yield { type: 'complete', summary: state.values.completionSummary, ... }
     } else if (state.values.aborted) {
       yield { type: 'abort', reason: state.values.abortReason }
     }
   }
   ```

7. **Update RunInfo Status**
   ```typescript
   runInfo.status = state.values.completionSummary ? 'completed' : 'paused'
   runInfo.updatedAt = Date.now()
   ```

**State Updates:** Depends on graph execution (see nodes)

---

### resume(request: ResumeRunRequest)

**Purpose:** Provide response to interrupt and prepare for stream continuation

**Request:**
```typescript
interface ResumeRunRequest {
  runId: string

  // For question interrupt
  answer?: QuestionAnswer

  // For approval interrupt
  approval?: ApprovalResponse

  // For limit interrupt
  continueAfterLimit?: boolean
}
```

**Response:** void (async)

**Logic:**

1. **Lookup RunInfo**
   ```typescript
   const runInfo = this.runs.get(runId)
   if (!runInfo) throw new Error(`Run not found: ${runId}`)
   ```

2. **Store Pending Resume**
   ```typescript
   runInfo.pendingResume = {
     answer: request.answer,
     approval: request.approval,
     continueAfterLimit: request.continueAfterLimit
   }
   ```

3. **Return Immediately**
   ```typescript
   // Does NOT call graph.stream()
   // User must call stream() to continue
   ```

**IMPORTANT:** `resume()` only stores data. User must call `stream()` to actually resume execution.

---

### abort(request: AbortRunRequest)

**Purpose:** Cancel a run and clean up resources

**Request:**
```typescript
interface AbortRunRequest {
  runId: string
  reason: string  // Why aborting
}
```

**Response:** void (async)

**Logic:**

1. **Lookup RunInfo**
   ```typescript
   const runInfo = this.runs.get(runId)
   if (!runInfo) return  // Already cleaned up
   ```

2. **Signal Abort**
   ```typescript
   runInfo.abortController.abort()
   ```

3. **Abort ToolExecutor**
   ```typescript
   await runInfo.toolExecutor.abort(request.reason)
   ```

4. **Stop Active Sessions**
   ```typescript
   for (const sessionId of runInfo.activeSessions) {
     await this.provider.stopSession({ sessionId, kind: 'webcontainer' })
   }
   runInfo.activeSessions.clear()
   ```

5. **Update Graph State**
   ```typescript
   await runInfo.graph.updateState(
     { configurable: { thread_id: runId } },
     { aborted: true, abortReason: request.reason }
   )
   ```

6. **Emit Abort Event**
   ```typescript
   runInfo.eventQueue.push({
     type: 'abort',
     reason: request.reason
   })
   ```

7. **Update RunInfo**
   ```typescript
   runInfo.status = 'aborted'
   runInfo.updatedAt = Date.now()
   ```

**Cleanup:** Run remains in this.runs map for retrieval but marked aborted

---

## Multi-Run Management

### Query Methods

**getState(runId)**
```typescript
async getState(runId: string): Promise<AgentState | null> {
  const runInfo = this.runs.get(runId)
  if (!runInfo) return null

  const state = await runInfo.graph.getState({
    configurable: { thread_id: runId }
  })

  return state.values
}
```

**getRun(runId)**
```typescript
async getRun(runId: string): Promise<RunMeta | null> {
  const runInfo = this.runs.get(runId)
  if (!runInfo) return null

  const state = await this.getState(runId)

  return {
    runId,
    mode: runInfo.mode,
    input: runInfo.input,
    status: runInfo.status,
    createdAt: runInfo.createdAt,
    updatedAt: runInfo.updatedAt,
    appliedChanges: state?.appliedChanges ?? [],
    completionSummary: state?.completionSummary ?? null
  }
}
```

**listRunsWithMeta(filter?)**
```typescript
async listRunsWithMeta(filter?: RunFilter): Promise<RunMeta[]> {
  const runs: RunMeta[] = []

  for (const [runId, runInfo] of this.runs.entries()) {
    // Apply filter
    if (filter?.status && runInfo.status !== filter.status) continue
    if (filter?.mode && runInfo.mode !== filter.mode) continue

    const meta = await this.getRun(runId)
    if (meta) runs.push(meta)
  }

  return runs.sort((a, b) => b.createdAt - a.createdAt)
}
```

**hasRun(runId)**
```typescript
hasRun(runId: string): boolean {
  return this.runs.has(runId)
}
```

**listRuns()**
```typescript
listRuns(): string[] {
  return Array.from(this.runs.keys())
}
```

**cleanup(runId)**
```typescript
async cleanup(runId: string): Promise<void> {
  const runInfo = this.runs.get(runId)
  if (!runInfo) return

  // Ensure aborted first
  if (runInfo.status === 'running') {
    await this.abort({ runId, reason: 'Cleanup' })
  }

  this.runs.delete(runId)
}
```

**getPendingDiffs(runId)**
```typescript
async getPendingDiffs(runId: string): Promise<FileDiff[]> {
  const state = await this.getState(runId)
  return state?.pendingDiffs ?? []
}
```

**getAppliedDiffs(runId)**
```typescript
async getAppliedDiffs(runId: string): Promise<FileDiff[]> {
  const state = await this.getState(runId)
  return state?.appliedDiffs ?? []
}
```

**isMcpConnected()**
```typescript
isMcpConnected(): boolean {
  return this.mcpManager?.isConnected() ?? false
}
```

**getMcpServerInfos()**
```typescript
getMcpServerInfos(): McpServerInfo[] {
  return this.mcpManager?.getServerInfos() ?? []
}
```

---

## Session Tracking

### registerSession / unregisterSession

Tools register sessions for abort cleanup:

```typescript
// In terminal_session_start tool
const session = await provider.startSession(command, args)

// Register with agent
context.registerSession?.(session.sessionId)

return successResult({ sessionId: session.sessionId })
```

**CodeAgent Implementation:**
```typescript
registerSession(runId: string, sessionId: string): void {
  const runInfo = this.runs.get(runId)
  if (runInfo) {
    runInfo.activeSessions.add(sessionId)
  }
}

unregisterSession(runId: string, sessionId: string): void {
  const runInfo = this.runs.get(runId)
  if (runInfo) {
    runInfo.activeSessions.delete(sessionId)
  }
}
```

**Abort Cleanup:**
```typescript
// Stops all sessions registered to this run
for (const sessionId of runInfo.activeSessions) {
  await provider.stopSession({ sessionId })
}
```

---

## Cleanup and Disposal

### cleanup(runId)

Remove run from memory:

```typescript
async cleanup(runId: string): Promise<void> {
  const runInfo = this.runs.get(runId)
  if (!runInfo) return

  // Ensure aborted first
  if (runInfo.status === 'running') {
    await this.abort({ runId, reason: 'Cleanup' })
  }

  this.runs.delete(runId)
}
```

### dispose()

Cleanup all runs and disconnect MCP:

```typescript
async dispose(): Promise<void> {
  // Abort all running runs
  for (const runId of this.runs.keys()) {
    await this.abort({ runId, reason: 'Agent disposed' })
  }

  // Disconnect MCP
  if (this.mcpManager) {
    await this.mcpManager.disconnect()
  }

  // Clear runs
  this.runs.clear()
}
```

---

## Usage Patterns

### Pattern: Basic Run

```typescript
const agent = createCodeAgent({ ... })

const { runId } = await agent.start({
  input: 'Add a hello command'
})

for await (const event of agent.stream(runId)) {
  console.log(event.type)

  if (event.type === 'complete') {
    console.log('Done:', event.summary)
  }
}
```

### Pattern: Run with Approval

```typescript
const { runId } = await agent.start({
  input: 'Refactor authentication',
  mode: 'execute'
})

let pendingApproval = null

for await (const event of agent.stream(runId)) {
  if (event.type === 'approval_required') {
    pendingApproval = event
    showApprovalDialog(event.changes, event.diffs)
    break  // Exit stream
  }
}

// User approves
await agent.resume({ runId, approval: { approved: true } })

// Continue streaming
for await (const event of agent.stream(runId)) {
  if (event.type === 'complete') {
    console.log('Done!')
  }
}
```

### Pattern: Plan Then Execute

```typescript
// 1. Plan mode
const { runId: planRunId } = await agent.start({
  input: 'Add user authentication',
  mode: 'plan'
})

let plan = null

for await (const event of agent.stream(planRunId)) {
  if (event.type === 'plan_complete') {
    plan = event.plan
    displayPlan(plan)
  }
}

// 2. User reviews and accepts

// 3. Execute mode (inherit plan state)
const { runId: execRunId } = await agent.start({
  input: 'Proceed with the plan',
  mode: 'execute',
  continueFrom: planRunId  // Inherit acceptance + plan
})

for await (const event of agent.stream(execRunId)) {
  // ... execution with verification
}
```

### Pattern: Question Handling

```typescript
const { runId } = await agent.start({
  input: 'Add API routes'
})

for await (const event of agent.stream(runId)) {
  if (event.type === 'question') {
    const answer = await promptUser(event.text, event.choices)

    await agent.resume({ runId, answer })

    // Continue in same loop
    for await (const nextEvent of agent.stream(runId)) {
      // ... continues from question
    }
    break
  }
}
```

### Pattern: Limit Handling

```typescript
for await (const event of agent.stream(runId)) {
  if (event.type === 'limit_reached') {
    const shouldContinue = await askUser(
      `Iteration limit reached at ${event.iteration}. Continue?`
    )

    if (shouldContinue) {
      await agent.resume({ runId, continueAfterLimit: true })

      for await (const nextEvent of agent.stream(runId)) {
        // ... continues with increased budget
      }
    } else {
      await agent.abort({ runId, reason: 'User stopped at limit' })
    }
    break
  }
}
```

---

## Run Status

### RunMeta

```typescript
interface RunMeta {
  runId: string
  mode: RunMode
  input: string
  status: RunStatus
  createdAt: number
  updatedAt: number
  appliedChanges: FileChange[]
  completionSummary: string | null
}

type RunStatus = 'running' | 'paused' | 'completed' | 'aborted'
```

### Status Transitions

```
created → running → paused (interrupt) → running → completed
                      ↓                      ↓
                   aborted ←────────────── aborted
```

**Status Updates:**
- `running` - Actively executing graph
- `paused` - Waiting at interrupt (question, approval, limit)
- `completed` - completionSummary set, all done
- `aborted` - User cancelled or error occurred

---

## Event Queue

### Dual Event Sources

1. **Custom Events** (custom stream mode)
   - Emitted via `config.writer()` in agent node
   - LLM text deltas streamed real-time
   - Bypasses event queue

2. **Node Events** (updates stream mode)
   - Collected in runInfo.eventQueue
   - Emitted after node completion
   - Includes tool calls, approvals, verification, etc.

### StreamAdapter

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/events/stream-adapter.ts`

Converts LangGraph state updates to AgentEvents:

```typescript
class StreamAdapter {
  transform(update: StateUpdate): AgentEvent[] {
    const events: AgentEvent[] = []

    // Extract phase change
    if (update.phase !== this.lastPhase) {
      events.push({ type: 'phase', phase: update.phase })
      this.lastPhase = update.phase
    }

    // Extract tool calls/results from messages
    if (update.messages) {
      events.push(...extractToolEvents(update.messages))
    }

    // Extract verification events
    if (update.lastVerification) {
      events.push(...extractVerificationEvents(update.lastVerification))
    }

    // Apply StreamOptions filtering
    return events.filter(e => this.shouldInclude(e))
  }
}
```

---

## Related Documents

- [State Machine](./state-machine.md) - Graph execution flow
- [State Schema](./state-schema.md) - State fields and reducers
- [Interrupts](./interrupts.md) - Interrupt/resume patterns
- [Event Streaming](./event-streaming.md) - AgentEvent details
- [Types](../types/run.md) - RunMode, RunMeta, RunStatus types
