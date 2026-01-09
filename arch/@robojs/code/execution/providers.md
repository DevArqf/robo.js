# Execution Providers

> **For AI Agents**: Read this when implementing new providers, understanding filesystem operations, or debugging command execution issues.

## Overview

Execution providers abstract filesystem and terminal operations across different runtime environments. The SDK supports two providers: WebContainerProvider (browser) and NodeProvider (Node.js/CI).

---

## WebContainerProvider

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/providers/webcontainer/WebContainerProvider.ts`

### Purpose

Primary provider for browser-based execution using StackBlitz WebContainer. Enables in-browser filesystem and terminal access without server-side execution.

### Constructor

```typescript
new WebContainerProvider({
  container: WebContainer,      // Booted WebContainer instance
  rootDir: string,              // Project root (e.g., '/project')
  denyPaths?: string[]          // Paths to block
})
```

### Key Features

**Filesystem Operations:**
- Full POSIX-like filesystem via WebContainer API
- Path normalization (virtual → absolute container paths)
- Parent directory creation on write
- Recursive directory operations

**Terminal Execution:**
- Combined stdout/stderr (WebContainer API limitation)
- Process spawning via `container.spawn()`
- Stream output via `process.output.pipeTo()`
- Exit code tracking via `process.exit` promise

**Service Discovery:**
- Integrates with `WebContainerServiceDiscovery`
- Listens for `server-ready` events
- Resolves WebContainer external URLs (https://xxx.webcontainer.io)
- Supports concurrent services (dev/mock/mcp)

### Limitations

1. **Combined Output Streams**
   - stdout and stderr are merged
   - Cannot distinguish error vs info messages
   - Workaround: Parse content for error patterns

2. **No stdio Transport**
   - Cannot use stdio-based MCP servers
   - Must use HTTP/SSE transports instead

3. **URL Discovery Required**
   - Cannot use `localhost:PORT` or `127.0.0.1:PORT`
   - Must wait for WebContainer `server-ready` events
   - URLs are externally routable (not localhost)

4. **Process Management**
   - No PID access for fine-grained control
   - Kill via returned process object only

### Implementation Details

**File Operations:**
```typescript
async readFile(path: string): Promise<string> {
  const absPath = this.toAbsolutePath(path)
  validatePath(absPath, this.denyPaths)
  return await this.container.fs.readFile(absPath, 'utf-8')
}

async writeFile(path: string, content: string): Promise<void> {
  const absPath = this.toAbsolutePath(path)
  validatePath(absPath, this.denyPaths)

  // Ensure parent directory exists
  const dir = absPath.substring(0, absPath.lastIndexOf('/'))
  if (dir && dir !== '/') {
    await this.container.fs.mkdir(dir, { recursive: true }).catch(() => {})
  }

  await this.container.fs.writeFile(absPath, content)
}
```

**Terminal Sessions:**
```typescript
async startSession(
  command: string,
  args: string[],
  opts?: RunOptions
): Promise<TerminalSessionHandle> {
  const cwd = opts?.cwd ? this.toAbsolutePath(opts.cwd) : this.rootDir
  const process = await this.container.spawn(command, args, { cwd, env: opts?.env })

  const sessionId = `session-${Date.now()}-${Math.random()}`
  const buffer = this.bufferManager.getBuffer(sessionId)

  // Pipe output to buffer
  process.output.pipeTo(new WritableStream({
    write: (data) => buffer.append(data)
  }))

  // Track exit
  const exitPromise = process.exit

  this.sessions.set(sessionId, { process, exitPromise, buffer })

  return { sessionId, kind: 'webcontainer' }
}
```

### Additional Methods

Beyond the `ExecutionProvider` interface, WebContainerProvider has additional utility methods:

```typescript
// Stop all active terminal sessions
stopAllSessions(): Promise<void>

// Get count of active sessions (for monitoring)
getActiveSessionCount(): number
```

---

## NodeProvider

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/providers/node/NodeProvider.ts`

### Purpose

Secondary provider for Node.js environments and CI testing. Uses real filesystem and child_process for command execution.

### Constructor

```typescript
new NodeProvider({
  rootDir: string,              // Absolute path to project
  denyPaths?: string[]          // Paths to block
})
```

### Key Features

**Filesystem Operations:**
- Direct filesystem access via `fs/promises`
- Real file operations (not in-memory)
- Standard Node.js semantics

**Terminal Execution:**
- Separate stdout/stderr streams (better than WebContainer)
- Uses `child_process.spawn()`
- Better process control (PIDs, signals)
- Standard Node.js process semantics

