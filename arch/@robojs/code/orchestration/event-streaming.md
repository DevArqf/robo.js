# Event Streaming

> **For AI Agents**: Read this when implementing UI event handlers, understanding the event protocol, or debugging event emission issues.

## Overview

The agent emits real-time events via AsyncGenerator for UI integration. Events are categorized into families (lifecycle, tools, files, terminal, etc.) and can be filtered via StreamOptions.

**Key Files:**
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/types/events.ts` - Event types
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/events/stream-adapter.ts` - Event transformation

---

## Event Categories

### 1. Lifecycle Events

| Event | When Emitted | Data |
|-------|--------------|------|
| `start` | Run begins | runId, instruction, mode |
| `phase` | Node transition | phase name |
| `profile` | Project detected | ProjectProfile |
| `complete` | Run finishes successfully | summary, changes, diffs, verification |
| `abort` | Run cancelled | reason |

### 2. Progress Events

| Event | When Emitted | Data |
|-------|--------------|------|
| `plan` | Planner generates steps | TaskStep[] |
| `plan_complete` | Plan finalized | runId, acceptance, plan |
| `progress` | Step progress update | step, of, label |
| `rationale` | Agent explains reasoning | markdown text |

### 3. LLM Events

| Event | When Emitted | Data |
|-------|--------------|------|
| `llm_text` | LLM streams text | delta (incremental) |

### 4. Core Tool Events

| Event | When Emitted | Data |
|-------|--------------|------|
| `tool_call` | Core tool invoked | source='core', name, args |
| `tool_result` | Core tool completes | source='core', name, result |

### 5. MCP Tool Events

| Event | When Emitted | Data |
|-------|--------------|------|
| `mcp_call` | MCP tool invoked | source='mcp', serverId, toolName, args |
| `mcp_result` | MCP tool completes | source='mcp', serverId, toolName, result |

### 6. File Events

| Event | When Emitted | Data |
|-------|--------------|------|
| `file_proposed` | Changes proposed | changes, diffs |
| `approval_required` | Approval needed | runId, changes, diffs, reason |
| `file_applied` | File written/deleted | path, type |

### 7. Terminal Events

| Event | When Emitted | Data |
|-------|--------------|------|
| `terminal` | Terminal output | TerminalChunk (data/exit) |
| `terminal_truncated` | Buffer overflow | sessionId, droppedBytes, totalDropped |

### 8. Interrupt Events

| Event | When Emitted | Data |
|-------|--------------|------|
| `question` | Clarification needed | runId, text, choices |
| `limit_reached` | Budget exhausted | message, iteration, limit, phase |

### 9. Validation Events

| Event | When Emitted | Data |
|-------|--------------|------|
| `mock` | Mock event dispatched | MockEvent (command, assertion, etc.) |
| `retry` | Verification failed, retrying | reason, iteration |

### 10. Debug Events (debugMode only)

| Event | When Emitted | Data |
|-------|--------------|------|
| `debug_llm_thinking` | LLM reasoning trace | thinking text |
| `debug_system_prompt` | System prompt built | prompt text |
| `debug_tool_timing` | Tool execution timed | toolName, durationMs |
| `debug_verification_detail` | Verification detail | kind, detail |
| `debug_policy_check` | Policy evaluated | check, result |
| `debug_state_update` | State field updated | field, newValue |
| `debug_context_compacted` | Context trimmed | beforeTokens, afterTokens, summaryLength |
| `debug_decision` | Routing decision | node, decision, reason |
| `debug_token_usage` | Token counts | promptTokens, completionTokens |
| `debug_llm_meta` | LLM metadata | model, provider, etc. |
| (3 more debug events) | Various | Various |

---

## StreamOptions Filtering

### Default Options

```typescript
const DEFAULT_STREAM_OPTIONS: StreamOptions = {
  includeText: true,
  includePlan: true,
  includeProgress: true,
  includeRationales: false,
  includeToolCalls: true,
  includeToolResults: true,
  includeMcpCalls: true,
  includeMcpResults: true,
  includeDebugEvents: false
}
```

### Customization

```typescript
// Minimal - only show completions
for await (const event of agent.stream(runId, {
  includeText: false,
  includeToolCalls: false,
  includeToolResults: false,
  includeMcpCalls: false,
  includeMcpResults: false
})) {
  // Only lifecycle + interrupts + completion
}

// Verbose - everything including debug
for await (const event of agent.stream(runId, {
  includeDebugEvents: true,
  includeRationales: true
})) {
  // All events including internal reasoning
}

// Tool-focused - track tool execution
for await (const event of agent.stream(runId, {
  includeText: false,
  includeToolCalls: true,
  includeToolResults: true
})) {
  if (event.type === 'tool_call') {
    console.log('Tool:', event.name, event.args)
  }
}
```

---

## Event Emission Timing

### Real-Time (Custom Stream)

LLM text deltas emitted immediately:

