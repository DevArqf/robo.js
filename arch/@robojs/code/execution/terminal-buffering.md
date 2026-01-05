# Terminal Buffering

> **For AI Agents**: Read this when working with terminal sessions, debugging output truncation, or understanding memory management for long-running processes.

## Overview

Terminal buffering prevents out-of-memory errors from unbounded output by implementing a drop-oldest circular buffer with truncation events. Critical for long-running dev servers and CI processes.

**Key Files:**
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/providers/utils/buffer.ts` - Buffer implementation
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/types/terminal.ts` - Types

---

## The Problem

Long-running processes produce unbounded output:

```typescript
// Dev server running for hours
$ npm run dev
> Compiled successfully
> Compiled successfully
> Compiled successfully
... (millions of lines)
```

Without buffering:
- Browser memory exhausted
- UI becomes unresponsive
- Application crashes

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    TERMINAL BUFFERING                           │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Process Output → TerminalBuffer → Drop Oldest → Emit Event   │
│                         │                                       │
│                         ├─ totalProcessed (lifetime stats)     │
│                         ├─ totalDropped (truncation stats)     │
│                         └─ buffer (bounded, circular)          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  TerminalBufferManager                                   │  │
│  │  ├─ session-1 → TerminalBuffer (5MB)                     │  │
│  │  ├─ session-2 → TerminalBuffer (5MB)                     │  │
│  │  └─ session-3 → TerminalBuffer (5MB)                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## TerminalBuffer

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/providers/utils/buffer.ts`

### Purpose

Bounded circular buffer with drop-oldest truncation and event emission.

### Configuration

```typescript
interface TerminalBufferConfig {
  maxBytes: number              // Buffer size limit (default: 5MB)
  sessionId: string             // Session identifier
  onTruncate?: TruncationCallback  // Called when data dropped
}

type TruncationCallback = (event: TruncationEvent) => void

interface TruncationEvent {
  type: 'terminal_truncated'    // Event type discriminator
  sessionId: string
  droppedBytes: number          // Bytes removed this truncation
  totalDropped: number          // Cumulative dropped bytes
  timestamp: number             // When truncation occurred
}
```

### Implementation

```typescript
class TerminalBuffer {
  private buffer: string[] = []  // ← Array of chunks, not single string
  private currentBytes: number = 0
  private maxBytes: number
  private totalProcessed: number = 0
  private totalDropped: number = 0
  private sessionId: string
  private onTruncate?: TruncationCallback

  append(data: string): number {
    if (!data) return 0

    const dataBytes = getByteLength(data)  // TextEncoder for browser compat
    this.totalProcessed += dataBytes

    // If single chunk exceeds max, keep only last maxBytes worth
    if (dataBytes >= this.maxBytes) {
      const dropped = this.currentBytes + (dataBytes - this.maxBytes)
      this.buffer = [data.slice(-this.maxBytes)]
      this.currentBytes = this.maxBytes
      this.totalDropped += dropped

      if (dropped > 0) {
        this.emitTruncation(dropped)
      }

      return dropped
    }

    // Append chunk to array
    this.buffer.push(data)
    this.currentBytes += dataBytes

    // Truncate oldest chunks if needed
    if (this.currentBytes > this.maxBytes) {
      return this.truncate()
    }

    return 0
  }

  private truncate(): number {
    let droppedBytes = 0

    // Remove oldest chunks until under limit
    while (this.currentBytes > this.maxBytes && this.buffer.length > 1) {
      const oldest = this.buffer.shift()  // Remove whole chunks
      if (oldest) {
        const bytes = getByteLength(oldest)
        this.currentBytes -= bytes
        droppedBytes += bytes
      }
    }

    // If only one chunk remains and still too big, trim it
    if (this.buffer.length === 1 && this.currentBytes > this.maxBytes) {
      const excess = this.currentBytes - this.maxBytes
      this.buffer[0] = this.buffer[0].slice(excess)
      this.currentBytes = this.maxBytes
      droppedBytes += excess
    }

    if (droppedBytes > 0) {
      this.totalDropped += droppedBytes
      this.emitTruncation(droppedBytes)
    }

    return droppedBytes
  }

  private emitTruncation(droppedBytes: number): void {
    if (this.onTruncate) {
      this.onTruncate({
        type: 'terminal_truncated',
        sessionId: this.sessionId,
        droppedBytes,
        totalDropped: this.totalDropped,
        timestamp: Date.now()
      })
    }
  }

