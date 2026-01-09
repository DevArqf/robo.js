# Context Compaction

> **For AI Agents**: Read this when implementing context management, understanding token limits, or debugging compaction triggers.

## Overview

Context compaction prevents exceeding model context limits by trimming old messages while preserving critical structured information. Triggered automatically when context usage exceeds configured thresholds.

**Key Files:**
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/compaction/compactor.ts` - ContextCompactor
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/token-counter.ts` - Token counting
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/token-limits.ts` - Model limits

---

## When Compaction Triggers

### Token-Based (Primary)

```
Current context tokens > (modelContextLimit × tokenThresholdPercent)

Default: 200,000 × 0.70 = 140,000 tokens
```

**Checked in agent node before each LLM call:**

```typescript
// Count current context
const currentTokens = tokenCounter.count({
  system: systemPrompt,
  messages: state.messages,
  tools: toolSchemas
})

const limit = policy.context.modelContextLimit  // 200,000
const threshold = limit * policy.context.tokenThresholdPercent  // 0.7 = 140,000

if (currentTokens > threshold) {
  // Trigger compaction
  const result = await contextCompactor.compact(state, currentTokens)
}
```

### Message-Based (Fallback)

```
Message count > maxMessagesBeforeCompaction

Default: 50 messages
```

**Used when:** `modelContextLimit` not configured or token counting fails

---

## What Gets Compacted

### Preserved (Never Trimmed)

**Structured Fields:**
- `acceptance` - Required for completion check
- `plan` - Required for progress tracking
- `projectProfile` / `projectIndex` / `projectOverview` - Required for context
- `acceptanceStatus` - Required for verification
- `lastVerification` - Required for retry decisions
- `appliedChanges` / `appliedDiffs` - Required for audit

**Recent Messages:**
- Last N messages (default: 10)
- Prevents losing immediate context

### Compacted (Trimmed)

**Old Messages:**
- Messages beyond keepLastMessages threshold
- Summarized into structured summary
- Original messages removed

**Never Split:**
- Tool-call turns (AIMessage with tool_calls + all ToolMessages)
- Turns kept or dropped as atomic units

---

## Compaction Algorithm

### MessageTurn Grouping

```typescript
interface MessageTurn {
  messages: BaseMessage[]
  isToolCallTurn: boolean
}

// Group messages into turns
function groupIntoTurns(messages: BaseMessage[]): MessageTurn[] {
  const turns: MessageTurn[] = []
  let currentTurn: BaseMessage[] = []
  let isToolCallTurn = false

  for (const message of messages) {
    if (message._getType() === 'ai' && 'tool_calls' in message && message.tool_calls?.length > 0) {
      // Start tool call turn
      currentTurn = [message]
      isToolCallTurn = true
    } else if (message._getType() === 'tool' && isToolCallTurn) {
      // Continue tool call turn
      currentTurn.push(message)

      // Check if all tool calls resolved
      const aiMsg = currentTurn[0]
      const toolMsgs = currentTurn.slice(1)

      if (toolMsgs.length >= (aiMsg.tool_calls?.length ?? 0)) {
        // Turn complete
        turns.push({ messages: currentTurn, isToolCallTurn: true })
        currentTurn = []
        isToolCallTurn = false
      }
    } else {
      // Standalone message
      if (currentTurn.length > 0) {
        turns.push({ messages: currentTurn, isToolCallTurn })
        currentTurn = []
        isToolCallTurn = false
      }
      turns.push({ messages: [message], isToolCallTurn: false })
    }
  }

  return turns
}
```

### Compaction Steps

1. **Group messages into turns** (preserve tool-call atomicity)
2. **Keep last N messages** (default: 10)
3. **Generate summary from dropped messages**:
   - Goals and requirements
   - Key decisions made
   - Files changed
   - Last verification status
4. **Create new messages array**: `[SystemMessage(summary), ...keptMessages]`
5. **Calculate token savings**

---

## Summary Generation

### Summary Structure

```typescript
interface CompactionSummary {
  goals: string[]           // What user wanted
  decisions: string[]       // Key choices made
  progress: string[]        // Work completed
  filesChanged: string[]    // Modified paths
  verificationStatus?: {
    build: boolean
    tests: boolean
    mock: boolean
  }
}
```

### Summary Template

```
# Previous Context Summary

## Goals
- Add authentication system
- Implement user login/logout

## Key Decisions
- Using JWT tokens for session management
- Storing sessions in Flashcore

