# Policy Enforcement

> **For AI Agents**: Read this when configuring security policies, implementing policy checks, or understanding what operations are allowed/denied.

## Overview

AgentPolicy enforces security boundaries through command allowlists, argument-level controls, file access rules, size limits, and context management. Policy validation occurs before every tool execution.

**Key Files:**
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/types/policy.ts` - Policy types
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/runtime/policy.ts` - PolicyValidator

---

## Complete AgentPolicy Structure

```typescript
interface AgentPolicy {
  // ═══════════════════════════════════════════════════════════
  // APPROVAL BEHAVIOR
  // ═══════════════════════════════════════════════════════════

  autoApprove: boolean                    // Auto-apply file changes (default: false)

  // ═══════════════════════════════════════════════════════════
  // ITERATION LIMITS
  // ═══════════════════════════════════════════════════════════

  maxIterations: number                   // Max verify/fix loops (default: 10)

  // ═══════════════════════════════════════════════════════════
  // COMMAND SECURITY
  // ═══════════════════════════════════════════════════════════

  commandAllowlist: string[]              // Allowed executables

  commandArgPolicy?: CommandArgPolicy     // Fine-grained arg control

  // ═══════════════════════════════════════════════════════════
  // FILE ACCESS
  // ═══════════════════════════════════════════════════════════

  denyPaths?: string[]                    // Blocked paths (default: ['.env', '.git'])

  // ═══════════════════════════════════════════════════════════
  // SIZE LIMITS
  // ═══════════════════════════════════════════════════════════

  maxFileReadBytes?: number               // Read truncation (default: 65536 = 64KB)
  maxFileWriteBytes?: number              // Write limit (default: 524288 = 512KB)
  maxTotalDiffBytes?: number              // Total changeset (default: 2MB)
  maxSnapshotBytes?: number               // Snapshot limit (default: 2MB)
  maxBufferedTerminalBytes?: number       // Terminal buffer (default: 5MB)

  // ═══════════════════════════════════════════════════════════
  // VERIFICATION
  // ═══════════════════════════════════════════════════════════

  requireMockValidationWhenAvailable?: boolean  // Force mock tests (default: false)

  // ═══════════════════════════════════════════════════════════
  // CONTEXT MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  context?: ContextPolicy                 // Compaction settings

  // ═══════════════════════════════════════════════════════════
  // FILE CONTENT EVICTION
  // ═══════════════════════════════════════════════════════════

  fileEviction?: FileReadPolicy           // Large file handling

  // ═══════════════════════════════════════════════════════════
  // NETWORK (BEST-EFFORT)
  // ═══════════════════════════════════════════════════════════

  networkPolicy?: NetworkPolicy           // Network access control
}
```

---

## CommandArgPolicy (Critical Security Feature)

### Purpose

Allowlists alone are insufficient - need argument-level control to prevent:
- Arbitrary code execution: `node -e "malicious code"`
- Allowlist bypass: `npm exec forbidden-command`
- Script injection: `npm run user-controlled-script`

### Structure

```typescript
interface CommandArgPolicy {
  disallow?: Array<{
    command: string          // Command name
    argsPrefix?: string[]    // Blocked argument patterns
  }>

  requireApproval?: Array<{
    command: string
    argsPrefix?: string[]    // Patterns needing approval
  }>
}
```

### Default Policy

```typescript
commandArgPolicy: {
  disallow: [
    // Arbitrary code execution
    { command: 'node', argsPrefix: ['-e'] },
    { command: 'node', argsPrefix: ['--eval'] },

    // Allowlist bypass
    { command: 'npm', argsPrefix: ['exec'] },
    { command: 'pnpm', argsPrefix: ['exec'] },
    { command: 'yarn', argsPrefix: ['exec'] }
  ],

  requireApproval: [
    // Arbitrary package execution
    { command: 'npx' },

    // Custom scripts (could do anything)
    { command: 'npm', argsPrefix: ['run'] },
    { command: 'pnpm', argsPrefix: ['run'] },
    { command: 'yarn', argsPrefix: ['run'] }
  ]
}
```

### Matching Logic

**Prefix matching:**
```typescript
function matchesPrefix(args: string[], prefix: string[]): boolean {
  if (prefix.length === 0) return true  // Empty prefix matches everything

  if (args.length < prefix.length) return false

  for (let i = 0; i < prefix.length; i++) {
    if (args[i] !== prefix[i]) return false
  }

  return true
}
```

