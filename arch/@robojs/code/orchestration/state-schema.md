# State Schema

> **For AI Agents**: Read this when adding state fields, understanding reducers, or debugging state updates in the LangGraph orchestration.

## Overview

The agent state uses LangGraph's `Annotation.Root` with custom reducers to manage all agent memory, context, and execution status. Understanding the state schema is critical for modifying agent behavior.

**Key File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/state.ts`

---

## AgentStateAnnotation

### Complete Schema

```typescript
import { Annotation } from '@langchain/langgraph'
import { BaseMessage } from '@langchain/core/messages'

const AgentStateAnnotation = Annotation.Root({
  // ═══════════════════════════════════════════════════════════════
  // CORE FIELDS
  // ═══════════════════════════════════════════════════════════════

  mode: Annotation<RunMode>({
    reducer: replaceReducer,
    default: () => 'execute'
  }),

  phase: Annotation<string>({
    reducer: replaceReducer,
    default: () => 'init'
  }),

  instruction: Annotation<string>({
    reducer: replaceReducer,
    default: () => ''
  }),

  messages: Annotation<BaseMessage[]>({
    reducer: appendReducer,  // ← APPEND (accumulate)
    default: () => []
  }),

  // ═══════════════════════════════════════════════════════════════
  // PLANNING & ACCEPTANCE
  // ═══════════════════════════════════════════════════════════════

  plan: Annotation<TaskStep[]>({
    reducer: replaceReducer,
    default: () => []
  }),

  currentStep: Annotation<number>({
    reducer: replaceReducer,
    default: () => 0
  }),

  acceptance: Annotation<AcceptanceCriteria | null>({
    reducer: replaceReducer,
    default: () => null
  }),

  acceptanceStatus: Annotation<AcceptanceStatus | null>({
    reducer: replaceReducer,
    default: () => null
  }),

  // ═══════════════════════════════════════════════════════════════
  // QUESTION GATE (INTERRUPT)
  // ═══════════════════════════════════════════════════════════════

  pendingQuestion: Annotation<PendingQuestion | null>({
    reducer: replaceReducer,
    default: () => null
  }),

  lastAnswer: Annotation<QuestionAnswer | null>({
    reducer: replaceReducer,
    default: () => null
  }),

  // ═══════════════════════════════════════════════════════════════
  // PROJECT UNDERSTANDING
  // ═══════════════════════════════════════════════════════════════

  projectProfile: Annotation<ProjectProfile | null>({
    reducer: replaceReducer,
    default: () => null
  }),

  projectIndex: Annotation<ProjectIndex | null>({
    reducer: replaceReducer,
    default: () => null
  }),

  projectOverview: Annotation<ProjectOverview | null>({
    reducer: replaceReducer,
    default: () => null
  }),

  // ═══════════════════════════════════════════════════════════════
  // CHANGES & DIFFS
  // ═══════════════════════════════════════════════════════════════

  pendingChanges: Annotation<FileChange[]>({
    reducer: replaceReducer,
    default: () => []
  }),

  pendingDiffs: Annotation<FileDiff[]>({
    reducer: replaceReducer,
    default: () => []
  }),

  appliedChanges: Annotation<FileChange[]>({
    reducer: appendReducer,  // ← APPEND (cumulative history)
    default: () => []
  }),

  appliedDiffs: Annotation<FileDiff[]>({
    reducer: appendReducer,  // ← APPEND (cumulative history)
    default: () => []
  }),

  // ═══════════════════════════════════════════════════════════════
  // VERIFICATION
  // ═══════════════════════════════════════════════════════════════

  lastVerification: Annotation<VerificationResults | null>({
    reducer: replaceReducer,
    default: () => null
  }),

  // Note: reviewDecision is NOT a state field - it's a return value from evaluateCompletion()
  // Routing logic uses helper functions, not a stored decision

  // ═══════════════════════════════════════════════════════════════
  // APPROVAL STATE (INTERRUPT)
  // ═══════════════════════════════════════════════════════════════

  awaitingApproval: Annotation<boolean>({
    reducer: replaceReducer,
    default: () => false
  }),

  approved: Annotation<ApprovalResponse | null>({
    reducer: replaceReducer,
    default: () => null
  }),

  approvalReason: Annotation<string | null>({
    reducer: replaceReducer,
    default: () => null
  }),

  pendingCommand: Annotation<{ executable: string; args: string[]; cwd?: string } | null>({
    reducer: replaceReducer,
    default: () => null
  }),

  // ═══════════════════════════════════════════════════════════════
  // TOKEN BUDGET
  // ═══════════════════════════════════════════════════════════════

  tokenUsage: Annotation<TokenUsage>({
    reducer: replaceReducer,
    default: () => ({
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      peakContextTokens: 0
    })
  }),

  currentContextTokens: Annotation<number>({
    reducer: replaceReducer,
    default: () => 0
  }),

  budgetExceeded: Annotation<boolean>({
    reducer: replaceReducer,
    default: () => false
  }),

  // ═══════════════════════════════════════════════════════════════
  // ITERATION TRACKING
  // ═══════════════════════════════════════════════════════════════

  iterations: Annotation<number>({
    reducer: replaceReducer,
    default: () => 0
  }),

  limitReached: Annotation<boolean>({
    reducer: replaceReducer,
    default: () => false
  }),

  limitContinue: Annotation<boolean>({
    reducer: replaceReducer,
    default: () => false
  }),

  // ═══════════════════════════════════════════════════════════════
  // CONTEXT COMPACTION
  // ═══════════════════════════════════════════════════════════════

  summary: Annotation<string | null>({
    reducer: replaceReducer,
    default: () => null
  }),

  // ═══════════════════════════════════════════════════════════════
  // TERMINATION
  // ═══════════════════════════════════════════════════════════════

  aborted: Annotation<boolean>({
    reducer: replaceReducer,
    default: () => false
  }),

  abortReason: Annotation<string | null>({
    reducer: replaceReducer,
    default: () => null
  }),

  completionSummary: Annotation<string | null>({
    reducer: replaceReducer,
    default: () => null
  }),

  // ═══════════════════════════════════════════════════════════════
  // INTERNAL FLAGS
  // ═══════════════════════════════════════════════════════════════

  overviewRefreshedAfterChanges: Annotation<boolean>({
    reducer: replaceReducer,
    default: () => false
  })
})
```

---

## Reducer Types

### replaceReducer (Default)

Last write wins - new value replaces old:

```typescript
function replaceReducer<T>(current: T | undefined, update: T | undefined): T {
  return update !== undefined ? update : current
}
```

**Used for:** Most fields (mode, phase, acceptance, etc.)

**Example:**
```typescript
// Initial state
{ phase: 'idle' }

