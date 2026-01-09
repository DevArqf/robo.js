# Scenario Mapping

> **For AI Agents**: Read this when implementing scenario-to-action mapping or understanding verification routing.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/verification/scenario-mapper.ts`

## Purpose

Maps ScenarioSpec.kind to verification actions (build/test/mock commands).

## Mapping Logic

```typescript
function mapScenarioToAction(
  scenario: ScenarioSpec,
  context: { profile: ProjectProfile | null, testRunner: TestRunnerConfig | null }
): VerificationAction | null {
  switch (scenario.kind) {
    case 'build':
      return { type: 'build', command: getBuildCommand(context.profile) }

    case 'test':
      if (!context.testRunner) return null
      return { type: 'test', runner: context.testRunner }

    case 'mock':
      if (!context.profile?.hasMock) return null
      return { type: 'mock', steps: scenario.steps, assertions: scenario.assertions }

    case 'manual':
      return { type: 'manual', steps: scenario.steps }

    default:
      return null
  }
}
```

## VerificationAction Types

```typescript
| { type: 'build', command: string, args: string[] }
| { type: 'test', runner: TestRunnerConfig }
| { type: 'mock', steps: string[], assertions: string[] }
| { type: 'manual', steps: string[] }
```

## Related

- [Acceptance Criteria](./acceptance-criteria.md)
- [reviewer node](../orchestration/state-machine.md#reviewer)
