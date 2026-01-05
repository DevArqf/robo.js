# Change Types

> **For AI Agents**: Reference for file change and diff types.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/types/changes.ts`

## FileChange

```typescript
type FileChange =
  | { path: string; type: 'create'; content: string }
  | { path: string; type: 'modify'; content: string }
  | { path: string; type: 'delete' }
```

## FileDiff

```typescript
{
  path: string,
  type: 'create' | 'modify' | 'delete',
  unifiedDiff?: string,  // Unified diff format
  oldSize?: number,
  newSize?: number,
  truncated?: boolean,
  additions?: number,
  deletions?: number
}
```

## ChangeSet

```typescript
{
  changes: FileChange[],
  diffs: FileDiff[]
}
```

## ProposedChanges

For remote MCP tools:

```typescript
{
  proposedChanges?: {
    changes: FileChange[]
  },
  data?: unknown,
  notes?: string
}
```

## Related

- [Change Tools](../tools/change-tools.md)
- [Approval Interrupt](../orchestration/interrupts.md#approval-interrupt)
