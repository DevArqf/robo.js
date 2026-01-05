# Orchestration Layer

> **For AI Agents**: Read this when working on the LangGraph state machine, understanding agent workflows, or implementing new nodes/edges. This layer coordinates all agent behavior.

## Overview

The orchestration layer implements a LangGraph-based state machine that coordinates the entire agent lifecycle: planning, execution, verification, and user interaction through interrupts.

**Key Files:**
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/graph.ts` - Graph builder
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/state.ts` - State schema
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/nodes/` - Node implementations

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                   LANGGRAPH STATE MACHINE                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  START                                                            │
│    ↓                                                              │
│  detect_profile (scan for Robo.js project)                       │
│    ↓                                                              │
│  refresh_index (build file listing + fingerprint)                │
│    ↓                                                              │
│  refresh_overview (create mental model)                          │
│    ↓                                                              │
│  planner (generate acceptance criteria + plan)                   │
│    │                                                              │
│    ├──→ question_gate? (interrupt if needs clarification)        │
│    │         ↓                                                    │
│    │    [PAUSE - wait for user answer]                           │
│    │         ↓                                                    │
│    │    resume → planner (with answer)                           │
│    │                                                              │
│    └──→ agent (main LLM reasoning loop)                          │
│              ↓                                                    │
│         tool_calls? ──→ tools (execute serially)                 │
│              ↑              ↓                                     │
│              └──────────────┴─ (iteration loop)                  │
│                              ↓                                    │
│                         approval_gate? (if changes need approval)│
│                              ↓                                    │
│                         [PAUSE - wait for approval]              │
│                              ↓                                    │
│                         resume → apply changes                   │
│                              ↓                                    │
│                         reviewer (check completion)              │
│                              ↓                                    │
│         ┌────────────────────┼─────────────────┐                 │
│         ↓                    ↓                 ↓                 │
│  verify_build         verify_tests      verify_mock             │
│         │                    │                 │                 │
│         └────────────────────┴─────────────────┘                 │
│                              ↓                                    │
│                         reviewer (check results)                 │
│                              ↓                                    │
│                   ┌──────────┼──────────┐                        │
│                   ↓          ↓          ↓                        │
│              COMPLETE    CONTINUE    ITERATE                     │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. State Machine
Graph topology with all nodes and conditional routing.

**Read:** [state-machine.md](./state-machine.md)

### 2. State Schema
AgentState fields, reducers, and memory management.

**Read:** [state-schema.md](./state-schema.md)

### 3. Interrupts
Approval, question, and limit interrupt/resume patterns.

**Read:** [interrupts.md](./interrupts.md)

### 4. Run Lifecycle
Public API methods: start, stream, resume, abort.

**Read:** [run-lifecycle.md](./run-lifecycle.md)

### 5. Event Streaming
AgentEvent protocol and real-time delivery.

**Read:** [event-streaming.md](./event-streaming.md)

### 6. Context Compaction
Token-aware message trimming to stay within model limits.

**Read:** [context-compaction.md](./context-compaction.md)

### 7. System Prompts
Planner and agent prompt structures and customization.

**Read:** [prompts.md](./prompts.md)

---

## Key Concepts

### Run Modes

| Mode | Behavior | Tools Allowed | Verification |
|------|----------|---------------|--------------|
| **explain** | Answer questions only | Read-only | No |
| **plan** | Generate plan + acceptance criteria | None | No |
| **execute** | Full implementation | All tools | Yes |

### Node Types

| Type | Examples | Purpose |
|------|----------|---------|
| **Initialization** | detect_profile, refresh_index | Setup |
| **Planning** | planner | Generate acceptance criteria |
| **Execution** | agent, tools | Implement changes |
| **Control** | question_gate, approval_gate | User interaction |
| **Validation** | reviewer, verify_* | Quality assurance |

### Interrupts

Three types of pauses requiring user input:

1. **Question**: Agent needs clarification
2. **Approval**: File changes need confirmation
3. **Limit**: Iteration budget exceeded

---

## Data Flows

### Fresh Execute Run

```
1. start({ input: 'Add ping command', mode: 'execute' })
   → runId created
2. stream(runId)
   → detect_profile: ProjectProfile
   → refresh_index: ProjectIndex with fingerprint
   → refresh_overview: ProjectOverview with context
   → planner: AcceptanceCriteria + TaskStep[]
   → agent: LLM generates tool_calls
   → tools: Execute fs_write, fs_read, etc.
   → approval_gate: PAUSE (if autoApprove: false)
