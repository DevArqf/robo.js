# Stale Detection

> **For AI Agents**: Read this when debugging "stale file" errors or understanding the file tracking system.

## Overview

FileReadTracker prevents data loss by detecting when files change between read and write operations.

**Key File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/tracking/file-tracker.ts`

---

## The Problem

```typescript
// 1. Agent reads file
const content = await fs_read('/src/auth.ts')
// Snapshot: mtime=100, size=500

// 2. User manually edits file
// Now: mtime=200, size=550

// 3. Agent tries to write (based on old read)
await fs_write('/src/auth.ts', modifiedContent)  // ❌ Would lose user's edits!
```

---

## FileReadSnapshot

```typescript
interface FileReadSnapshot {
  path: string
  mtimeMs: number | null     // Modification timestamp
  size: number | null        // File size in bytes
  readAt: number             // When read occurred
  exists: boolean            // File existed at read time
  turnNumber?: number        // Agent cycle when read
  contentSizeInMessage?: number  // Size in context
}
```

---

## Staleness Check

```typescript
function checkStaleness(
  snapshot: FileReadSnapshot,
  current: CurrentFileState
): StaleCheckResult {
  // File didn't exist, now exists
  if (!snapshot.exists && current.exists) {
    return { isStale: true, reason: 'file_created' }
  }

  // File existed, now doesn't
  if (snapshot.exists && !current.exists) {
    return { isStale: true, reason: 'file_deleted' }
  }

  // Both exist - check mtime and size
  if (snapshot.exists && current.exists) {
    if (current.mtimeMs > snapshot.mtimeMs) {
      return { isStale: true, reason: 'mtime_changed' }
    }

    if (current.size !== snapshot.size) {
      return { isStale: true, reason: 'size_changed' }
    }
  }

  return { isStale: false }
}
```

---

## Usage in Tools

### fs_read Records Snapshot

```typescript
// After successful read
const stat = await provider.stat(path)

fileTracker.record({
  path,
  mtimeMs: stat.mtimeMs,
  size: stat.size,
  readAt: Date.now(),
  exists: true,
  turnNumber: fileTracker.getTurn()
})
```

### fs_write Checks Staleness

```typescript
const snapshot = fileTracker.get(path)

if (snapshot) {
  const current = await provider.stat(path).catch(() => ({
    exists: false,
    mtimeMs: null,
    size: null
  }))

  const check = checkStaleness(snapshot, current)

  if (check.isStale) {
    throw new CodeAgentError(
      `File has changed since last read: ${check.reason}`,
      'STALE_FILE',
      true  // Recoverable - re-read file
    )
  }
}
```

### Clear After Write

```typescript
await provider.writeFile(path, content)

// Clear snapshot - new baseline
fileTracker.clear(path)
```

---

## Turn-Based Recency

### incrementTurn()

Called after each agent/tools cycle:

```typescript
// After tools node completes
fileTracker.incrementTurn()  // turn++
```

### Inactive File Detection

```typescript
// Files read 5+ turns ago are "inactive"
const inactiveFiles = fileTracker.getInactiveFiles(5)

// Could be summarized or evicted from context
```

---

## Related Documents

- [Filesystem Tools](./filesystem-tools.md)
- [Change Tools](./change-tools.md)
- [Executor](./executor.md)
