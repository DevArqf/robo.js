# Interrupts

> **For AI Agents**: Read this when implementing interrupt handlers, debugging resume issues, or understanding pause/resume workflows.

## Overview

The agent supports three interrupt types that pause execution and wait for user input: question (clarification), approval (file changes), and limit (budget exhausted). Understanding interrupt/resume patterns is critical for correct agent behavior.

**Key Files:**
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/nodes/question-gate.ts` - Question interrupt
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/nodes/approval-gate.ts` - Approval interrupt
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/CodeAgent.ts:stream` - Limit interrupt

---

## Interrupt Types

### 1. Question Interrupt

**Trigger:** Planner needs clarification to generate acceptance criteria

**State Fields:**
```typescript
{
  pendingQuestion: {
    text: string,
    choices?: Array<{
      id: string,
      label: string,
      description?: string
    }>
  },
  lastAnswer: null  // Set on resume
}
```

**Event:**
```typescript
{
  type: 'question',
  runId: string,
  text: string,
  choices?: QuestionChoice[]
}
```

**Resume:**
```typescript
await agent.resume({
  runId,
  answer: {
    text: 'TypeScript',
    choiceId: 'ts'  // If choices provided
  }
})
```

---

### 2. Approval Interrupt

**Trigger:** apply_changes tool called with `autoApprove: false`

**State Fields:**
```typescript
{
  awaitingApproval: true,
  pendingChanges: FileChange[],
  pendingDiffs: FileDiff[],
  approvalReason: string,
  pendingCommand: { executable: string; args: string[]; cwd?: string } | null,  // For command approval
  approved: null  // Set on resume
}
```

**Event:**
```typescript
{
  type: 'approval_required',
  runId: string,
  changes: FileChange[],
  diffs: FileDiff[],
  reason: string
}
```

**Resume:**
```typescript
await agent.resume({
  runId,
  approval: {
    approved: true  // or false to reject
  }
})
```

---

### 3. Limit Interrupt

**Trigger:** LangGraph recursion limit (100 iterations)

**State Fields:**
```typescript
{
  limitReached: true,
  iterations: number,
  limitContinue: false  // Set on resume
}
```

**Event:**
```typescript
{
  type: 'limit_reached',
  message: string,  // Context-aware (includes phase, step progress)
  iteration: number,
  limit: number,
  phase: string,
  stepProgress?: { current: number, total: number, label: string }
}
```

**Resume:**
```typescript
await agent.resume({
  runId,
  continueAfterLimit: true
})
```

---

## Question Interrupt Flow

### Complete Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    QUESTION INTERRUPT FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. PLANNER NODE                                                │
│     ├─ Calls LLM with instruction + context                     │
│     ├─ LLM response: { needsClarification: true, question: ... }│
│     └─ Sets: pendingQuestion = { text, choices }                │
│                         ↓                                        │
│  2. ROUTE TO QUESTION_GATE                                      │
│     └─ Conditional edge: hasPendingQuestion → 'question_gate'   │
│                         ↓                                        │
│  3. QUESTION_GATE NODE (interruptBefore)                        │
│     ├─ Graph pauses BEFORE executing this node                  │
│     ├─ Checkpoint saved with pendingQuestion                    │
│     └─ Emits: { type: 'question', ... }                         │
│                         ↓                                        │
│                    [PAUSED]                                      │
│                         ↓                                        │
│  4. USER ANSWERS                                                │
│     agent.resume({ answer: { text: 'TypeScript', choiceId } }) │
│                         ↓                                        │
│  5. CODEAGENT.RESUME()                                          │
│     └─ Stores resume data in runInfo.pendingResume              │
│                         ↓                                        │
│  6. CODEAGENT.STREAM() (called by user)                         │
│     ├─ Checks runInfo.pendingResume                             │
│     ├─ Calls graph.updateState():                               │
│     │   { lastAnswer: { text, choiceId }, pendingQuestion: null }│
│     └─ Calls graph.stream(NULL) ← CRITICAL!                     │
│                         ↓                                        │
│  7. QUESTION_GATE EXECUTES                                      │
│     ├─ Sees lastAnswer is set                                   │
│     ├─ Clears pendingQuestion                                   │
│     └─ Routes based on acceptance existence:                    │
│         • No acceptance → 'planner' (planner asked)             │
│         • Has acceptance → 'agent' (agent asked)                │
│                         ↓                                        │
│  8. PLANNER/AGENT WITH ANSWER                                   │
│     └─ Uses lastAnswer to make decision                         │
│                         ↓                                        │
│                    CONTINUES                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation: question_gate

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/nodes/question-gate.ts`