  getContent(): string {
    return this.buffer.join('')  // Join array chunks
  }

  getCurrentBytes(): number {
    return this.currentBytes
  }

  getTotalProcessed(): number {
    return this.totalProcessed
  }

  getTotalDropped(): number {
    return this.totalDropped
  }

  wasTruncated(): boolean {
    return this.totalDropped > 0
  }

  clear(): void {
    this.buffer = []
    this.currentBytes = 0
    // Note: Lifetime stats (totalDropped/totalProcessed) not reset
  }

  getStats(): TerminalBufferStats {
    return {
      currentBytes: this.currentBytes,
      maxBytes: this.maxBytes,
      totalProcessed: this.totalProcessed,
      totalDropped: this.totalDropped,
      chunkCount: this.buffer.length,
      wasTruncated: this.totalDropped > 0,
      utilizationPercent: (this.currentBytes / this.maxBytes) * 100
    }
  }
}

interface TerminalBufferStats {
  currentBytes: number
  maxBytes: number
  totalProcessed: number
  totalDropped: number
  chunkCount: number
  wasTruncated: boolean
  utilizationPercent: number
}

// Browser-compatible byte length calculation
function getByteLength(str: string): number {
  return new TextEncoder().encode(str).length
}
```

**Key Implementation Details:**
- **Chunk-based storage**: Array of strings for efficient shift() operations
- **Dual truncation**: Whole chunks removed via shift(), last chunk trimmed via slice()
- **Browser-compatible**: Uses TextEncoder().encode() for byte counting (not Node.js Buffer)
- **Lifetime stats**: totalProcessed and totalDropped never reset (persist across clear())
```

---

## TerminalBufferManager

**Purpose:** Manages multiple buffers (one per session)

### API

```typescript
class TerminalBufferManager {
  constructor(
    defaultMaxBytes: number = 5_000_000,  // Per-session limit (default 5MB)
    onTruncate?: TruncationCallback
  )

  getOrCreate(sessionId: string, maxBytes?: number): TerminalBuffer
  get(sessionId: string): TerminalBuffer | undefined
  remove(sessionId: string): void
  getSessionIds(): string[]
  getAggregateStats(): AggregateBufferStats
}
```

### Aggregate Stats

```typescript
interface AggregateBufferStats {
  sessionCount: number          // Number of active sessions
  totalCurrentBytes: number     // Sum of all buffer sizes
  totalMaxBytes: number         // Sum of all max limits
  totalProcessed: number        // Sum across all sessions
  totalDropped: number          // Sum of all truncations
  truncatedCount: number        // Number of sessions that have truncated
}
```

---

## Truncation Strategy

### Drop-Oldest (FIFO)

When buffer exceeds limit, remove oldest data:

```
Before truncation (6MB):
[===OLDEST DATA===][====MIDDLE DATA====][===NEWEST DATA===]
 └── 1MB to drop ──┘

After truncation (5MB):
                   [====MIDDLE DATA====][===NEWEST DATA===]
```

### Why Drop-Oldest?

**Alternatives considered:**
1. **Drop-newest**: Loses recent data (bad for debugging)
2. **Reject new data**: Stops capturing output (bad for monitoring)
3. **Compress old data**: CPU overhead, complexity
4. **Drop-oldest**: ✅ Keeps recent data, handles unbounded output

---

## Event Emission

### Truncation Events

Emitted every time buffer drops data:

```typescript
{
  type: 'terminal_truncated',
  sessionId: 'session-123',
  droppedBytes: 1048576,          // 1MB dropped this time
  totalDropped: 5242880,          // 5MB dropped lifetime
  timestamp: 1704394820000        // When truncation occurred
}
```

### Usage in UI

```typescript
for await (const event of agent.stream(runId)) {
  if (event.type === 'terminal_truncated') {
    console.warn(
      `Terminal output truncated for ${event.sessionId}:`,
      `${(event.droppedBytes / 1024 / 1024).toFixed(1)}MB dropped,`,
      `${(event.totalDropped / 1024 / 1024).toFixed(1)}MB total`
    )

    // Show warning in UI
    showNotification({
      type: 'warning',
      message: 'Terminal output truncated due to size limit'
    })
  }
}
```

---

## Polling for New Content

### streamSession Pattern

Providers poll buffer for new content using position tracking:

