# State Machine

> **For AI Agents**: Read this when modifying graph topology, adding nodes, implementing conditional routing, or debugging agent flow issues.

## Overview

The @robojs/code agent uses a LangGraph state machine with 12 nodes and conditional routing. The graph coordinates planning, execution, user interaction, and verification in a deterministic flow.

**Key Files:**
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/graph.ts` - Graph builder
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/nodes/` - All node implementations
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/edges/routing.ts` - Conditional routing

---

## Complete Graph Topology

```
START
  ↓
detect_profile
  ↓
refresh_index
  ↓
refresh_overview
  ↓
planner
  │
  ├──(mode='explain' OR hasAcceptance)──→ agent
  │                                          ↓
  ├──(hasPendingQuestion)───────────→ question_gate
  │                                          ↓
  │                                    [INTERRUPT]
  │                                          ↓
  │                                    resume → planner OR agent
  │
  └──(default)──────────────────────→ agent
                                          ↓
                            (mode='explain') ──→ END
                                          ↓
                                   (hasToolCalls)
                                          ↓
                                       tools
                                          ↓
                            (awaitingApproval) ──→ approval_gate
                                          │              ↓
                                          │        [INTERRUPT]
                                          │              ↓
                                          │        resume → tools
                                          ↓
                                       agent (loop)
                                          ↓
                                    (no tool_calls)
                                          ↓
                                      reviewer
                                          ↓
                         ┌────────────────┼───────────────┐
                         ↓                ↓               ↓
                  (needsBuild)     (needsTests)    (needsMock)
                         ↓                ↓               ↓
                  verify_build     verify_tests   verify_mock
                         │                │               │
                         └────────────────┴───────────────┘
                                          ↓
                                      reviewer
                                          ↓
                         ┌────────────────┼────────────────┐
                         ↓                ↓                ↓
                  (allPassed)    (needsRefresh)    (needsWork)
                         ↓                ↓                ↓
                        END      refresh_overview      agent