### Advantages Over WebContainer

1. **Separated Output Streams**
   ```typescript
   const result = await provider.run('npm', ['test'])
   console.log('stdout:', result.stdout)
   console.log('stderr:', result.stderr)
   ```

2. **stdio MCP Support** (future)
   - Can spawn stdio-based MCP servers
   - Direct process.stdin/stdout pipes

3. **Real Filesystem**
   - Actual files written to disk
   - Works with native tools expecting real paths

4. **Process Control**
   - Access to PID for signal management
   - Kill via PID or process object

### Implementation Details

**File Operations:**
```typescript
import * as fs from 'fs/promises'
import * as path from 'path'

async readFile(filePath: string): Promise<string> {
  const absPath = path.join(this.rootDir, filePath)
  validatePath(absPath, this.denyPaths)
  return await fs.readFile(absPath, 'utf-8')
}
```

**Terminal Sessions:**
```typescript
import { spawn, ChildProcess } from 'child_process'

async startSession(
  command: string,
  args: string[],
  opts?: RunOptions
): Promise<TerminalSessionHandle> {
  const process = spawn(command, args, {
    cwd: opts?.cwd ? path.join(this.rootDir, opts.cwd) : this.rootDir,
    env: { ...process.env, ...opts?.env },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  const sessionId = `session-${Date.now()}-${Math.random()}`
  const buffer = this.bufferManager.getBuffer(sessionId)

  // Separate stdout/stderr
  process.stdout.on('data', (data) => buffer.append({ stream: 'stdout', data }))
  process.stderr.on('data', (data) => buffer.append({ stream: 'stderr', data }))

  this.sessions.set(sessionId, { process, buffer })

  return { sessionId, kind: 'node' }
}
```

---

## When to Use Each Provider

### Use WebContainerProvider When:
- Building browser-based IDEs/editors
- Sandboxed execution required
- No server-side infrastructure available
- Real-time collaboration needed
- Users shouldn't access real filesystem

### Use NodeProvider When:
- Running in Node.js/CI environments
- Need separated stdout/stderr
- stdio-based MCP servers required
- Testing against real filesystem
- Need full process control (signals, PIDs)

---

## Common Patterns

### Pattern: Safe Path Handling

```typescript
// All providers normalize paths
const absPath = provider.rootDir + '/' + userPath

// Validate before operations
validatePath(absPath, denyPaths) // Throws on '..' traversal

// Read with validation
const content = await provider.readFile(userPath)
```

### Pattern: Command Execution

```typescript
// Execute with array args (no shell interpolation)
const result = await provider.run('npm', ['install', 'react'], {
  cwd: '/src',
  env: { NODE_ENV: 'development' }
})

if (result.exitCode !== 0) {
  console.error('Command failed:', result.stderr || result.stdout)
}
```

### Pattern: Session Management

```typescript
// Start long-running process
const session = await provider.startSession('npm', ['run', 'dev'])

// Stream output in real-time
for await (const chunk of provider.streamSession(session)) {
  if (chunk.type === 'data') {
    console.log(chunk.data)
  } else if (chunk.type === 'exit') {
    console.log('Process exited with code:', chunk.exitCode)
    break
  }
}

// Cleanup
await provider.stopSession(session)
```

---

## Error Handling

### Common Errors

| Error | Cause | Recovery |
|-------|-------|----------|
| `ENOENT` | File not found | Check path, create parent directories |
| `EACCES` | Permission denied | Validate deny paths, check path validity |
| `EEXIST` | File already exists | Use writeFile (overwrites) or check exists() first |
| `PATH_TRAVERSAL` | Invalid path with `..` | Fix path, remove traversal attempts |
| `COMMAND_NOT_FOUND` | Executable not available | Check spelling, ensure installed |

### Path Validation Errors

```typescript
// Throws CodeAgentError with code 'PATH_TRAVERSAL'
validatePath('/project/../../../etc/passwd', [])

// Throws CodeAgentError with code 'POLICY_VIOLATION'
validatePath('/project/.env', ['.env'])
```

---

## Related Documents

- [Service Discovery](./service-discovery.md) - URL resolution for local servers
- [Terminal Buffering](./terminal-buffering.md) - Output management
- [Path Validation](./path-validation.md) - Security and path handling
- [Tool System](../tools/README.md) - Tools built on providers
- [Testing](../testing/mock-provider.md) - Mocking providers for tests
