# Build Verification

> **For AI Agents**: Read this when implementing build verification or parsing build errors.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/nodes/verify-build.ts`

## Purpose

Runs build command and parses errors for verification.

## Command Detection

1. Check `roboConfig.buildCommand`
2. If Robo project → `robo build`
3. If package.json has `build` script → `npm run build`
4. Otherwise → Skip (no build)

## Error Parsing

Patterns detected:
- TypeScript: `file(line,col): error TSxxxx: message`
- ESLint: `file:line:col: error message`
- Generic: `/error/i` pattern

## BuildVerificationResult

```typescript
{
  success: boolean,
  command: string,
  args: string[],
  exitCode: number,
  output: string,  // Truncated to 10KB
  errors: BuildError[],
  warnings: BuildWarning[],
  durationMs: number
}
```

## Related

- [reviewer node](./reviewer-logic.md)
- [Scenario Mapping](./scenario-mapping.md)