```typescript
async function questionGateNode(
  state: AgentState,
  config: RunnableConfig
): Promise<Partial<AgentState>> {
  const context = config.configurable as CodeAgentContext

  // Emit question event (even if already answered)
  if (state.pendingQuestion) {
    context.onEvent?.({
      type: 'question',
      runId: context.runId,
      ...state.pendingQuestion
    })
  }

  // Clear question after processing
  return {
    phase: 'question_gate',
    pendingQuestion: null
  }
}
```

**Routing After:**
```typescript
function routeAfterQuestionGate(state: AgentState): string {
  // If no acceptance yet, question was from planner
  if (!state.acceptance) {
    return 'planner'
  }

  // If has acceptance, question was from agent
  return 'agent'
}
```

---

## Approval Interrupt Flow

### Complete Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                   APPROVAL INTERRUPT FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. TOOLS NODE                                                  │
│     ├─ Executes apply_changes tool                              │
│     ├─ Tool checks: policy.autoApprove === false                │
│     ├─ Tool returns: requiresApproval = true                    │
│     └─ Sets state:                                              │
│         • awaitingApproval = true                               │
│         • pendingChanges = [...]                                │
│         • pendingDiffs = [...]                                  │
│         • approvalReason = '...'                                │
│         • messages += ToolMessage (placeholder)                 │
│                         ↓                                        │
│  2. ROUTE TO APPROVAL_GATE                                      │
│     └─ Conditional edge: awaitingApproval → 'approval_gate'     │
│                         ↓                                        │
│  3. APPROVAL_GATE NODE (interruptBefore)                        │
│     ├─ Graph pauses BEFORE executing this node                  │
│     ├─ Checkpoint saved with pendingChanges/Diffs               │
│     └─ Emits: { type: 'approval_required', ... }                │
│                         ↓                                        │
│                    [PAUSED]                                      │
│                         ↓                                        │
│  4. USER APPROVES/REJECTS                                       │
│     agent.resume({ approval: { approved: true } })              │
│                         ↓                                        │
│  5. CODEAGENT.RESUME()                                          │
│     └─ Stores approval in runInfo.pendingResume                 │
│                         ↓                                        │
│  6. CODEAGENT.STREAM() (called by user)                         │
│     ├─ Calls graph.updateState():                               │
│     │   { approved: { approved }, awaitingApproval: false }     │
│     └─ Calls graph.stream(NULL)                                 │
│                         ↓                                        │
│  7. APPROVAL_GATE EXECUTES                                      │
│     ├─ Checks approved.approved === true                        │
│     ├─ If true:                                                 │
│     │   • Calls apply_changes tool again (now approved)         │
│     │   • Tool applies changes atomically                       │
│     │   • Updates messages with real ToolMessage                │
│     │   • Clears pendingChanges/pendingDiffs                    │
│     ├─ If false:                                                │
│     │   • Adds ToolMessage with rejection                       │
│     │   • Agent will see rejection and adjust                   │
│     └─ Clears: awaitingApproval, approved                       │
│                         ↓                                        │
│  8. ROUTE TO AGENT                                              │
│     └─ Always routes to agent after approval_gate               │
│                         ↓                                        │
│  9. AGENT CONTINUES                                             │
│     └─ Sees ToolMessage result (success or rejection)           │
│                         ↓                                        │
│                    CONTINUES                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation: approval_gate

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/nodes/approval-gate.ts`

```typescript
async function approvalGateNode(
  state: AgentState,
  config: RunnableConfig
): Promise<Partial<AgentState>> {
  const context = config.configurable as CodeAgentContext

  const approved = state.approved?.approved ?? false

  if (approved) {
    // Apply changes
    const result = await applyChangesWithApproval(
      state.pendingChanges,
      state.pendingDiffs,
      context
    )

    return {
      phase: 'approval_gate_approved',
      messages: [new ToolMessage({ ...result })],
      appliedChanges: state.pendingChanges,
      appliedDiffs: state.pendingDiffs,
      pendingChanges: [],
      pendingDiffs: [],
      awaitingApproval: false,
      approved: null,
      approvalReason: null
    }
  } else {
    // User rejected changes
    return {
      phase: 'approval_gate_rejected',
      messages: [new ToolMessage({
        tool_call_id: '...',
        content: 'Changes rejected by user'
      })],
      pendingChanges: [],
      pendingDiffs: [],
      awaitingApproval: false,
      approved: null,
      approvalReason: null
    }
  }
}
```

**Placeholder ToolMessage (Critical):**

In tools node, when approval required:
```typescript
// Add placeholder to maintain message pairing
messages.push(new ToolMessage({
  tool_call_id: toolCall.id,
  content: 'Awaiting approval...',
  name: toolCall.name
}))
```

**Why:** Anthropic API requires ToolMessage for every ToolCall. Without placeholder, API rejects request.

---

## Limit Interrupt Flow

### Complete Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                     LIMIT INTERRUPT FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. GRAPH EXECUTION                                             │
│     ├─ agent → tools → reviewer → agent (loop)                  │
│     └─ iterations++ each time through reviewer                  │
│                         ↓                                        │
│  2. RECURSION LIMIT REACHED (100 iterations)                    │
│     └─ LangGraph throws GraphRecursionError                     │
│                         ↓                                        │
│  3. CODEAGENT.STREAM() CATCHES ERROR                            │
│     ├─ Detects: error.name === 'GraphRecursionError'            │
│     ├─ Calls graph.updateState({ limitReached: true })          │
│     └─ Emits: { type: 'limit_reached', ... }                    │
│                         ↓                                        │
│                    [PAUSED]                                      │
│                         ↓                                        │
│  4. USER DECIDES                                                │
│     agent.resume({ continueAfterLimit: true })                  │
│     OR                                                           │
│     agent.abort({ reason: 'Too many iterations' })              │
│                         ↓                                        │
│  5. CODEAGENT.RESUME() (if continue)                            │
│     └─ Stores continueAfterLimit in runInfo.pendingResume       │
│                         ↓                                        │
│  6. CODEAGENT.STREAM()                                          │
│     ├─ Calls graph.updateState():                               │
│     │   { limitReached: false, limitContinue: true }            │
│     └─ Calls graph.stream(NULL)                                 │
│                         ↓                                        │
│  7. GRAPH CONTINUES                                             │
│     └─ Recursion limit reset, agent continues from checkpoint   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Context-Aware Limit Message

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/CodeAgent.ts:buildLimitMessage`

