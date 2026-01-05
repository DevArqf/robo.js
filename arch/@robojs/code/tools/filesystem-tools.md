# Filesystem Tools

> **For AI Agents**: Reference for all 13 filesystem tools - arguments, behavior, limits, and use cases.

## Tool Catalog

### Core Operations

**1. fs_read** - Read single file
- **Args:** `{ path: string }`
- **Returns:** File content (string)
- **Limit:** Truncates at 64KB by default
- **Tracks:** Records snapshot for stale detection
- **File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/fs/read.ts`

**2. fs_read_many** - Read multiple files
- **Args:** `{ paths: string[] }`
- **Returns:** `Record<string, string | null>` (null if file doesn't exist)
- **Limit:** 64KB per file
- **Tracks:** Records all snapshots
- **File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/fs/read-many.ts`

**3. fs_write** - Write/overwrite file
- **Args:** `{ path: string, content: string }`
- **Returns:** Success confirmation
- **Limit:** 512KB per file
- **Checks:** Staleness before writing
- **Clears:** File tracker after write
- **File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/fs/write.ts`

**4. fs_delete** - Delete file or directory
- **Args:** `{ path: string, recursive?: boolean }`
- **Returns:** Success confirmation
- **Checks:** Deny paths
- **Clears:** File tracker after delete
- **File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/fs/delete.ts`

**5. fs_list** - List directory
- **Args:** `{ path: string, recursive?: boolean }`
- **Returns:** `DirEntry[]` with names, types, paths
- **Limit:** No hard limit (use with caution on large dirs)
- **File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/fs/list.ts`

**6. fs_search** - Search by pattern
- **Args:** `{ pattern: string, path?: string, glob?: string, maxResults?: number (default: 100) }`
- **Returns:** `SearchResult[]` with file, line, column, content
- **Limit:** Default 100 results
- **File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/fs/search.ts`

**7. fs_snapshot** - Get project snapshot
- **Args:** `{ glob?: string, exclude?: string[], maxFileSize?: number }`
- **Returns:** `Record<string, string>` (path → content)
- **Limit:** 2MB total
- **Respects:** Deny paths automatically excluded
- **File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/fs/snapshot.ts`

### Scale Primitives

**8. fs_stat** - Get file metadata
- **Args:** `{ path: string }`
- **Returns:** `{ size: number, mtimeMs: number, isDirectory: boolean }`
- **Use:** Check size before reading large files
- **File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/fs/stat.ts`

**9. fs_read_range** - Read byte range
- **Args:** `{ path: string, start: number, end: number }`
- **Returns:** Partial content
- **Use:** Read specific sections of large files
- **File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/fs/read-range.ts`

**10. fs_read_head** - Read beginning
- **Args:** `{ path: string, maxBytes?: number (default: 32768) }`
- **Returns:** First N bytes
- **Use:** Preview large files
- **File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/fs/read-head.ts`

**11. fs_read_tail** - Read end
- **Args:** `{ path: string, maxBytes?: number (default: 32768) }`
- **Returns:** Last N bytes
- **Use:** Check recent logs
- **File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/fs/read-tail.ts`

**12. fs_grep** - Search within files
- **Args:** `{ pattern: string, path?: string, glob?: string, maxResults?: number (default: 50), contextLines?: number (default: 0), ignoreCase?: boolean (default: false) }`
- **Returns:** `{ pattern, matches: GrepMatch[], fileCount, matchCount, truncated }` with surrounding context
- **Use:** Find code patterns with context lines before/after matches
- **File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/fs/grep.ts`

**13. fs_outline** - Get code structure
- **Args:** `{ path: string, depth?: number }`
- **Returns:** Symbols (functions, classes, exports)
- **Use:** Quick structure understanding without full content
- **File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/fs/outline.ts`

---

## When to Use Each Tool

| Goal | Recommended Tool | Why |
|------|------------------|-----|
| Read one file | `fs_read` | Simple, tracks snapshot |
| Read 2-5 files | `fs_read_many` | More efficient than multiple fs_read |
| Read many files | `fs_snapshot` | Single operation, respects limits |
| Check file size | `fs_stat` | Lightweight, no content transfer |
| Large file preview | `fs_read_head` + `fs_stat` | Bounded, shows beginning |
| Search project | `fs_search` | Indexed, fast, bounded results |
| Find with context | `fs_grep` | Shows surrounding lines |
| Quick structure | `fs_outline` | Symbols only, no full parse |
| Modify files | `apply_changes` | Atomic, approval flow, diffs |

---

## Common Patterns

### Pattern: Safely Read Large File

```typescript
// 1. Check size first
const stat = await execute({ name: 'fs_stat', args: { path: '/large.log' } })

if (stat.data.size > 1_000_000) {
  // 2. Read head only
  const preview = await execute({
    name: 'fs_read_head',
    args: { path: '/large.log', lines: 100 }
  })
} else {
  // 3. Read full file
  const content = await execute({ name: 'fs_read', args: { path: '/large.log' } })
}
```

### Pattern: Search Then Read

```typescript
// 1. Find files containing pattern
const results = await execute({
  name: 'fs_search',
  args: { pattern: 'export function', glob: '**/*.ts' }
})

// 2. Read relevant files
const paths = [...new Set(results.data.map(r => r.file))]
const contents = await execute({
  name: 'fs_read_many',
  args: { paths }
})
```

---

## Related Documents

- [Tool Executor](./executor.md)
- [Stale Detection](./stale-detection.md)
- [Change Tools](./change-tools.md)
- [Policy](./policy.md)
