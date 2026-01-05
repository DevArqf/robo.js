# Event Types

> **For AI Agents**: Complete reference for all AgentEvent types.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/types/events.ts`

## AgentEvent Union

```typescript
type AgentEvent =
  // Lifecycle
  | { type: 'start'; runId: string; instruction: string; mode: RunMode }
  | { type: 'phase'; phase: string }
  | { type: 'profile'; profile: ProjectProfile }
  | { type: 'complete'; summary: string; changes: FileChange[]; diffs?: FileDiff[]; verification?: VerificationResults }
  | { type: 'abort'; reason: string }

  // Progress
  | { type: 'plan'; steps: TaskStep[] }
  | { type: 'plan_complete'; runId: string; acceptance: AcceptanceCriteria; plan: TaskStep[] }
  | { type: 'progress'; step: number; of: number; label: string }
  | { type: 'rationale'; markdown: string }

  // LLM
  | { type: 'llm_text'; delta: string }

  // Core Tools
  | { type: 'tool_call'; source: 'core'; name: string; args: unknown }
  | { type: 'tool_result'; source: 'core'; name: string; result: unknown }

  // MCP Tools
  | { type: 'mcp_call'; source: 'mcp'; serverId: string; tool: string; args: unknown }
  | { type: 'mcp_result'; source: 'mcp'; serverId: string; tool: string; result: unknown }

  // Files
  | { type: 'file_proposed'; changes: FileChange[]; diffs?: FileDiff[] }
  | { type: 'approval_required'; runId: string; changes: FileChange[]; diffs?: FileDiff[]; reason?: string }
  | { type: 'file_applied'; path: string }

  // Terminal
  | { type: 'terminal'; chunk: TerminalChunk }
  | { type: 'terminal_truncated'; sessionId: string; droppedBytes: number }

  // Interrupts
  | { type: 'question'; runId: string; text: string; choices?: QuestionChoice[] }
  | { type: 'limit_reached'; message: string; iteration: number; limit: number; phase: string; stepProgress?: { current: number; total: number; label: string } }

  // Validation
  | { type: 'mock'; event: MockEvent }
  | { type: 'retry'; reason: string; iteration: number }

  // Debug (10 debug event types - see file for complete list)
  | { type: 'debug_llm_thinking'; thinking: string }
  | { type: 'debug_system_prompt'; prompt: string }
  | { type: 'debug_tool_timing'; toolName: string; durationMs: number }
  // ... more debug events
```

## StreamOptions

```typescript
{
  includeText?: boolean,
  includePlan?: boolean,
  includeProgress?: boolean,
  includeRationales?: boolean,
  includeToolCalls?: boolean,
  includeToolResults?: boolean,
  includeMcpCalls?: boolean,
  includeMcpResults?: boolean,
  includeDebugEvents?: boolean
}
```

## Related

- [Event Streaming](../orchestration/event-streaming.md)
