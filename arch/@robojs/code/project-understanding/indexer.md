# Project Indexer

> **For AI Agents**: Read this when working with project file listings or debugging fingerprint changes.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/project/indexer.ts`

## Purpose

Fast file listing with content-based fingerprinting for drift detection. Caps prevent OOM on large projects.

## ProjectIndex Structure

```typescript
{
  updatedAt: string,
  root: string,
  fingerprint: string,  // 16-char hex hash
  files: Array<{ path: string, size: number }>,
  dirs: Array<{ path: string }>,
  robo?: RoboIndexSignals
}
```

## Caps

```typescript
{
  maxFiles: 10_000,
  maxDirs: 5_000,
  largeFileThreshold: 262_144  // 256KB
}
```

## Fingerprinting

- Small files (≤256KB): Full content hash (djb2 + FNV-1a)
- Large files (>256KB): Size + mtime only
- Stable: Files sorted by path before hashing

## API

```typescript
async needsRefresh(): Promise<boolean>
async refresh(options?: { deep?: boolean, force?: boolean }): Promise<ProjectIndex>
```

## Related

- [Fingerprint](../types/robo.md)
- [refresh_index node](../orchestration/state-machine.md#refresh_index)