**Examples:**
```typescript
// Blocked
matchesPrefix(['--eval', 'code'], ['--eval'])           // true ❌
matchesPrefix(['-e', 'console.log()'], ['-e'])          // true ❌
matchesPrefix(['exec', 'rm', '-rf'], ['exec'])          // true ❌

// Allowed
matchesPrefix(['index.js'], ['-e'])                     // false ✅
matchesPrefix(['install'], ['exec'])                    // false ✅

// Requires approval
matchesPrefix(['run', 'build'], ['run'])                // true ⚠️
matchesPrefix(['something'], [])                        // true ⚠️ (npx match)
```

---

## ContextPolicy

### Token-Based Compaction

```typescript
interface ContextPolicy {
  enableCompaction: boolean                    // Enable auto-trim (default: true)
  modelContextLimit: number                    // Model's context window (default: 200000)
  tokenThresholdPercent: number                // Trigger % (default: 0.7 = 70%)
  reservedOutputTokens: number                 // Reserve for completion (default: 8192)
  minTokensAfterCompaction: number             // Min to keep (default: 10000)
  keepLastMessages: number                     // Always preserve N recent (default: 10)
  maxSummaryChars: number                      // Max summary length (default: 2000)

  // Deprecated (legacy)
  maxMessagesBeforeCompaction?: number         // Message-count fallback
}
```

### Compaction Trigger

```typescript
// In agent node, before LLM call
const currentTokens = tokenCounter.count({
  system: systemPrompt,
  messages: state.messages,
  tools: toolSchemas
})

const limit = policy.context.modelContextLimit
const threshold = limit * policy.context.tokenThresholdPercent  // 70%

if (currentTokens > threshold) {
  // Trigger compaction
  const compacted = await contextCompactor.compact(state, currentTokens)

  return {
    messages: compacted.messages,  // Trimmed with summary prepended
    summary: compacted.summary
  }
}
```

### What's Preserved

**Never compacted:**
- Last N messages (default: 10)
- Structured fields: `acceptance`, `plan`, `projectOverview`, `verification`

**Compacted:**
- Old messages → summary (goals, decisions, progress, changed files, last verification)

---

## FileReadPolicy

### Large File Handling

```typescript
interface FileReadPolicy {
  maxReadBytes: number                   // Truncation threshold (default: 65536 = 64KB)
  contentRecencyTurns: number            // Turns before eviction eligible (default: 5)
  maxSummaryChars: number                // Summary length (default: 500)
  autoSummarizeLargeFiles: boolean       // Auto-summarize vs truncate (default: false)
}
```

### Strategies

**Truncation (default):**
```typescript
if (fileSize > policy.fileEviction.maxReadBytes) {
  content = content.substring(0, policy.fileEviction.maxReadBytes)
  content += '\n\n[Truncated - file exceeds 64KB]'
}
```

**Auto-Summarization (if enabled):**
```typescript
if (fileSize > threshold && policy.fileEviction.autoSummarizeLargeFiles) {
  // Return outline + head instead of full content
  const outline = await provider.outline(path)
  const head = await provider.readHead(path, 1000)

  return {
    outline,
    preview: head,
    note: 'Large file - use fs_read_range for specific sections'
  }
}
```

---

## NetworkPolicy (Best-Effort)

### Structure

```typescript
interface NetworkPolicy {
  default: 'allow' | 'deny'
  allowForCommands?: Record<string, boolean>
}
```

### Limitations

**WebContainer cannot enforce network isolation** at OS level. Policy is guidance:

```typescript
networkPolicy: {
  default: 'deny',
  allowForCommands: {
    'npm': true,   // Needs package registry
    'pnpm': true,
    'curl': false  // Block if possible
  }
}
```

**Reality:** Terminal commands can make network requests regardless. Policy is defense-in-depth, not absolute.

---

## DEFAULT_POLICY

```typescript
export const DEFAULT_POLICY: AgentPolicy = {
  autoApprove: false,
  maxIterations: 10,

  commandAllowlist: [
    'node', 'npm', 'npx', 'pnpm', 'yarn',
    'robo', 'git', 'ls', 'cat', 'echo'
  ],

  commandArgPolicy: {
    disallow: [
      { command: 'node', argsPrefix: ['-e'] },
      { command: 'node', argsPrefix: ['--eval'] },
      { command: 'npm', argsPrefix: ['exec'] }
    ],
    requireApproval: [
      { command: 'npx' },
      { command: 'npm', argsPrefix: ['run'] }
    ]
  },

  denyPaths: ['.env', '.env.local', '.env.production', '.git'],

  maxFileReadBytes: 65536,          // 64KB
  maxFileWriteBytes: 524288,        // 512KB
  maxTotalDiffBytes: 2_000_000,     // 2MB
  maxSnapshotBytes: 2_000_000,      // 2MB
  maxBufferedTerminalBytes: 5_000_000,  // 5MB

  context: {
    enableCompaction: true,
    modelContextLimit: 200_000,     // Claude default
    tokenThresholdPercent: 0.7,
    reservedOutputTokens: 8192,
    minTokensAfterCompaction: 10_000,
    keepLastMessages: 10,
    maxSummaryChars: 2000
  },

  fileEviction: {
    maxReadBytes: 65536,
    contentRecencyTurns: 5,
    maxSummaryChars: 500,
    autoSummarizeLargeFiles: false
  }
}
```