```typescript
async *streamSession(handle: TerminalSessionHandle): AsyncIterable<TerminalChunk> {
  const buffer = this.bufferManager.getOrCreate(handle.sessionId)
  let lastLength = 0
  let lastTotalProcessed = buffer.getStats().totalProcessed

  while (true) {
    const content = buffer.getContent()
    const stats = buffer.getStats()

    // Check for new content
    if (content.length > lastLength) {
      yield {
        type: 'output',
        stream: 'combined',
        text: content.slice(lastLength)
      }
      lastLength = content.length
      lastTotalProcessed = stats.totalProcessed
    } else if (stats.totalProcessed > lastTotalProcessed) {
      // Buffer was truncated - get approximate new content
      const processedDelta = stats.totalProcessed - lastTotalProcessed
      const approxChars = Math.min(content.length, processedDelta)
      if (approxChars > 0) {
        yield {
          type: 'output',
          stream: 'combined',
          text: content.slice(-approxChars)
        }
      }
      lastLength = content.length
      lastTotalProcessed = stats.totalProcessed
    }

    // Check if process exited
    const session = this.sessions.get(handle.sessionId)
    if (session?.exitCode !== undefined) {
      yield { type: 'exit', exitCode: session.exitCode }
      break
    }

    // Small delay to avoid tight loop
    await new Promise(resolve => setTimeout(resolve, 50))
  }
}
```

---

## Configuration

### Default Policy

```typescript
const DEFAULT_POLICY: AgentPolicy = {
  maxBufferedTerminalBytes: 5_000_000  // 5MB per session
}
```

### Custom Limits

```typescript
const provider = new WebContainerProvider({
  container,
  rootDir: '/project'
})

const bufferManager = new TerminalBufferManager({
  maxBytesPerBuffer: 10_000_000,  // 10MB per session
  onTruncate: (event) => {
    console.log('Truncated:', event.droppedBytes)
  }
})
```

---

## Buffer Statistics

### Per-Session Stats

```typescript
const buffer = bufferManager.getOrCreate('session-123')
const stats = buffer.getStats()

console.log({
  currentBytes: stats.currentBytes,            // Current buffer size
  maxBytes: stats.maxBytes,                    // Limit
  totalProcessed: stats.totalProcessed,        // Lifetime input
  totalDropped: stats.totalDropped,            // Lifetime truncation
  chunkCount: stats.chunkCount,                // Number of chunks in buffer
  wasTruncated: stats.wasTruncated,            // Has any truncation occurred
  utilizationPercent: stats.utilizationPercent // Buffer usage percentage
})
```

### Aggregate Stats

```typescript
const stats = bufferManager.getAggregateStats()

console.log({
  sessionCount: stats.sessionCount,            // Number of active sessions
  totalCurrentBytes: stats.totalCurrentBytes,  // Sum of all buffers
  totalMaxBytes: stats.totalMaxBytes,          // Sum of all limits
  totalProcessed: stats.totalProcessed,        // All sessions
  totalDropped: stats.totalDropped,            // All sessions
  truncatedCount: stats.truncatedCount         // Sessions that truncated
})
```

---

## Best Practices

### 1. Monitor Truncation Events

Always handle `terminal_truncated` events in UI:
```typescript
if (event.type === 'terminal_truncated') {
  showWarning('Output truncated - increase buffer size or reduce verbosity')
}
```

### 2. Adjust Buffer Size for Use Case

| Use Case | Recommended Buffer Size |
|----------|------------------------|
| Quick commands (npm install) | 1MB |
| Test suites | 2-5MB |
| Dev servers | 5-10MB |
| Continuous logs | 10-20MB |

### 3. Clean Up Sessions

```typescript
// Always stop sessions when done
await provider.stopSession(session)
bufferManager.removeBuffer(session.sessionId)
```

### 4. Handle Verbosity

Reduce noise in long-running processes:
```typescript
// Set minimal log level
const session = await provider.startSession('npm', ['run', 'dev'], {
  env: {
    NODE_ENV: 'production',  // Less verbose
    CI: 'true'                // Suppress interactive prompts
  }
})
```

---

## Related Documents

- [Providers](./providers.md) - How providers use buffers
- [Terminal Tools](../tools/terminal-tools.md) - Tools that create sessions
- [Event Streaming](../orchestration/event-streaming.md) - terminal_truncated events
- [Policy](../tools/policy.md) - maxBufferedTerminalBytes configuration
