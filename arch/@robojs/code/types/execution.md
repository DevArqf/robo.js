# Execution Types

> **For AI Agents**: Reference for ExecutionProvider and related types.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/types/execution.ts`

## ExecutionProvider

Complete interface in [execution/providers.md](../execution/providers.md)

## Supporting Types

```typescript
interface DirEntry {
  name: string
  path: string
  type: 'file' | 'directory'
}

interface FileStat {
  size: number
  mtimeMs: number
  isDirectory: boolean
}

interface RunOptions {
  cwd?: string
  env?: Record<string, string>
  timeout?: number
  signal?: AbortSignal
}

interface RunResult {
  stdout: string
  stderr: string
  exitCode: number
}

interface TerminalSessionHandle {
  sessionId: string
  kind: 'webcontainer' | 'node'
}

type TerminalChunk =
  | { type: 'data'; sessionId: string; data: string; stream?: 'stdout' | 'stderr' | 'combined' }
  | { type: 'exit'; sessionId: string; exitCode: number }
```

## Related

- [Providers](../execution/providers.md)
