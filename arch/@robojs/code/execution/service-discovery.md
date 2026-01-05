# Service Discovery

> **For AI Agents**: Read this when working with local MCP servers, dev servers, or mock servers in WebContainer. This explains how to resolve URLs for processes that bind to ports.

## Overview

In WebContainer environments, processes cannot be accessed via `localhost:PORT`. Instead, WebContainer emits `server-ready` events with externally routable URLs. The service discovery system maps these events to service IDs for reliable URL resolution.

**Key File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/providers/webcontainer/WebContainerServiceDiscovery.ts`

---

## The Problem

WebContainer processes that bind ports don't get `localhost` URLs:

```typescript
// ❌ WRONG - Won't work in WebContainer
const url = 'http://localhost:3000'
await fetch(url)  // Fails - not accessible

// ✅ CORRECT - Must wait for WebContainer URL
const url = await serviceDiscovery.waitForUrl('dev')
await fetch(url)  // Works - externally routable
```

WebContainer emits events like:
```
server-ready: { port: 3000, url: 'https://abc123.webcontainer.io' }
```

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│              SERVICE DISCOVERY WORKFLOW                            │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│  1. START SERVICE                                                 │
│     serviceDiscovery.start('mcp', { port: 3001 })                │
│     Maps: port 3001 → serviceId 'mcp'                            │
│                                                                    │
│  2. SPAWN PROCESS                                                 │
│     provider.startSession('node', ['mcp-server.js'])             │
│     Process starts binding to port 3001                           │
│                                                                    │
│  3. LISTEN FOR EVENT                                              │
│     WebContainer emits:                                           │
│     { type: 'server-ready', port: 3001, url: 'https://...' }    │
│                                                                    │
│  4. RESOLVE URL                                                   │
│     Lookup: port 3001 → serviceId 'mcp'                          │
│     Resolve promise: waitForUrl('mcp') → 'https://...'           │
│                                                                    │
│  5. CONNECT TO SERVICE                                            │
│     const client = await connectToMcp(url)                       │
│                                                                    │
└───────────────────────────────────────────────────────────────────┘
```

---

## LocalServiceDiscovery Interface

```typescript
interface LocalServiceDiscovery {
  start(serviceId: string, options: ServiceStartOptions): Promise<{ serviceId: string }>
  waitForUrl(serviceId: string, timeout?: number): Promise<{ url: string }>
  stop(serviceId: string): Promise<void>
  stopAll(): Promise<void>
  isRunning(serviceId: string): boolean
  getUrl(serviceId: string): string | undefined
  getActiveServiceCount(): number
}

interface ServiceStartOptions {
  port?: number         // Expected port for event correlation
  timeout?: number      // Max wait time for URL (default: 30000ms)
}
```

---

## WebContainerServiceDiscovery Implementation

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/providers/webcontainer/WebContainerServiceDiscovery.ts`

### State Management

```typescript
class WebContainerServiceDiscovery {
  private container: WebContainer
  private portToServiceId = new Map<number, string>()
  private serviceToPort = new Map<string, number>()
  private resolvedUrls = new Map<string, string>()
  private pendingPromises = new Map<string, {
    resolve: (url: string) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }>()
}
```

### Event Listener

```typescript
constructor(container: WebContainer) {
  this.container = container

  // Listen for server-ready events
  container.on('server-ready', (port, url) => {
    const serviceId = this.portToServiceId.get(port)

    if (serviceId) {
      this.resolvedUrls.set(serviceId, url)

      const pending = this.pendingPromises.get(serviceId)
      if (pending) {
        clearTimeout(pending.timeout)
        pending.resolve(url)
        this.pendingPromises.delete(serviceId)
      }
    }
  })
}
```

### Methods

**start(serviceId, options)**
```typescript
async start(serviceId: string, options: ServiceStartOptions): Promise<{ serviceId: string }> {
  if (options.port) {
    // Map port → serviceId for event correlation
    this.portToServiceId.set(options.port, serviceId)
    this.serviceToPort.set(serviceId, options.port)
  }
  return { serviceId }
}
```

**waitForUrl(serviceId, timeout)**
```typescript
async waitForUrl(serviceId: string, timeout = 30000): Promise<{ url: string }> {
  // Return immediately if already resolved
  const existing = this.resolvedUrls.get(serviceId)
  if (existing) return { url: existing }

  // Wait for server-ready event
  return new Promise<{ url: string }>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      this.pendingPromises.delete(serviceId)
      reject(new Error(`Service ${serviceId} did not become ready within ${timeout}ms`))
    }, timeout)

    this.pendingPromises.set(serviceId, {
      resolve: (url) => resolve({ url }),
      reject,
      timeout: timeoutId
    })
  })
}
```

**stop(serviceId)**
```typescript
async stop(serviceId: string): Promise<void> {
  // Clean up mappings
  const port = this.serviceToPort.get(serviceId)
  if (port) {
    this.portToServiceId.delete(port)
  }

  this.serviceToPort.delete(serviceId)
  this.resolvedUrls.delete(serviceId)

  // Reject any pending promises
  const pending = this.pendingPromises.get(serviceId)
  if (pending) {
    clearTimeout(pending.timeout)
    pending.reject(new Error(`Service ${serviceId} stopped before URL resolved`))
    this.pendingPromises.delete(serviceId)
  }
}
```

**stopAll()**
```typescript
async stopAll(): Promise<void> {
  // Stop all tracked services
  const serviceIds = Array.from(this.serviceToPort.keys())
  await Promise.all(serviceIds.map(id => this.stop(id)))
}
```

**isRunning(serviceId)**
```typescript
isRunning(serviceId: string): boolean {
  return this.serviceToPort.has(serviceId)
}
```

**getUrl(serviceId)**
```typescript
getUrl(serviceId: string): string | undefined {
  return this.resolvedUrls.get(serviceId)
}
```

**getActiveServiceCount()**
```typescript
getActiveServiceCount(): number {
  return this.serviceToPort.size
}
```

---

## Usage Patterns

### Pattern: Single Service

```typescript
const discovery = new WebContainerServiceDiscovery(container)