// Node returns update
{ phase: 'planner' }

// Final state
{ phase: 'planner' }  // Replaced
```

### appendReducer

Accumulates values into array:

```typescript
function appendReducer<T>(current: T[], update: T[] | undefined): T[] {
  if (!update || update.length === 0) return current
  return [...current, ...update]
}
```

**Used for:** messages, appliedChanges, appliedDiffs

**Example:**
```typescript
// Initial state
{ messages: [HumanMessage('Hello')] }

// Node returns update
{ messages: [AIMessage('Hi there')] }

// Final state
{ messages: [HumanMessage('Hello'), AIMessage('Hi there')] }  // Appended
```

**CRITICAL:** Never return partial arrays for append fields - always return new items to add:

```typescript
// ❌ WRONG - Replaces entire array
return { messages: allMessages }

// ✅ CORRECT - Appends new messages
return { messages: newMessages }
```

---

## Field Groups

### Ephemeral Fields (Reset Per Run)

Cleared on new run, not persisted:
- `pendingQuestion`, `lastAnswer`
- `awaitingApproval`, `approved`, `approvalReason`
- `limitReached`, `limitContinue`
- `overviewRefreshedAfterChanges`

### Cumulative Fields (Append-Only)

Never cleared, grow over run lifetime:
- `messages` - Full conversation history
- `appliedChanges` - All file operations performed
- `appliedDiffs` - All diffs generated

### Persistent Fields (Updated Throughout)

Updated as run progresses:
- `projectProfile`, `projectIndex`, `projectOverview`
- `acceptance`, `acceptanceStatus`
- `plan`, `currentStep`
- `lastVerification`, `reviewDecision`
- `tokenUsage`, `currentContextTokens`

---

## State Initialization

### Fresh Run

```typescript
const initialState: Partial<typeof AgentStateAnnotation.State> = {
  mode: request.mode ?? 'execute',
  instruction: request.input,
  messages: [new HumanMessage(request.input)]
}
```

### Continue From Previous Run

```typescript
// Inherit state from planRunId
const planState = await graph.getState({ configurable: { thread_id: planRunId } })