```

---

## Nodes Reference

### Initialization Nodes

| Node | File | Purpose |
|------|------|---------|
| **detect_profile** | `nodes/detect-profile.ts` | Scan for Robo.js project metadata, detect kind/plugins |
| **refresh_index** | `nodes/refresh-index.ts` | Build file listing with fingerprint, track Robo signals |
| **refresh_overview** | `nodes/refresh-overview.ts` | Generate project mental model with key files |

### Planning Nodes

| Node | File | Purpose |
|------|------|---------|
| **planner** | `nodes/planner.ts` | LLM generates AcceptanceCriteria + TaskStep[], may ask clarifying questions |

### Execution Nodes

| Node | File | Purpose |
|------|------|---------|
| **agent** | `nodes/agent.ts` | Main LLM reasoning loop, calls tools or decides completion |
| **tools** | `nodes/tools.ts` | Executes tool calls serially, handles approval requests |

### Control Nodes

| Node | File | Purpose |
|------|------|---------|
| **question_gate** | `nodes/question-gate.ts` | Interrupt when clarification needed, emit question event |
| **approval_gate** | `nodes/approval-gate.ts` | Interrupt when changes need confirmation, emit approval_required |

### Validation Nodes

| Node | File | Purpose |
|------|------|---------|
| **reviewer** | `nodes/reviewer.ts` | Check completion criteria, route to verification or completion |
| **verify_build** | `nodes/verify-build.ts` | Run build command (`robo build` or `npm run build`) |
| **verify_tests** | `nodes/verify-tests.ts` | Run test command (vitest/jest/mocha) |
| **verify_mock** | `nodes/verify-mock.ts` | Run @robojs/mock scenario validation |

---

## Detailed Node Descriptions

### detect_profile

**Input State:**
- `instruction` (user request)

**Logic:**
1. Skip if `projectProfile` already exists (cached)
2. Call `detectRoboProject(provider)`
3. Scan for:
   - package.json with Robo.js dependencies
   - Robo.js directories (/src/commands, /src/events, etc.)
   - Config files (robo.config.ts, config/robo.mjs)
4. Determine project kind: bot | bot+api | activity | unknown
5. Detect available plugins and features

**Output State:**
- `projectProfile: ProjectProfile`
- `phase: 'detect_profile'`

**Next:** Always → refresh_index

---

### refresh_index

**Input State:**
- `projectProfile` (from detect_profile)

**Logic:**
1. Call `projectIndexer.needsRefresh()` to check fingerprint
2. If needed or forced, call `projectIndexer.refresh()`
3. Build file listing (up to 10,000 files, 5,000 dirs)
4. Compute fingerprint (content hash for small files, size+mtime for large)
5. Extract Robo signals (commands, events, API routes)

**Output State:**
- `projectIndex: ProjectIndex`
- `phase: 'refresh_index'`

**Next:** Always → refresh_overview

---

### refresh_overview

**Input State:**
- `projectProfile`, `projectIndex`

**Logic:**
1. Call `projectOverviewBuilder.needsRefresh(projectIndex)` (fingerprint check)
2. If needed, call `projectOverviewBuilder.build()`
3. Parse package.json (name, version, scripts, dependencies)
4. Detect key files (robo.config, README, tsconfig, etc.)
5. Build Robo overview (commands list, events list, plugins)
6. Include agent memory (decisions, changeLog from previous runs)

**Output State:**
- `projectOverview: ProjectOverview`
- `phase: 'refresh_overview'`

**Next:** Always → planner

---

### planner

**Input State:**
- `instruction`, `projectProfile`, `projectOverview`, `lastAnswer`

**Logic:**
1. Skip if `acceptance` already exists (plan mode returned early)
2. Build context for LLM:
   - User instruction
   - Project profile + overview
   - Last answer (if question was asked)
3. Call LLM with PLANNER_SYSTEM_PROMPT
4. Parse JSON response:
   - `AcceptanceCriteria` (requirements, scenarios, mustPass)
   - `TaskStep[]` (plan with titles, descriptions, files)
   - `needsClarification` flag
   - `clarifyingQuestion` if needed
5. If needs clarification && no lastAnswer:
   - Set `pendingQuestion`
   - Route to question_gate
6. Otherwise:
   - Set `acceptance`, `plan`, `acceptanceStatus`
   - Route to agent

**Output State:**
- `acceptance: AcceptanceCriteria`
- `plan: TaskStep[]`
- `acceptanceStatus: AcceptanceStatus`
- `pendingQuestion: PendingQuestion` (if needed)
- `phase: 'planner'`
- `messages: [AIMessage]` (planner response)

**Next:**
- If mode='explain' → agent
- If mode='plan' && hasAcceptance → END
- If pendingQuestion → question_gate
- Otherwise → agent

---

### agent

**Input State:**
- All state (full context available)

**Logic:**
1. Count current context tokens (messages + system + tools)
2. Check if compaction needed (>70% of model limit)
3. If needed, compact messages (preserve last N, add summary)
4. Build system prompt:
   - Original instruction
   - Mode-specific instructions
   - Project overview
   - Acceptance criteria (execute mode)
   - Current plan step
   - Last verification status
   - Compacted summary (if applicable)
5. Call LLM with streaming:
   - Stream text deltas via `config.writer()` (real-time emission)
   - Accumulate tool_calls from chunks
   - Track token usage
6. Add AIMessage to messages
7. Update token usage statistics

**Output State:**
- `messages: [AIMessage]` (with content and/or tool_calls)
- `tokenUsage: TokenUsage` (cumulative)
- `currentContextTokens: number`
- `summary: string` (if compacted)
- `phase: 'agent'`

**Next:**
- If mode='explain' → END
- If hasToolCalls → tools
- Otherwise → reviewer

---

### tools

**Input State:**
- `messages` (last message has tool_calls)

**Logic:**
1. Extract tool_calls from last AIMessage
2. For each tool call:
   - Create PendingToolCall
   - Call `toolExecutor.execute(toolCall)`
   - Check result.requiresApproval:
     - If true:
       - Add placeholder ToolMessage (Anthropic API requirement)
       - Set `pendingChanges`, `pendingDiffs`, `awaitingApproval: true`
       - Break (stop processing remaining tools)
     - If false:
       - Add ToolMessage with result
       - Track appliedChanges/appliedDiffs
       - Emit file_applied event for writes/deletes
3. Return tool messages and applied changes

**Output State:**
- `messages: [ToolMessage, ...]` (appended)
- `appliedChanges: FileChange[]` (appended if applied)
- `appliedDiffs: FileDiff[]` (appended if applied)
- `pendingChanges: FileChange[]` (if approval needed)
- `pendingDiffs: FileDiff[]` (if approval needed)
- `awaitingApproval: boolean`
- `approvalReason: string`
- `phase: 'tools'`

**Next:**
- If awaitingApproval → approval_gate
- Otherwise → agent

---

### reviewer

**Input State:**
- `acceptance`, `acceptanceStatus`, `lastVerification`, `appliedChanges`, `iterations`

**Logic:**
1. Increment iteration counter
2. Check budget: iterations >= maxIterations
3. **Execute mode fix**: If mode='execute' && no changes applied → continue (send back to agent)
4. Evaluate each mustPass scenario:
   - Check if already passed (acceptanceStatus)
   - Map scenario kind to verification need:
     - `build` → check lastVerification.build.success
     - `test` → check lastVerification.tests.success
     - `mock` → check lastVerification.mock.success
     - `manual` → needs user confirmation (future)
5. Decide next action:
   - All passed → set completionSummary, route to END
   - Needs build → route to verify_build
   - Needs tests → route to verify_tests
   - Needs mock → route to verify_mock
   - Applied changes recently → route to refresh_overview
   - Verification failed → route back to agent (retry)
6. Update acceptanceStatus with scenario results

**Output State:**
- `iterations: number` (incremented)
- `budgetExceeded: boolean`
- `acceptanceStatus: AcceptanceStatus` (updated scenario statuses)
- `completionSummary: string` (if done)
- `phase: 'reviewer'`

**Next:**
- If budgetExceeded → END
- If completionSummary → END
- If needsBuildVerification → verify_build
- If needsTestVerification → verify_tests
- If needsMockVerification → verify_mock
- If appliedChanges && shouldRefresh → refresh_overview
- Otherwise → agent

---

### verify_build / verify_tests / verify_mock

**Common Pattern:**
1. Determine command to run
2. Execute via provider (timeout: 120s-180s)
3. Parse output for errors/failures
4. Build VerificationResult
5. Update acceptanceStatus for related scenarios

**Output State:**
- `lastVerification.build/tests/mock: VerificationResult`
- `acceptanceStatus: AcceptanceStatus` (scenario statuses updated)
- `phase: 'verify_build' | 'verify_tests' | 'verify_mock'`

**Next:** Always → reviewer

---

## Conditional Routing Details

### routeAfterPlanner

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/edges/routing.ts:routeAfterPlanner`