// 1. Start service tracking
await discovery.start('dev', { port: 3000 })

// 2. Spawn process
const session = await provider.startSession('npm', ['run', 'dev'], {
  env: { PORT: '3000' }
})

// 3. Wait for URL (blocks until server-ready event)
const { url } = await discovery.waitForUrl('dev', 30000)

// 4. Use URL
console.log('Dev server ready at:', url)

// 5. Cleanup
await discovery.stop('dev')
await provider.stopSession(session)
```

### Pattern: Concurrent Services

```typescript
// Different services on different ports
await discovery.start('dev', { port: 3000 })
await discovery.start('mock', { port: 3001 })
await discovery.start('mcp', { port: 3002 })

// Spawn all processes
const devSession = await provider.startSession('npm', ['run', 'dev'], {
  env: { PORT: '3000' }
})

const mockSession = await provider.startSession('npx', ['robo', 'dev', '--mock', '--port', '3001'])

const mcpSession = await provider.startSession('node', ['mcp-server.js'], {
  env: { PORT: '3002' }
})

// Wait for all URLs (concurrent)
const [{ url: devUrl }, { url: mockUrl }, { url: mcpUrl }] = await Promise.all([
  discovery.waitForUrl('dev'),
  discovery.waitForUrl('mock'),
  discovery.waitForUrl('mcp')
])

// Each URL is correctly attributed to its service
```

### Pattern: Port Collision Handling

```typescript
// If both dev and mock try to use port 3000:
await discovery.start('dev', { port: 3000 })
await discovery.start('mock', { port: 3000 })  // Override mapping - mock wins

// Only the LAST service registered for a port gets the URL
// Recommendation: Use different ports for concurrent services
```

---

## Timeout Handling

### Default Timeout

30 seconds to wait for `server-ready` event. Configurable per service:

```typescript
await discovery.waitForUrl('mcp', 60000)  // 60s for slower services
```

### Timeout Error

```typescript
try {
  const url = await discovery.waitForUrl('mcp', 5000)
} catch (error) {
  // Error: Service mcp did not become ready within 5000ms
  // Possible causes:
  // - Process crashed
  // - Port already in use
  // - Server startup slower than expected
  // - Wrong port configured
}
```

---

## Port Attribution Strategy

### The Challenge

Multiple `server-ready` events may fire. How to know which URL belongs to which service?

### Solution: Port Hints

1. **Expected Port**: Service configuration includes `expectedPort`
2. **Mapping**: `portToServiceId.set(port, serviceId)`
3. **Event Correlation**: When `server-ready` fires with port, look up serviceId
4. **Resolution**: Resolve the promise waiting for that serviceId

### Fallback Strategy

If `expectedPort` not provided:
- First `server-ready` event after `start()` wins
- Not recommended for concurrent services (race condition)

---

## Error Scenarios

### Service Crashes Before URL Resolution

```typescript
// Process exits before emitting server-ready
const session = await provider.startSession('node', ['broken-server.js'])
await discovery.waitForUrl('mcp', 30000)  // Timeout - server crashed
```

**Detection:** Check process exit before timeout:
```typescript
Promise.race([
  discovery.waitForUrl('mcp'),
  session.exitPromise.then(() => { throw new Error('Process exited early') })
])
```

### Port Already in Use

```typescript
// Another process using port 3000
const session = await provider.startSession('npm', ['run', 'dev'], {
  env: { PORT: '3000' }
})

// Server may:
// - Crash (listen EADDRINUSE)
// - Pick different port (no server-ready for 3000)
// - Override existing server (depends on implementation)
```

**Mitigation:** Use unique ports per service or implement retry with port increments

---

## Related Documents

- [Providers](./providers.md) - WebContainer vs Node provider implementations
- [Terminal Buffering](./terminal-buffering.md) - How output is captured
- [MCP Local Servers](../mcp/local-servers.md) - Using discovery for MCP
- [Mock Verification](../verification/mock-verification.md) - Using discovery for mock servers
