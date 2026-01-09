# Browser Constraints

> **For AI Agents**: Read this when debugging WebContainer-specific issues or understanding environment limitations.

## WebContainer Limitations

### 1. Combined stdout/stderr

WebContainer merges output streams:

```typescript
// Node.js (separate)
const result = await nodeProvider.run('npm', ['test'])
console.log('stdout:', result.stdout)
console.log('stderr:', result.stderr)

// WebContainer (combined)
const result = await wcProvider.run('npm', ['test'])
console.log('output:', result.stdout)  // stderr mixed in
console.log('stderr:', result.stderr)   // Always empty
```

**Workaround:** Parse output for error patterns

### 2. No stdio Transport

Cannot use child_process for MCP:

```typescript
// ❌ NOT available in browser
const mcpServer = spawn('npx', ['@robojs/mcp'], { stdio: 'pipe' })

// ✅ Must use HTTP/SSE
const mcpClient = createMCPClient({
  transport: 'http',
  url: await serviceDiscovery.waitForUrl('mcp')
})
```

### 3. URL Discovery Required

Cannot use localhost addresses:

```typescript
// ❌ Won't work
const url = 'http://localhost:3000'

// ✅ Must discover from server-ready events
const url = await serviceDiscovery.waitForUrl('dev')
// Returns: 'https://abc123.webcontainer.io'
```

### 4. No Fine-Grained Process Control

Limited process management:

```typescript
// ❌ NOT available
process.pid          // No PID access
process.kill(SIGTERM) // No signals

// ✅ Available
process.exit         // Exit promise
process.output       // Output stream
```

### 5. In-Memory Filesystem

Files not persisted to disk:

```typescript
// All files in memory
// Lost on page reload (unless synced externally)
// Limited by browser memory

// For persistence:
// - Sync to backend via API
// - Download as ZIP
// - Save to localStorage (limited)
```

## Workarounds

### Pattern: Separate Error Output

Parse combined stream for errors:

```typescript
if (output.includes('ERROR') || output.includes('FAILED')) {
  // Likely error content
}
```

### Pattern: MCP in WebContainer

Use HTTP transport with URL discovery:

```typescript
const mcpConfig = {
  servers: {
    local: {
      transport: 'http',
      url: '__DISCOVERED__',
      startCommand: { command: 'node', args: ['mcp.js'] },
      expectedPort: 3001
    }
  }
}
```

### Pattern: Concurrent Services

Use different ports to avoid collisions:

```typescript
await serviceDiscovery.start('dev', { port: 3000 })
await serviceDiscovery.start('mock', { port: 3001 })
await serviceDiscovery.start('mcp', { port: 3002 })
```

## Related

- [WebContainerProvider](../execution/providers.md)
- [Service Discovery](../execution/service-discovery.md)
- [MCP Configuration](../mcp/configuration.md)