```typescript
// In agent node
for await (const chunk of llm.stream(request)) {
  if (chunk.type === 'text') {
    config.writer?.({
      type: 'llm_text',
      delta: chunk.text
    })
  }
}
```

**Received by:**
```typescript
for await (const event of agent.stream(runId)) {
  if (event.type === 'llm_text') {
    appendToUI(event.delta)  // Immediate, character by character
  }
}
```

### Batched (Update Stream)

Most events collected in queue, emitted after node completion:

```typescript
// Node emits event
context.onEvent?.({
  type: 'tool_call',
  source: 'core',
  name: 'fs_write',
  args: { path: '/src/file.ts', content: '...' }
})

// Event queued in runInfo.eventQueue

// After node completes, stream yields event
yield event
```

---

## Tool Event Extraction

### From Messages

StreamAdapter extracts tool events from BaseMessage arrays:

```typescript
function extractToolEvents(messages: BaseMessage[]): AgentEvent[] {
  const events: AgentEvent[] = []

  for (const message of messages) {
    // AIMessage with tool_calls
    if (message._getType() === 'ai' && 'tool_calls' in message) {
      for (const toolCall of message.tool_calls ?? []) {
        // Check if MCP tool (has serverId metadata)
        const isMcp = toolCall.metadata?.serverId

        events.push(isMcp ? {
          type: 'mcp_call',
          source: 'mcp',
          serverId: toolCall.metadata.serverId,
          toolName: toolCall.metadata.originalName,
          args: toolCall.args
        } : {
          type: 'tool_call',
          source: 'core',
          name: toolCall.name,
          args: toolCall.args
        })
      }
    }

    // ToolMessage (result)
    if (message._getType() === 'tool') {
      const toolMsg = message as ToolMessage

      // Parse result
      const result = JSON.parse(toolMsg.content)

      events.push({
        type: 'tool_result',
        source: 'core',  // Or 'mcp' if metadata present
        name: toolMsg.name,
        result
      })
    }
  }

  return events
}
```

---

## Event Ordering Guarantees

### Within Same Node

Events emitted in node execution order:

```
tool_call('fs_read') → tool_result('fs_read') → tool_call('fs_write') → tool_result('fs_write')
```

### Across Nodes

Phase events mark transitions:

```
phase('planner') → plan → phase('agent') → llm_text → tool_call → ...
```

### Terminal Events

Terminal chunks emitted as soon as available (polling-based):

```
terminal({data}) → terminal({data}) → terminal({data}) → terminal({exit})
```

---

## StreamOptions Implementation

### Filtering Logic

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/events/stream-adapter.ts:shouldInclude`

```typescript
private shouldInclude(event: AgentEvent): boolean {
  const opts = this.options

  switch (event.type) {
    // Always include
    case 'start':
    case 'complete':
    case 'abort':
    case 'question':
    case 'approval_required':
    case 'limit_reached':
      return true

    // Conditional
    case 'llm_text':
      return opts.includeText !== false
    case 'plan':
    case 'plan_complete':
      return opts.includePlan !== false
    case 'progress':
      return opts.includeProgress !== false
    case 'rationale':
      return opts.includeRationales === true
    case 'tool_call':
      return opts.includeToolCalls !== false && event.source === 'core'
    case 'tool_result':
      return opts.includeToolResults !== false && event.source === 'core'
    case 'mcp_call':
      return opts.includeMcpCalls !== false
    case 'mcp_result':
      return opts.includeMcpResults !== false

    // Debug events
    case 'debug_llm_thinking':
    case 'debug_system_prompt':
    case 'debug_tool_timing':
    // ... all debug events
      return opts.includeDebugEvents === true

    default:
      return true  // Unknown events pass through
  }
}
```

---

## Usage in UI

### React Hook Pattern

```typescript
function useAgentStream(runId: string, options?: StreamOptions) {
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [status, setStatus] = useState<RunStatus>('running')

  useEffect(() => {
    const streamEvents = async () => {
      for await (const event of agent.stream(runId, options)) {
        setEvents(prev => [...prev, event])

        if (event.type === 'complete') {
          setStatus('completed')
        } else if (event.type === 'abort') {
          setStatus('aborted')
        }
      }
    }

    streamEvents()
  }, [runId])

  return { events, status }
}
```

### Terminal Output Aggregation

```typescript
const terminalContent = events
  .filter(e => e.type === 'terminal' && e.chunk.type === 'data')
  .map(e => e.chunk.data)
  .join('')
```

### Progress Indicator

```typescript
const progressEvent = events.find(e => e.type === 'progress')

if (progressEvent) {
  console.log(`Step ${progressEvent.step}/${progressEvent.of}: ${progressEvent.label}`)
}
```

---

## Related Documents

- [Run Lifecycle](./run-lifecycle.md) - start/stream/resume API
- [Interrupts](./interrupts.md) - Question/approval/limit details
- [State Machine](./state-machine.md) - Where events originate
- [Types](../types/events.md) - All AgentEvent types