---

## PolicyValidator

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/tools/runtime/policy.ts`

### API

```typescript
class PolicyValidator {
  constructor(policy: AgentPolicy, runId: string)

  checkCommand(command: string, args: string[]): PolicyCheckResult
  checkFile(path: string, operation: FileOperation, size?: number): PolicyCheckResult
  checkSnapshot(totalBytes: number): PolicyCheckResult
  checkDiff(totalBytes: number): PolicyCheckResult

  getDenyPaths(): string[]
  isAutoApprove(): boolean
  getPolicy(): AgentPolicy
}

interface PolicyCheckResult {
  allowed: boolean
  reason?: string
  canApprove?: boolean    // Whether approval can override
}
```

### Command Policy Check

```typescript
checkCommand(command: string, args: string[]): PolicyCheckResult {
  // 1. Check allowlist
  if (!this.policy.commandAllowlist.includes(command)) {
    return {
      allowed: false,
      reason: `Command not in allowlist: ${command}`,
      canApprove: false  // Security violation
    }
  }

  // 2. Check disallow rules
  if (this.policy.commandArgPolicy?.disallow) {
    for (const rule of this.policy.commandArgPolicy.disallow) {
      if (rule.command === command) {
        if (!rule.argsPrefix || matchesPrefix(args, rule.argsPrefix)) {
          return {
            allowed: false,
            reason: `Command args blocked by policy: ${command} ${args.join(' ')}`,
            canApprove: false  // Explicit block
          }
        }
      }
    }
  }

  // 3. Check approval rules
  if (this.policy.commandArgPolicy?.requireApproval) {
    for (const rule of this.policy.commandArgPolicy.requireApproval) {
      if (rule.command === command) {
        if (!rule.argsPrefix || matchesPrefix(args, rule.argsPrefix)) {
          return {
            allowed: false,  // Not allowed without approval
            reason: `Command requires approval: ${command}`,
            canApprove: true  // Can be approved
          }
        }
      }
    }
  }

  // 4. Allowed
  return { allowed: true }
}
```

---

## Tool Integration

### Filesystem Tools

```typescript
// In fs_write tool
async execute(args, context) {
  const check = context.policy.checkFile(
    args.path,
    'write',
    Buffer.byteLength(args.content, 'utf-8')
  )

  if (!check.allowed) {
    throw policyViolationError(check.reason)
  }

  // Proceed with write
  await context.provider.writeFile(args.path, args.content)
}
```

### Terminal Tools

```typescript
// In terminal_run tool
async execute(args, context) {
  const check = context.policy.checkCommand(args.command, args.args ?? [])

  if (!check.allowed) {
    if (check.canApprove && !context.policy.isAutoApprove()) {
      // Return approval required
      return approvalRequired(
        [],  // No file changes
        [],  // No diffs
        check.reason,
        { command: args.command, args: args.args }
      )
    }

    throw commandDeniedError(args.command, args.args, check.reason)
  }

  // Proceed with execution
  const result = await context.provider.run(args.command, args.args)
}
```

---

## Custom Policy Examples

### Relaxed Policy (Development)

```typescript
const DEV_POLICY: AgentPolicy = {
  autoApprove: true,           // Skip approval dialogs
  maxIterations: 20,           // Allow more iterations
  commandAllowlist: [
    ...DEFAULT_POLICY.commandAllowlist,
    'curl', 'wget', 'python', 'go'  // Additional tools
  ],
  commandArgPolicy: undefined, // No arg restrictions
  denyPaths: ['.git']          // Only block .git
}
```

### Strict Policy (Production)

```typescript
const STRICT_POLICY: AgentPolicy = {
  autoApprove: false,          // Require all approvals
  maxIterations: 5,            // Limit iterations
  commandAllowlist: ['node', 'npm'],  // Minimal set
  commandArgPolicy: {
    disallow: [
      { command: 'npm', argsPrefix: ['install'] },  // No installs
      { command: 'node' }  // Block all node
    ]
  },
  denyPaths: ['.env', '.git', 'secrets/', 'config/'],
  maxFileWriteBytes: 100_000,  // 100KB limit
  maxTotalDiffBytes: 500_000   // 500KB total
}
```

### Testing Policy

```typescript
const TEST_POLICY: AgentPolicy = {
  autoApprove: true,
  maxIterations: 3,
  commandAllowlist: ['node', 'npm', 'jest', 'vitest'],
  denyPaths: [],               // Allow all for tests
  maxFileWriteBytes: 1_000_000  // 1MB for generated fixtures
}
```

---

## Policy Check Results

### PolicyCheckResult

```typescript
interface PolicyCheckResult {
  allowed: boolean

