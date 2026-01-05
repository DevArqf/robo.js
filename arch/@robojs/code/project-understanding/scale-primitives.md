# Scale Primitives

> **For AI Agents**: Read this when optimizing for large projects or understanding cap enforcement.

## Caps

### Index Caps

```typescript
{
  maxFiles: 10_000,
  maxDirs: 5_000,
  largeFileThreshold: 262_144  // 256KB
}
```

### Overview Caps

```typescript
{
  maxCommands: 100,
  maxEvents: 100,
  maxApiRoutes: 100,
  maxKeyFiles: 20,
  maxDecisions: 100,
  maxChangeLogEntries: 200
}
```

## Large File Strategy

- `fs_stat` - Check size (lightweight)
- `fs_read_head` - Preview first N lines
- `fs_outline` - Structure without content
- `fs_read_range` - Specific sections

## Fingerprinting

- **≤256KB:** Full content hash (comprehensive)
- **>256KB:** Size + mtime (efficient)

## Related

- [Indexer](./indexer.md)
- [Overview](./overview.md)
- [Filesystem Tools](../tools/filesystem-tools.md)
