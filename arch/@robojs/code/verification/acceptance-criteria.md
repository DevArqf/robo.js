# Acceptance Criteria

> **For AI Agents**: Read this when working with scenario specifications or understanding completion requirements.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/types/acceptance.ts`

## AcceptanceCriteria Structure

```typescript
{
  requirements: {
    featureBullets: string[],  // What must be implemented
    constraints?: string[],    // "No new dependencies", "TypeScript only"
    nonGoals?: string[]        // Explicit out of scope
  },
  scenarios: ScenarioSpec[],
  mustPass: string[]  // Scenario IDs required for completion
}
```

## ScenarioSpec

```typescript
{
  id: string,
  title: string,
  description: string,
  kind: 'build' | 'test' | 'mock' | 'manual',
  steps?: string[],
  assertions?: string[],
  toolHints?: {
    requiresMock?: boolean,
    requiresDevServer?: boolean,
    testPattern?: string
  }
}
```

## AcceptanceStatus

```typescript
{
  satisfied: boolean,      // All mustPass scenarios passed
  scenarios: Array<{
    id: string,
    status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped',
    error?: string,
    attempts: number,
    lastAttemptAt?: string
  }>,
  iterations: number,
  budgetExceeded: boolean,
  updatedAt: string
}
```

## Related

- [planner node](../orchestration/state-machine.md#planner)
- [reviewer node](../orchestration/state-machine.md#reviewer)
- [Scenario Mapping](./scenario-mapping.md)