  reason?: string              // Why denied (if allowed=false)

  canApprove?: boolean         // Can user approval override?
}
```

### Decision Matrix

| Scenario | allowed | canApprove | Action |
|----------|---------|------------|--------|
| Command in allowlist, no arg issues | true | - | Execute |
| Command not in allowlist | false | false | Deny (error) |
| Command in disallow rules | false | false | Deny (error) |
| Command in requireApproval rules | false | true | Request approval |
| File in deny paths | false | false | Deny (error) |
| File exceeds size limit | false | false | Deny (error) |

---

## Size Limit Enforcement

### File Read Limit

```typescript
// fs_read truncates at maxFileReadBytes
async execute(args, context) {
  let content = await context.provider.readFile(args.path)

  const maxBytes = context.policy.maxFileReadBytes ?? 65536
  const actualBytes = Buffer.byteLength(content, 'utf-8')

  if (actualBytes > maxBytes) {
    content = content.substring(0, maxBytes)
    content += `\n\n[Truncated - file exceeds ${maxBytes} bytes]`
  }

  return successResult(content)
}
```

### File Write Limit

```typescript
// fs_write rejects if content too large
async execute(args, context) {
  const size = Buffer.byteLength(args.content, 'utf-8')
  const maxBytes = context.policy.maxFileWriteBytes ?? 524288

  if (size > maxBytes) {
    throw policyViolationError(
      `File content exceeds write limit: ${size} > ${maxBytes} bytes`
    )
  }

  // Proceed
}
```

### Total Diff Limit

```typescript
// apply_changes checks total changeset size
async execute(args, context) {
  const totalBytes = args.changes.reduce((sum, change) => {
    if (change.type === 'delete') return sum
    return sum + Buffer.byteLength(change.content, 'utf-8')
  }, 0)

  const maxBytes = context.policy.maxTotalDiffBytes ?? 2_000_000

  if (totalBytes > maxBytes) {
    throw policyViolationError(
      `Total changeset exceeds limit: ${totalBytes} > ${maxBytes} bytes`
    )
  }

  // Proceed
}
```

---

## Approval Override

### When Approval Can Override

```typescript
// Command requires approval
const check = validator.checkCommand('npx', ['create-robo'])

if (check.canApprove) {
  // Show approval dialog to user
  const approved = await askUser(`Allow: npx create-robo?`)

  if (approved) {
    // Execute despite policy
    await provider.run('npx', ['create-robo'])
  }
}
```

### When Approval CANNOT Override

```typescript
// Security violations never allow override
const check = validator.checkCommand('rm', ['-rf', '/'])

// check.canApprove === false (or undefined)
// Even if user approves, should not execute
```

---

## Testing Policy

### Unit Test Pattern

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/__tests__/tools/runtime/policy.test.ts`

```typescript
describe('PolicyValidator', () => {
  const validator = new PolicyValidator(DEFAULT_POLICY)

  describe('checkCommand', () => {
    test('allows commands in allowlist', () => {
      const result = validator.checkCommand('npm', ['install'])
      expect(result.allowed).toBe(true)
    })

    test('blocks commands not in allowlist', () => {
      const result = validator.checkCommand('rm', ['-rf', '/'])
      expect(result.allowed).toBe(false)
      expect(result.canApprove).toBe(false)
    })

    test('blocks disallowed arg patterns', () => {
      const result = validator.checkCommand('node', ['-e', 'code'])
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('blocked by policy')
    })

    test('requires approval for npx', () => {
      const result = validator.checkCommand('npx', ['create-robo'])
      expect(result.allowed).toBe(false)
      expect(result.canApprove).toBe(true)
    })
  })
})
```

---

## Related Documents

- [Executor](./executor.md) - Policy integration in execution
- [Filesystem Tools](./filesystem-tools.md) - File policy checks
- [Terminal Tools](./terminal-tools.md) - Command policy checks
- [Path Validation](../execution/path-validation.md) - Path security
- [Types](../types/policy.md) - Policy type definitions