```typescript
function routeAfterPlanner(state: AgentState): NodeName | typeof END {
  // Check for abort first
  if (state.aborted) {
    return END
  }

  // Explain mode skips planning
  if (state.mode === 'explain') {
    return 'agent'
  }

  // Plan mode completes after planner generates acceptance
  if (state.mode === 'plan' && state.acceptance && !state.pendingQuestion) {
    return END
  }

  // If planner asked a question, go to question gate
  if (state.pendingQuestion) {
    return 'question_gate'
  }

  // Default: proceed to execution
  return 'agent'
}
```

### routeAfterAgent

```typescript
function routeAfterAgent(state: AgentState): NodeName | typeof END {
  // Check for abort first
  if (state.aborted) {
    return END
  }

  // Explain mode completes after agent responds
  if (state.mode === 'explain') {
    return END
  }

  const lastMessage = state.messages[state.messages.length - 1]

  // If LLM made tool calls, execute them
  if (hasToolCalls(lastMessage)) {
    return 'tools'
  }

  // Otherwise, check if work is complete
  return 'reviewer'
}
```

### routeAfterTools

```typescript
function routeAfterTools(state: AgentState): NodeName | typeof END {
  // Check for abort first
  if (state.aborted) {
    return END
  }

  // If waiting for approval, pause at approval gate
  if (state.awaitingApproval) {
    return 'approval_gate'
  }

  // Otherwise, continue reasoning
  return 'agent'
}
```

