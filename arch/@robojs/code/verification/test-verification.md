# Test Verification

> **For AI Agents**: Read this when implementing test verification or parsing test results.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/nodes/verify-tests.ts`

## Purpose

Runs test suite and parses results for verification.

## Result Parsing

Patterns:
- Jest/Vitest: `Tests: X passed, Y failed`
- Alternative: `X passed, Y failed`
- Failures: `✕ test name` or `FAIL test name`

## TestVerificationResult

```typescript
{
  success: boolean,
  command: string,
  args: string[],
  exitCode: number,
  output: string,
  passed: number,
  failed: number,
  skipped: number,
  durationMs: number,
  failures: Array<{
    name: string,
    file?: string,
    message?: string,
    stack?: string
  }>
}
```

## Related

- [Runner Selection](./runner-selection.md)
- [reviewer node](./reviewer-logic.md)
