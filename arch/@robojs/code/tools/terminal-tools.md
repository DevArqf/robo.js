# Terminal Tools

> **For AI Agents**: Reference for all 5 terminal tools - one-shot vs session patterns, when to use each.

## Tool Catalog

### One-Shot Execution

**1. terminal_run** - Execute and wait
- **Args:** `{ command: string, args: string[], cwd?: string, env?: Record<string, string>, timeout?: number }`
- **Returns:** `{ stdout: string, stderr: string, exitCode: number, success: boolean }`
- **Timeout:** 120s default
- **Use:** Quick commands (npm install, git status)
- **File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/terminal/run.ts`

**2. terminal_run_stream** - Execute with streaming
- **Args:** Same as terminal_run
- **Returns:** Stream of TerminalChunk (data + exit)
- **Use:** Commands with progress output (npm test, build)
- **File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/terminal/run-stream.ts`

### Session Management

**3. terminal_session_start** - Start persistent process
- **Args:** `{ command: string, args: string[], cwd?: string, env?: Record<string, string> }`
- **Returns:** `{ sessionId: string }`
- **Use:** Dev servers, mock servers, watch mode
- **Registers:** Session with agent for abort cleanup
- **File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/terminal/session-start.ts`

**4. terminal_session_stream** - Poll for output
- **Args:** `{ sessionId: string, maxChunks?: number (default: 100), timeout?: number (default: 5000) }`
- **Returns:** `{ sessionId, output, chunkCount, exited, exitCode? }`
- **Use:** Monitor running session with configurable chunk limits and polling timeout
- **File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/terminal/session-stream.ts`

**5. terminal_session_stop** - Stop process
- **Args:** `{ sessionId: string }`
- **Returns:** Exit code
- **Unregisters:** Session from agent tracking
- **File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/terminal/session-stop.ts`

---

## One-Shot vs Session

| Feature | One-Shot | Session |
|---------|----------|---------|
| **Lifetime** | Until command completes | Until explicitly stopped |
| **Output** | Buffered, returned at end | Streamed continuously |
| **Abort** | Via timeout | Via session_stop |
| **Use Case** | Build, install, test | Dev server, watch mode |
| **Cleanup** | Automatic | Must call stop |

---

## Usage Patterns

### Pattern: Quick Command

```typescript
const result = await execute({
  name: 'terminal_run',
  args: {
    command: 'npm',
    args: ['install', 'react'],
    cwd: '/project'
  }
})

if (!result.data.success) {
  console.error('Install failed:', result.data.stderr)
}
```

### Pattern: Dev Server

```typescript
// 1. Start session
const startResult = await execute({
  name: 'terminal_session_start',
  args: {
    command: 'npm',
    args: ['run', 'dev'],
    env: { PORT: '3000' }
  }
})

const sessionId = startResult.data.sessionId

// 2. Wait for readiness (via service discovery)
const url = await serviceDiscovery.waitForUrl('dev')

// 3. Use server
await fetch(url + '/api/health')

// 4. Stop when done
await execute({
  name: 'terminal_session_stop',
  args: { sessionId }
})
```

---

## Command Policy Enforcement

All terminal tools check policy before execution:

```typescript
const check = context.policy.checkCommand(command, args)

if (!check.allowed) {
  if (check.canApprove) {
    return approvalRequired([], [], check.reason, { command, args })
  } else {
    throw commandDeniedError(command, args, check.reason)
  }
}
```

---

## Related Documents

- [Execution Providers](../execution/providers.md)
- [Service Discovery](../execution/service-discovery.md)
- [Terminal Buffering](../execution/terminal-buffering.md)
- [Policy](./policy.md)