### routeAfterQuestionGate

Routes after question is answered:

```typescript
function routeAfterQuestionGate(state: AgentState): NodeName | typeof END {
  // Check for abort first
  if (state.aborted) {
    return END
  }

  // If we don't have acceptance criteria yet, go back to planner
  // This is the case when planner asked a clarifying question
  if (!state.acceptance) {
    return 'planner'
  }

  // We have acceptance, so agent asked the question - go to agent
  return 'agent'
}
```

### routeAfterApprovalGate

Routes after approval is processed:

```typescript
function routeAfterApprovalGate(state: AgentState): NodeName | typeof END {
  // Check for abort first
  if (state.aborted) {
    return END
  }

  // Continue to agent after approval is processed
  return 'agent'
}
```

### routeAfterReviewer

```typescript
function routeAfterReviewer(state: AgentState): NodeName | typeof END {
  // Check for abort first
  if (state.aborted) {
    return END
  }

  // Budget exhausted - complete with status report
  if (state.budgetExceeded) {
    return END
  }

  // Work completed - all scenarios passed
  if (state.completionSummary) {
    return END
  }

  // Need build verification?
  if (needsBuildVerification(state)) {
    return 'verify_build'
  }

  // Need test verification?
  if (needsTestVerification(state)) {
    return 'verify_tests'
  }

  // Need mock verification?
  if (needsMockVerification(state)) {
    return 'verify_mock'
  }

  // Refresh overview after changes (every 5 changes)
  if (state.appliedChanges.length > 0 && shouldRefreshOverview(state)) {
    return 'refresh_overview'
  }

  // Still have work to do, go back to agent
  return 'agent'
}

// Helper functions for verification routing
function needsBuildVerification(state: AgentState): boolean {
  if (state.lastVerification?.build?.success) return false
  if (!state.acceptance) return true
  return state.acceptance.mustPass.some(id => {
    const scenario = state.acceptance?.scenarios.find(s => s.id === id)
    return scenario?.kind === 'build'
  })
}

function needsTestVerification(state: AgentState): boolean {
  if (state.lastVerification?.tests?.success) return false
  if (!state.acceptance) return false
  return state.acceptance.mustPass.some(id => {
    const scenario = state.acceptance?.scenarios.find(s => s.id === id)
    return scenario?.kind === 'test'
  })
}

function needsMockVerification(state: AgentState): boolean {
  if (!state.projectProfile?.hasMock) return false
  if (state.lastVerification?.mock?.success) return false
  if (!state.acceptance) return false
  return state.acceptance.mustPass.some(id => {
    const scenario = state.acceptance?.scenarios.find(s => s.id === id)
    return scenario?.kind === 'mock'
  })
}

function shouldRefreshOverview(state: AgentState): boolean {
  const changeCount = state.appliedChanges.length
  return changeCount > 0 && changeCount % 5 === 0
}
```

---

## Graph Construction

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/graph.ts:buildGraph`

```typescript
function buildGraph(context: CodeAgentContext): CompiledStateGraph {
  const builder = new StateGraph(AgentStateAnnotation)

  // Add all nodes
  builder.addNode('detect_profile', detectProfileNode)
  builder.addNode('refresh_index', refreshIndexNode)
  builder.addNode('refresh_overview', refreshOverviewNode)
  builder.addNode('planner', plannerNode)
  builder.addNode('question_gate', questionGateNode)
  builder.addNode('agent', agentNode)
  builder.addNode('tools', toolsNode)
  builder.addNode('approval_gate', approvalGateNode)
  builder.addNode('reviewer', reviewerNode)
  builder.addNode('verify_build', verifyBuildNode)
  builder.addNode('verify_tests', verifyTestsNode)
  builder.addNode('verify_mock', verifyMockNode)

  // Entry point
  builder.addEdge(START, 'detect_profile')

  // Linear initialization
  builder.addEdge('detect_profile', 'refresh_index')
  builder.addEdge('refresh_index', 'refresh_overview')
  builder.addEdge('refresh_overview', 'planner')

  // Conditional routing
  builder.addConditionalEdges('planner', routeAfterPlanner)
  builder.addConditionalEdges('question_gate', routeAfterQuestionGate)
  builder.addConditionalEdges('agent', routeAfterAgent)
  builder.addConditionalEdges('tools', routeAfterTools)
  builder.addConditionalEdges('reviewer', routeAfterReviewer)

  // Verification loops back to reviewer
  builder.addEdge('verify_build', 'reviewer')
  builder.addEdge('verify_tests', 'reviewer')
  builder.addEdge('verify_mock', 'reviewer')

  // Approval gate continues to agent after approval
  builder.addEdge('approval_gate', 'agent')

  // Compile with checkpointer
  return builder.compile({
    checkpointer: context.checkpointer,
    interruptBefore: ['question_gate', 'approval_gate']
  })
}
```

---

## Mode-Specific Behaviors

### Explain Mode

```
START → detect_profile → refresh_index → refresh_overview
      → planner → agent (tools='none') → END
