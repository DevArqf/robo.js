# Error Handling

> **For AI Agents**: Complete reference for error codes and recovery patterns.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/errors/index.ts`

## CodeAgentError

```typescript
class CodeAgentError extends Error {
  code: string
  recoverable: boolean
  details?: unknown
  cause?: Error

  static isCodeAgentError(error: unknown): error is CodeAgentError
  static wrap(error: unknown, code?: string): CodeAgentError
  toJSON(): Record<string, unknown>
}
```

## Error Codes

| Code | Recoverable | Meaning |
|------|-------------|---------|
| `POLICY_VIOLATION` | false | Security policy denied operation |
| `BUDGET_EXCEEDED` | false | Iteration limit reached |
| `TIMEOUT` | true | Operation timed out |
| `ABORT` | false | User cancelled run |
| `PATH_TRAVERSAL` | false | Attempted directory traversal |
| `INVALID_STATE` | false | Agent in unexpected state |
| `EXECUTION_FAILED` | true | Command/operation failed |
| `COMMAND_DENIED` | false | Command not in allowlist |
| `STALE_FILE` | true | File changed since read |
| `APPROVAL_REQUIRED` | N/A | User approval needed (not error) |
| `VERIFICATION_FAILED` | true | Build/test/mock failed |
| `MCP_UNAVAILABLE` | true | MCP server not available |
| `PARSE_ERROR` | true | Failed to parse response |
| `UNKNOWN_TOOL` | false | Tool not in registry |
| `INVALID_ARGS` | false | Zod validation failed |

## Error Factories

```typescript
pathTraversalError(path: string): CodeAgentError
policyViolationError(message: string, details?: unknown): CodeAgentError
commandDeniedError(command: string, args: string[], reason: string): CodeAgentError
budgetExceededError(current: number, limit: number): CodeAgentError
abortError(reason: string): CodeAgentError
```

## Recovery Patterns

### Recoverable Errors

```typescript
if (error.code === 'STALE_FILE') {
  // Re-read file and retry
  await fs_read(path)
  await fs_write(path, newContent)
}

if (error.code === 'TIMEOUT') {
  // Retry with longer timeout
  await execute(tool, { timeout: 60000 })
}
```

### Non-Recoverable

```typescript
if (error.code === 'PATH_TRAVERSAL') {
  // Security violation - abort run
  await agent.abort({ runId, reason: 'Security violation' })
}
```

## Related

- [Policy](../tools/policy.md)
- [Path Validation](../execution/path-validation.md)
