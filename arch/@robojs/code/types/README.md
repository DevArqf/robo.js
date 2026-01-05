# Type System

> **For AI Agents**: Reference for all TypeScript types used throughout @robojs/code SDK.

## Overview

Complete type reference organized by domain. All types exported from `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/types/`.

## Type Categories

1. [Events](./events.md) - AgentEvent, StreamOptions, all event types
2. [Execution](./execution.md) - ExecutionProvider, DirEntry, RunOptions, TerminalChunk
3. [LLM](./llm.md) - LLMProvider, BrandedModelAlias, ChatMessage, ChatResponse
4. [Policy](./policy.md) - AgentPolicy, CommandArgPolicy, ContextPolicy
5. [Acceptance](./acceptance.md) - AcceptanceCriteria, ScenarioSpec, Requirements
6. [Changes](./changes.md) - FileChange, FileDiff, ChangeSet
7. [Run](./run.md) - RunMode, RunMeta, RunStatus, TaskStep
8. [Robo](./robo.md) - ProjectProfile, RoboProjectKind, VerificationResult

## Import Patterns

```typescript
// Main exports
import { ExecutionProvider, AgentPolicy } from '@robojs/code'

// Types-only
import type { FileChange, FileDiff } from '@robojs/code/types'
```

## Related

- [State Schema](../orchestration/state-schema.md)
- [Event Streaming](../orchestration/event-streaming.md)