```typescript
function buildLimitMessage(state: AgentState, iteration: number): string {
  const parts = [`Iteration limit (${iteration}) reached.`]

  // Add context about what was happening
  if (state.phase) {
    parts.push(`Current phase: ${state.phase}`)
  }

  // Add progress if in plan
  if (state.plan && state.currentStep < state.plan.length) {
    const step = state.plan[state.currentStep]
    parts.push(`Working on: ${step.title} (step ${state.currentStep + 1}/${state.plan.length})`)
  }

  // Add verification status
  if (state.lastVerification) {
    const statuses = []
    if (state.lastVerification.build?.success) statuses.push('build: passed')
    if (state.lastVerification.tests?.success) statuses.push('tests: passed')
    if (state.lastVerification.mock?.success) statuses.push('mock: passed')

    if (statuses.length > 0) {
      parts.push(`Verification: ${statuses.join(', ')}`)
    }
  }

  return parts.join('\n')
}
```

---

## Resume Semantics

### CRITICAL: updateState + null Input

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/CodeAgent.ts:stream`

```typescript
// Determine input for graph.stream()
let input: typeof AgentStateAnnotation.State | null

if (runInfo.pendingResume) {
  // RESUMING after interrupt
  const resume = runInfo.pendingResume

  // Update state with resume data
  const stateUpdate: Partial<AgentState> = {}

  if (resume.approval) {
    stateUpdate.approved = resume.approval
    stateUpdate.awaitingApproval = false
  }

  if (resume.answer) {
    stateUpdate.lastAnswer = resume.answer
    stateUpdate.pendingQuestion = null
  }

  if (resume.continueAfterLimit) {
    stateUpdate.limitReached = false
    stateUpdate.limitContinue = true
  }

  await graph.updateState(config, stateUpdate)

  // CRITICAL: Use NULL input to resume from checkpoint
  input = null

  // Clear pending resume
  runInfo.pendingResume = null

} else if (isFirstStream) {
  // FRESH START
  input = buildInitialState(request)

} else {
  // CONTINUING (no interrupt)
  input = null
}