const initialState: Partial<typeof AgentStateAnnotation.State> = {
  mode: 'execute',
  instruction: request.input,
  messages: [...planState.values.messages, new HumanMessage(request.input)],
  acceptance: planState.values.acceptance,
  plan: planState.values.plan,
  projectProfile: planState.values.projectProfile,
  projectIndex: planState.values.projectIndex,
  projectOverview: planState.values.projectOverview
}
```

---

## State Updates

### From Nodes

Nodes return partial state updates:

```typescript
async function plannerNode(state: AgentState): Promise<Partial<AgentState>> {
  const acceptance = await generateAcceptance(state.instruction)

  return {
    phase: 'planner',
    acceptance,
    plan: acceptance.plan,
    messages: [new AIMessage(JSON.stringify(acceptance))]
  }
}
```

### From External (Resume)

CodeAgent updates state before resuming:

```typescript
// Resume after question
await graph.updateState(
  { configurable: { thread_id: runId } },
  {
    lastAnswer: request.answer,
    pendingQuestion: null
  }
)
```

---

## State Access Patterns

### Reading State

```typescript
// Get current state
const currentState = await agent.getState(runId)

// Access specific fields
const profile = currentState.projectProfile
const changes = currentState.appliedChanges
const status = currentState.acceptanceStatus
```

### Modifying State

Only via node returns or `graph.updateState()`:

```typescript
// ❌ WRONG - Cannot mutate state directly
state.phase = 'agent'
state.messages.push(newMessage)

// ✅ CORRECT - Return updates
return {
  phase: 'agent',
  messages: [newMessage]  // Appended via reducer
}
```

---

## Memory Management

### What Gets Compacted

When context limit reached, `summary` is created and old `messages` are trimmed:

```typescript
// Before compaction
{
  messages: [HumanMessage, AIMessage, ToolMessage, ...],  // 100 messages
  acceptance: { ... },
  plan: [ ... ],
  projectOverview: { ... }
}

// After compaction
{
  messages: [SystemMessage(summary), ...last 10 messages],  // Trimmed
  acceptance: { ... },      // ← Preserved
  plan: [ ... ],            // ← Preserved
  projectOverview: { ... }  // ← Preserved
}
```

### What's Preserved

**Never compacted:**
- `acceptance` - Required for completion check
- `plan` - Required for progress tracking
- `projectProfile` / `projectIndex` / `projectOverview` - Required for context
- `acceptanceStatus` - Required for verification
- `lastVerification` - Required for retry decisions
- `appliedChanges` / `appliedDiffs` - Required for audit

**Why:** These are structured fields, not conversational history. Losing them breaks agent functionality.

---

## TypeScript Types

### Helper Type

Access state type for type-safe code:

```typescript
type AgentState = typeof AgentStateAnnotation.State

// Usage in functions
function myFunction(state: AgentState): Partial<AgentState> {
  // Type-safe access
  const mode: RunMode = state.mode
  const messages: BaseMessage[] = state.messages

  return {
    phase: 'custom'
  }
}
```

---

## Related Documents

- [State Machine](./state-machine.md) - How nodes use state
- [Interrupts](./interrupts.md) - State updates during resume
- [Run Lifecycle](./run-lifecycle.md) - Initial state creation
- [Event Streaming](./event-streaming.md) - State changes → events
- [Types](../types/run.md) - RunMode, TaskStep, etc.
