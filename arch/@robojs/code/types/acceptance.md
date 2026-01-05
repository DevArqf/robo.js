# Acceptance Types

> **For AI Agents**: Reference for acceptance criteria types.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/types/acceptance.ts`

## Types

```typescript
interface AcceptanceCriteria {
  requirements: Requirements
  scenarios: ScenarioSpec[]
  mustPass: string[]
}

interface Requirements {
  featureBullets: string[]
  constraints?: string[]
  nonGoals?: string[]
}

interface ScenarioSpec {
  id: string
  title: string
  description: string
  kind: 'build' | 'test' | 'mock' | 'manual'
  steps?: string[]
  assertions?: string[]
  toolHints?: {
    requiresMock?: boolean
    requiresDevServer?: boolean
    testPattern?: string
  }
}

interface AcceptanceStatus {
  satisfied: boolean
  scenarios: ScenarioStatus[]
  iterations: number
  budgetExceeded: boolean
  updatedAt: string
}

type ScenarioStatus = {
  id: string
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped'
  error?: string
  attempts: number
  lastAttemptAt?: string
}
```

## Related

- [Acceptance Criteria](../verification/acceptance-criteria.md)
