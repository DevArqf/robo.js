# Run Types

> **For AI Agents**: Reference for run-related types.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/types/run.ts`

## RunMode

```typescript
type RunMode = 'explain' | 'plan' | 'execute'
```

## RunStatus

```typescript
type RunStatus = 'running' | 'paused' | 'completed' | 'aborted'
```

## RunMeta

```typescript
{
  runId: string,
  mode: RunMode,
  input: string,
  status: RunStatus,
  createdAt: number,
  updatedAt: number,
  appliedChanges: FileChange[],
  completionSummary: string | null
}
```

## TaskStep

```typescript
{
  id: string,
  title: string,
  description: string,
  files: string[],
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
}
```

## QuestionAnswer

```typescript
{
  text: string,
  choiceId?: string
}
```

## ApprovalResponse

```typescript
{
  approved: boolean
}
```

## Related

- [Run Lifecycle](../orchestration/run-lifecycle.md)
- [State Schema](../orchestration/state-schema.md)