// Stream with determined input
for await (const event of graph.stream(input, config)) {
  // ... emit events
}
```

**Why null?**
- `null` tells LangGraph to resume from last checkpoint
- `{}` or any object restarts from START node
- This is a LangGraph API requirement

---

## Interrupt Idempotency

### The Problem

LangGraph restarts interrupted nodes when resuming:

```
First execution:
  planner → sets pendingQuestion → routes to question_gate → PAUSE

After resume:
  question_gate executes → sees lastAnswer → routes to planner
  planner executes AGAIN → must not ask same question
```

### Solutions

#### For question_gate

Node sees `lastAnswer` and routes appropriately:
```typescript
// Don't ask again if answer exists
if (state.lastAnswer) {
  return { phase: 'question_gate' }  // Just pass through
}
```

#### For approval_gate

Node sees `approved` and applies changes:
```typescript
// Don't ask approval again
if (state.approved !== null) {
  // Process the approval decision
  return applyOrReject(state.approved, state.pendingChanges)
}
```

#### For tools node before approval

Use placeholder ToolMessage to prevent tool re-execution:
```typescript
// Add placeholder immediately
messages.push(new ToolMessage({
  tool_call_id: toolCall.id,
  content: 'Awaiting approval...'
}))

// Set approval state
awaitingApproval = true

// Stop processing more tools
break
```

On resume, approval_gate replaces placeholder with actual result.

---

## Error Handling During Interrupts

### Question Timeout (Future)

```typescript
// Not yet implemented, but planned:
const QUESTION_TIMEOUT = 300_000  // 5 minutes

setTimeout(() => {
  if (state.pendingQuestion && !state.lastAnswer) {
    // Abort run or use default answer
    agent.abort({ runId, reason: 'Question timeout' })
  }
}, QUESTION_TIMEOUT)
```

### Approval Timeout (Future)

```typescript
// Not yet implemented, but planned:
const APPROVAL_TIMEOUT = 600_000  // 10 minutes

setTimeout(() => {
  if (state.awaitingApproval && !state.approved) {
    // Auto-reject after timeout
    agent.resume({ runId, approval: { approved: false } })
  }
}, APPROVAL_TIMEOUT)
```

---

## Testing Interrupts

### Unit Test Pattern

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/__tests__/integration/interrupt-resume.integration.test.ts`

```typescript
describe('Question Interrupt', () => {
  it('pauses and resumes correctly', async () => {
    // Mock planner to ask question
    mockLLM.addResponse({
      content: JSON.stringify({
        needsClarification: true,
        clarifyingQuestion: {
          text: 'Which framework?',
          choices: [
            { id: 'react', label: 'React' },
            { id: 'vue', label: 'Vue' }
          ]
        }
      })
    })

    // Start run
    const { runId } = await agent.start({
      input: 'Add a component',
      mode: 'plan'
    })

    // Stream until question
    const events = []
    for await (const event of agent.stream(runId)) {
      events.push(event)
      if (event.type === 'question') break
    }

    expect(events.find(e => e.type === 'question')).toBeDefined()

    // Answer question
    await agent.resume({
      runId,
      answer: { text: 'React', choiceId: 'react' }
    })

    // Continue streaming
    for await (const event of agent.stream(runId)) {
      events.push(event)
    }

    // Should complete without asking again
    expect(events.filter(e => e.type === 'question')).toHaveLength(1)
  })
})
```

---

## Related Documents

- [State Machine](./state-machine.md) - Where interrupts occur in graph
- [State Schema](./state-schema.md) - State fields for interrupts
- [Run Lifecycle](./run-lifecycle.md) - resume() API details
- [Event Streaming](./event-streaming.md) - Interrupt events
- [Change Tools](../tools/change-tools.md) - apply_changes approval trigger