3. resume({ approval: { approved: true } })
4. stream(runId)
   → tools: Apply changes
   → reviewer: Check completion
   → verify_build: Run 'robo build'
   → reviewer: All scenarios passed
   → COMPLETE
```

### Resume After Question

```
1. planner sets pendingQuestion
2. question_gate emits 'question' event
3. Graph pauses (interrupt)
4. resume({ answer: { text: 'Use TypeScript' } })
5. stream(runId) with NULL input (critical!)
6. question_gate sees lastAnswer
7. Routes back to planner
8. planner generates acceptance with answer
9. Continues to agent
```

---

## Run Identity

### runId = threadId (1:1 Mapping)

```typescript
// In CodeAgent.start()
const runId = `run-${Date.now()}-${uuidv4()}`
const threadId = runId  // Same value!

// LangGraph uses threadId for checkpointing
const config = { configurable: { thread_id: threadId } }
```

**Why This Matters:**
- Checkpoints tied to runId
- Resume works via runId lookup
- Multi-run isolation guaranteed
- Debugging easier with consistent IDs

---

## Checkpointing

### MemorySaver (Default)

```typescript
import { MemorySaver } from '@langchain/langgraph'

const checkpointer = new MemorySaver()

const graph = builder.compile({ checkpointer })
```

**Characteristics:**
- In-memory storage
- Supports interrupts and resume
- Lost on page reload
- Fast, no I/O overhead

### Future: Durable Checkpointing

For production "come back later" UX:
```typescript
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres'

const checkpointer = await PostgresSaver.fromConnString(dbUrl)
```

**Enables:**
- Resume after page reload
- Cross-device continuity
- Audit trail persistence
- Recovery from crashes

---

## Edge Routing

Conditional edges determine next node:

```typescript
// After planner
if (mode === 'explain') → agent
if (mode === 'plan' && hasAcceptance) → END
if (hasPendingQuestion) → question_gate
else → agent

// After agent
if (mode === 'explain') → END
if (hasToolCalls) → tools
else → reviewer

// After tools
if (awaitingApproval) → approval_gate
else → agent

// After reviewer
if (budgetExceeded) → END
if (needsBuildVerification) → verify_build
if (needsTestVerification) → verify_tests
if (needsMockVerification) → verify_mock
if (shouldRefreshOverview) → refresh_overview
else → agent
```

---

## Node Implementation Pattern

Every node follows this structure:

```typescript
async function nodeFunction(
  state: typeof AgentStateAnnotation.State,
  config: RunnableConfig
): Promise<Partial<typeof AgentStateAnnotation.State>> {
  // 1. Read from state
  const { instruction, mode, messages } = state

  // 2. Perform node logic
  const result = await doWork()

  // 3. Return state updates (partial)
  return {
    phase: 'node_name',
    someField: newValue,
    messages: [new AIMessage('...')],  // Appended via reducer
    otherField: updatedValue           // Replaced via reducer
  }
}
```

**Reducer Behavior:**
- `replaceReducer`: Last write wins (most fields)
- `appendReducer`: Accumulates (messages, appliedChanges, appliedDiffs)

---

## Usage Examples

### Creating a Custom Node

```typescript
// 1. Define node function
async function customNode(
  state: typeof AgentStateAnnotation.State
): Promise<Partial<typeof AgentStateAnnotation.State>> {
  codeLogger.info('Custom node executing')

  return {
    phase: 'custom',
    customField: 'value'
  }
}

// 2. Add to graph
builder.addNode('custom', customNode)

// 3. Add edges
builder.addEdge('planner', 'custom')
builder.addConditionalEdges('custom', routeFromCustom)
```

### Adding Conditional Routing

```typescript
function routeFromCustom(
  state: typeof AgentStateAnnotation.State
): string {
  if (state.customCondition) {
    return 'agent'
  } else {
    return 'reviewer'
  }
}
```

---

## Related Documents

- [State Schema](./state-schema.md) - All state fields and reducers
- [State Machine](./state-machine.md) - Graph topology details
- [Interrupts](./interrupts.md) - Pause/resume patterns
- [Run Lifecycle](./run-lifecycle.md) - Public API integration
- [Event Streaming](./event-streaming.md) - How events flow from nodes