```

**Characteristics:**
- Skips plan generation (goes straight to agent)
- Agent uses read-only tools only
- No verification
- Single-pass: agent → END

### Plan Mode

```
START → detect_profile → refresh_index → refresh_overview
      → planner → question_gate? → END
```

**Characteristics:**
- Planner generates acceptance criteria + plan
- May ask clarifying questions
- Completes after plan generation
- No execution or verification

### Execute Mode

```
START → detect_profile → refresh_index → refresh_overview
      → planner → question_gate? → agent ⟷ tools
      → approval_gate? → reviewer → verify_* → END
```

**Characteristics:**
- Full workflow with all nodes
- Iterates until acceptance satisfied or budget exceeded
- Runs verification loops
- Multiple passes through agent/tools/reviewer

---

## Critical Implementation Details

### Interrupt Configuration

```typescript
interruptBefore: ['question_gate', 'approval_gate']
```

**Effect:**
- Graph pauses BEFORE executing these nodes
- State saved to checkpoint
- User calls resume()
- Graph continues from checkpoint (runs the gate node)

### Resume After Interrupt

**CRITICAL:** Must use `graph.updateState()` + `null` input

```typescript
// ❌ WRONG - Restarts from START
await graph.stream({}, { thread_id: runId })

// ❌ WRONG - Also restarts from START
await graph.stream({ mode: 'execute' }, { thread_id: runId })

// ✅ CORRECT - Resumes from checkpoint
await graph.updateState(
  { configurable: { thread_id: runId } },
  { lastAnswer: { text: 'TypeScript' } }
)
await graph.stream(null, { configurable: { thread_id: runId } })
```

### Recursion Limit as Pause

LangGraph throws `GraphRecursionError` at 100 iterations:

```typescript
// In CodeAgent.stream()
try {
  for await (const event of graph.stream(...)) {
    yield event
  }
} catch (error) {
  if (error.name === 'GraphRecursionError') {
    // Pause gracefully (not abort)
    await graph.updateState(config, { limitReached: true })
    yield {
      type: 'limit_reached',
      message: buildLimitMessage(state),
      iteration: state.iterations,
      limit: RECURSION_LIMIT
    }
    // User can resume with continueAfterLimit: true
  } else {
    throw error
  }
}
```

---

## Node Context Access

Nodes receive `RunnableConfig` with context:

```typescript
async function someNode(
  state: typeof AgentStateAnnotation.State,
  config: RunnableConfig
): Promise<Partial<typeof AgentStateAnnotation.State>> {
  const context = config.configurable as CodeAgentContext

  // Access:
  context.provider          // ExecutionProvider
  context.policy            // AgentPolicy
  context.llm               // LLMProvider
  context.toolExecutor      // ToolExecutor
  context.projectIndexer    // ProjectIndexer
  context.onEvent           // Event emitter
  context.runId             // Current run ID
  context.signal            // AbortSignal

  // Use context
  const file = await context.provider.readFile('/package.json')
}
```

---

## Related Documents

- [State Schema](./state-schema.md) - All state fields and reducers
- [Interrupts](./interrupts.md) - Question and approval gate details
- [Run Lifecycle](./run-lifecycle.md) - How start/stream/resume work
- [Verification System](../verification/README.md) - Verify node implementations
- [Tool System](../tools/README.md) - What tools node executes
