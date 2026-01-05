# Execution Layer

> **For AI Agents**: Read this when working on filesystem operations, terminal execution, or WebContainer integration. This layer provides the runtime foundation for all code agent operations.

## Overview

The execution layer abstracts filesystem and terminal operations across different environments (browser WebContainer vs Node.js). It provides service discovery for local servers, terminal output buffering, and path validation security.

**Key Files:**
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/types/execution.ts` - ExecutionProvider interface
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/providers/webcontainer/WebContainerProvider.ts` - Browser implementation
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/providers/node/NodeProvider.ts` - Node.js implementation

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXECUTION LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         ExecutionProvider Interface                       │  │
│  │  (filesystem + terminal + service discovery)             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│              ┌─────────────┴─────────────┐                      │
│              ▼                           ▼                      │
│  ┌─────────────────────┐     ┌──────────────────────┐          │
│  │ WebContainerProvider│     │   NodeProvider       │          │
│  │   (Browser/Primary) │     │ (Node.js/Secondary)  │          │
│  └─────────────────────┘     └──────────────────────┘          │
│              │                           │                       │
│              ▼                           ▼                      │
│  ┌─────────────────────┐     ┌──────────────────────┐          │
│  │  @webcontainer/api  │     │  fs/promises +       │          │
│  │  (StackBlitz)       │     │  child_process       │          │
│  └─────────────────────┘     └──────────────────────┘          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          Shared Utilities                                 │  │
│  │  • TerminalBuffer (drop-oldest, 5MB cap)                 │  │
│  │  • Path validation (traversal prevention)                │  │
│  │  • Service discovery (URL resolution for local servers)  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. ExecutionProvider Interface
The contract all providers must implement.

**Read:** [providers.md](./providers.md)

### 2. Service Discovery
URL resolution for local dev/mock/MCP servers in WebContainer.

**Read:** [service-discovery.md](./service-discovery.md)

### 3. Terminal Buffering
Output management with bounded memory and truncation.

**Read:** [terminal-buffering.md](./terminal-buffering.md)

### 4. Path Validation
Security layer preventing traversal attacks and enforcing deny paths.

**Read:** [path-validation.md](./path-validation.md)

---

## Key Interfaces

### ExecutionProvider

```typescript
interface ExecutionProvider {
  // File operations
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  deletePath(path: string, opts?: { recursive?: boolean }): Promise<void>
  exists(path: string): Promise<boolean>
  readdir(path: string, opts?: { recursive?: boolean }): Promise<DirEntry[]>
  mkdir(path: string, opts?: { recursive?: boolean }): Promise<void>
  stat(path: string): Promise<FileStat>
  search(pattern: string, opts?: SearchOptions): Promise<SearchResult[]>
  snapshot(opts?: SnapshotOptions): Promise<Record<string, string>>

  // Command execution (no shell interpolation by default)
  run(command: string, args: string[], opts?: RunOptions): Promise<RunResult>
  runStream(command: string, args: string[], opts?: RunOptions): AsyncIterable<TerminalChunk>

  // Long-running sessions
  startSession(command: string, args: string[], opts?: RunOptions): Promise<TerminalSessionHandle>
  stopSession(handle: TerminalSessionHandle): Promise<void>
  streamSession(handle: TerminalSessionHandle): AsyncIterable<TerminalChunk>
}
```

### LocalServiceDiscovery

```typescript
interface LocalServiceDiscovery {
  start(serviceId: string, options: ServiceStartOptions): Promise<void>
  waitForUrl(serviceId: string, timeout?: number): Promise<string>
  stop(serviceId: string): Promise<void>
  isRunning(serviceId: string): boolean
  getUrl(serviceId: string): string | undefined
}
```

---

## Provider Comparison

| Feature | WebContainer | Node |
|---------|--------------|------|
| **Environment** | Browser | Node.js/CI |
| **Filesystem** | In-memory | Real filesystem |
| **stdout/stderr** | Combined | Separated |
| **Process spawn** | WebContainer API | child_process |
| **URL discovery** | server-ready events | Not needed (localhost) |
| **Primary use** | Production UI | Testing/CI |

---

## Usage Patterns

### Creating a Provider

**WebContainer:**
```typescript
import { WebContainerProvider } from '@robojs/code/providers/webcontainer'

const provider = new WebContainerProvider({
  container: webContainerInstance,
  rootDir: '/project'
})
```

**Node:**
```typescript
import { NodeProvider } from '@robojs/code/providers/node'

const provider = new NodeProvider({
  rootDir: '/absolute/path/to/project'
})
```

### Running Commands

```typescript
// One-shot execution
const result = await provider.run('npm', ['install'], { cwd: '/project' })

// Streaming execution
for await (const chunk of provider.runStream('npm', ['test'])) {
  console.log(chunk.data)
}

// Long-running session
const session = await provider.startSession('npm', ['run', 'dev'])
for await (const chunk of provider.streamSession(session)) {
  console.log(chunk.data)
}
await provider.stopSession(session)
```

---

## Related Documents

- [Orchestration Layer](../orchestration/README.md) - How agents use execution providers
- [Tool System](../tools/README.md) - Tools built on top of execution layer
- [Testing Patterns](../testing/README.md) - Mocking execution providers
