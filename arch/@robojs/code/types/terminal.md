# Terminal Types

> **For AI Agents**: Reference for terminal and execution result types used by the ExecutionProvider.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/types/terminal.ts`

## Overview

These types define the structure for terminal operations including command execution, session management, and filesystem operations.

---

## Command Execution

### RunOptions

Options for running commands.

```typescript
interface RunOptions {
  cwd?: string                    // Working directory
  env?: Record<string, string>    // Environment variables
  timeout?: number                // Timeout in milliseconds
  signal?: AbortSignal            // Abort signal for cancellation
}
```

### RunResult

Result from a one-shot command execution.

```typescript
interface RunResult {
  exitCode: number                // Process exit code
  output: string                  // Combined output (always present)
  stdout?: string                 // Separate stdout (Node-only)
  stderr?: string                 // Separate stderr (Node-only)
}
```

---

## Session Management

### TerminalChunk

A chunk of terminal output from streaming commands or sessions.

```typescript
interface TerminalChunk {
  type: 'output' | 'exit'         // Chunk type
  stream?: 'stdout' | 'stderr' | 'combined'  // WebContainer typically combined
  text?: string                   // Output text (when type='output')
  exitCode?: number               // Exit code (when type='exit')
}
```

### TerminalSessionHandle

Handle to a long-running terminal session.

```typescript
interface TerminalSessionHandle {
  id: string                      // Session identifier
  pid?: number                    // Process ID (if available)
}
```

---

## Filesystem Types

### FileStat

File stat result for scale-friendly operations.

```typescript
interface FileStat {
  size: number                    // File size in bytes
  mtimeMs?: number                // Modification time in milliseconds
  isDirectory?: boolean           // Whether path is a directory
}
```

### DirEntry

Directory entry from readdir operations.

```typescript
interface DirEntry {
  name: string                    // Entry name
  path: string                    // Full path
  isDirectory: boolean            // Whether entry is a directory
  isFile: boolean                 // Whether entry is a file
}
```

---

## Search Types

### SearchOptions

Options for search operations.

```typescript
interface SearchOptions {
  path?: string                   // Base path to search in
  glob?: string                   // Glob pattern to filter files
  maxResults?: number             // Maximum number of results
  includeContent?: boolean        // Whether to include match content
}
```

### SearchResult

Result from a search operation.

```typescript
interface SearchResult {
  path: string                    // File path
  matches?: Array<{               // Match details
    line: number                  // Line number
    column: number                // Column number
    text: string                  // Matched text
  }>
}
```

---

## Snapshot and Service Types

### SnapshotOptions

Options for snapshot operations.

```typescript
interface SnapshotOptions {
  paths?: string[]                // Paths to include
  maxBytes?: number               // Maximum total size
  excludePatterns?: string[]      // Patterns to exclude
}
```

### ServiceStartOptions

Options for starting a service.

```typescript
interface ServiceStartOptions {
  port?: number                   // Expected port for URL resolution
  env?: Record<string, string>    // Environment variables
  cwd?: string                    // Working directory
  timeout?: number                // Startup timeout in milliseconds
}
```

---

## Related Documents

- [Providers](../execution/providers.md) - ExecutionProvider implementation
- [Terminal Buffering](../execution/terminal-buffering.md) - Buffer management for sessions
- [Terminal Tools](../tools/terminal-tools.md) - Tools that use these types