## Progress Completed
- Created /src/auth/jwt.ts
- Added login command
- Added session middleware

## Files Modified
- /src/auth/jwt.ts (create)
- /src/commands/login.ts (create)
- /src/middleware/session.ts (modify)

## Last Verification
- Build: PASSED
- Tests: PASSED
- Mock: PASSED
```

**Max length:** 2000 characters (configurable via `maxSummaryChars`)

---

## ContextPolicy Configuration

```typescript
interface ContextPolicy {
  // Enable compaction
  enableCompaction: boolean                // default: true

  // Token-based thresholds
  modelContextLimit: number                // default: 200000 (Claude)
  tokenThresholdPercent: number            // default: 0.7 (70%)
  reservedOutputTokens: number             // default: 8192
  minTokensAfterCompaction: number         // default: 10000

  // Preservation rules
  keepLastMessages: number                 // default: 10

  // Summary limits
  maxSummaryChars: number                  // default: 2000

  // Legacy (deprecated)
  maxMessagesBeforeCompaction?: number     // default: 50 (fallback)
}
```

---

## CompactionResult

```typescript
interface CompactionResult {
  summary: string                // Structured summary
  trimmedMessages: BaseMessage[] // Messages to keep
  droppedCount: number           // How many messages removed
  beforeTokens?: number          // Pre-compaction count
  afterTokens?: number           // Post-compaction count
}
```

---

## Token Counting

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/token-counter.ts`

Uses `js-tiktoken` for accurate Claude token counting:

```typescript
function countMessageTokens(messages: BaseMessage[]): number {
  const encoding = getEncoding('cl100k_base')  // Claude tokenizer

  let total = 0

  for (const message of messages) {
    // Count role overhead
    total += 4  // <|im_start|>role\n

    // Count content
    if (typeof message.content === 'string') {
      total += encoding.encode(message.content).length
    }

    // Count tool calls
    if ('tool_calls' in message && message.tool_calls) {
      total += countToolCalls(message.tool_calls)
    }

    total += 4  // <|im_end|>\n
  }

  return total
}
```

---

## Debug Events

When compaction occurs, emits debug event (if `includeDebugEvents: true`):

```typescript
{
  type: 'debug_context_compacted',
  beforeTokens: 145000,
  afterTokens: 45000,
  beforeMessages: 120,
  afterMessages: 25,
  droppedMessages: 95,
  summaryLength: 1850
}
```

---

## Usage in Agent Node

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/nodes/agent.ts:77-108`

```typescript
// Before LLM call, check compaction
const contextCompactor = new ContextCompactor(context.policy.context)

if (contextCompactor.shouldCompact(state, currentContextTokens)) {
  const compactionResult = await contextCompactor.compact(state, currentContextTokens)

  // Emit debug event
  context.onEvent?.({
    type: 'debug_context_compacted',
    beforeTokens: compactionResult.beforeTokens,
    afterTokens: compactionResult.afterTokens,
    beforeMessages: state.messages.length,
    afterMessages: compactionResult.trimmedMessages.length,
    droppedMessages: compactionResult.droppedCount,
    summaryLength: compactionResult.summary.length
  })

  // Update state
  return {
    messages: compactionResult.trimmedMessages,
    summary: compactionResult.summary
  }
}
```

---

## Best Practices

### 1. Monitor Compaction

Watch for debug events to understand token usage:

```typescript
for await (const event of agent.stream(runId, { includeDebugEvents: true })) {
  if (event.type === 'debug_context_compacted') {
    console.log(`Compacted: ${event.droppedMessages} messages dropped`)
    console.log(`Tokens: ${event.beforeTokens} → ${event.afterTokens}`)
  }
}
```

### 2. Adjust Thresholds for Model

```typescript
const policy: AgentPolicy = {
  context: {
    modelContextLimit: 100_000,      // Smaller model
    tokenThresholdPercent: 0.6,      // Trigger earlier (60%)
    keepLastMessages: 5              // Keep fewer messages
  }
}
```

### 3. Disable for Short Runs

```typescript
const policy: AgentPolicy = {
  context: {
    enableCompaction: false  // Disable for quick tasks
  }
}
```

---

## Related Documents

- [Agent Node](./state-machine.md#agent) - Where compaction occurs
- [State Schema](./state-schema.md) - Summary field
- [Token Limits](../types/llm.md) - Model context limits
- [Policy](../tools/policy.md) - ContextPolicy configuration
