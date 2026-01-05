# Change Tools

> **For AI Agents**: Read this when implementing file changes with approval flow, understanding atomic application, or debugging change-related errors.

## apply_changes Tool

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/changes/apply.ts`

### Purpose

Atomically apply multiple file changes (create/modify/delete) with validation, diff generation, approval flow, and rollback on error.

---

## Arguments

```typescript
{
  changes: FileChange[],
  reason?: string  // Optional reason for the changes
}

type FileChange =
  | { path: string; type: 'create'; content: string }
  | { path: string; type: 'modify'; content: string }
  | { path: string; type: 'delete' }
```

## Output

```typescript
interface ApplyChangesOutput {
  applied: boolean          // Whether changes were applied
  changes: FileChange[]     // The input changes
  appliedPaths: string[]    // Paths that were modified
  appliedDiffs?: FileDiff[] // Diffs for each change
  errors?: Array<{ path: string; error: string }>  // Validation errors
}
```

---

## Four-Phase Execution

```
┌──────────────────────────────────────────────────────────────┐
│              APPLY_CHANGES WORKFLOW                           │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  PHASE 1: VALIDATION                                         │
│  ├─ Check empty changes array                                │
│  ├─ Validate ALL paths against policy                        │
│  ├─ Calculate total size                                     │
│  ├─ Check maxTotalDiffBytes limit                            │
│  └─ Abort if any violation                                   │
│                     ↓                                         │
│  PHASE 1.5: STALE DETECTION                                  │
│  ├─ For modify/delete: check file tracker                    │
│  ├─ Get current file state (stat)                            │
│  ├─ Compare mtime + size                                     │
│  └─ Abort if stale (recoverable - re-read file)              │
│                     ↓                                         │
│  PHASE 2: DIFF GENERATION                                    │
│  ├─ Read current state of all affected files                 │
│  ├─ Generate unified diffs                                   │
│  ├─ Calculate additions/deletions                            │
│  └─ Store current contents for rollback                      │
│                     ↓                                         │
│  PHASE 3: APPROVAL REQUEST                                   │
│  ├─ If autoApprove=false:                                    │
│  │   └─ Return requiresApproval with changes + diffs         │
│  └─ If autoApprove=true: proceed to Phase 4                  │
│                     ↓                                         │
│  PHASE 4: ATOMIC APPLICATION                                 │
│  ├─ Apply changes in order                                   │
│  ├─ Track rollback actions                                   │
│  ├─ On error: rollback in reverse order                      │
│  ├─ Emit file_applied per successful operation               │
│  └─ Clear file tracker for modified paths                    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Unified Diff Generation

### diff Library Integration

```typescript
import * as diff from 'diff'

function generateUnifiedDiff(
  path: string,
  oldContent: string,
  newContent: string
): string {
  const patch = diff.createPatch(
    path,                    // File name
    oldContent,              // Original
    newContent,              // Modified
    'original',              // Old file label
    'modified'               // New file label
  )

  return patch
}
```

### Example Diff

```
--- /src/index.ts    original
+++ /src/index.ts    modified
@@ -1,3 +1,4 @@
+import { logger } from './logger'
 export function hello() {
-  console.log('hello')
+  logger.info('hello')
 }
```

---

## Approval Flow

### When AutoApprove=false

```typescript
// Tool returns approval request via approvalRequired() helper
// This creates a ToolResult with:
{
  success: false,  // Not yet applied
  requiresApproval: true,
  pendingChanges: changes,
  pendingDiffs: diffs,
  approvalReason: reason ?? `Apply ${changes.length} file change(s)`
}

// For terminal commands:
{
  success: false,
  requiresApproval: true,
  pendingCommand: {
    executable: 'npm',
    args: ['run', 'deploy'],
    cwd: '/project'
  },
  approvalReason: 'Command requires approval: npm run deploy'
}

// tools node sets
state.awaitingApproval = true
state.pendingChanges = changes
state.pendingDiffs = diffs
state.pendingCommand = pendingCommand  // For terminal approval

// Routes to approval_gate → pauses → user approves → reapplies
```

### When AutoApprove=true

```typescript
// Tool proceeds directly to Phase 4
// Returns via successResult() helper:
{
  success: true,
  data: {
    applied: true,
    changes: changes,
    appliedPaths: ['/src/a.ts', '/src/b.ts'],
    appliedDiffs: diffs
  }
}
```

---

## Rollback Strategy

### Tracking Rollback Actions

```typescript
const rollbackActions: Array<() => Promise<void>> = []

for (const change of changes) {
  if (change.type === 'create' || change.type === 'modify') {
    const oldContent = currentContents.get(change.path)

    rollbackActions.push(async () => {
      if (oldContent !== undefined) {
        await provider.writeFile(change.path, oldContent)
      } else {
        await provider.deletePath(change.path)
      }
    })

    await provider.writeFile(change.path, change.content)
  } else {
    // delete
    const oldContent = currentContents.get(change.path)

    rollbackActions.push(async () => {
      if (oldContent) {
        await provider.writeFile(change.path, oldContent)
      }
    })

    await provider.deletePath(change.path)
  }
}
```

### On Error

```typescript
try {
  // Apply all changes
} catch (error) {
  // Execute rollback in reverse order
  for (let i = rollbackActions.length - 1; i >= 0; i--) {
    try {
      await rollbackActions[i]()
    } catch (rollbackError) {
      // Log but continue rollback
      codeLogger.error('Rollback failed:', rollbackError)
    }
  }

  return errorResult('Application failed, changes rolled back', {
    errorCode: 'EXECUTION_FAILED',
    recoverable: true
  })
}
```

---

## Related Documents

- [Policy](./policy.md)
- [Stale Detection](./stale-detection.md)
- [Approval Interrupt](../orchestration/interrupts.md)
- [Types](../types/changes.md)
