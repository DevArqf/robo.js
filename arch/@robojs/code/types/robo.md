# Robo Types

> **For AI Agents**: Reference for Robo.js-specific types.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/types/robo.ts`

## ProjectProfile

```typescript
{
  kind: RoboProjectKind,
  plugins: string[],
  hasMock: boolean,
  directories: {
    commands?: string,
    events?: string,
    api?: string,
    plugins?: string,
    flashcore?: string
  },
  roboVersion?: string,
  hasConfig: boolean
}
```

## RoboProjectKind

```typescript
type RoboProjectKind = 'bot' | 'bot+api' | 'activity' | 'unknown'
```

## VerificationResults

```typescript
{
  build?: BuildVerificationResult,
  tests?: TestVerificationResult,
  mock?: MockVerificationResult
}
```

## BuildError / TestFailure / MockScenarioResult

See [verification/](../verification/) docs for complete structures.

## Related

- [Robo Detection](../project-understanding/robo-detection.md)
- [Verification](../verification/README.md)
