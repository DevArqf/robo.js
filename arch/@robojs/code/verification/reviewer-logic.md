# Reviewer Logic

> **For AI Agents**: Read this when implementing completion logic or understanding verification routing.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/nodes/reviewer.ts`

## Purpose

Checks acceptance status, routes to verification, or declares completion.

## Review Decision

```typescript
{
  needsBuild: boolean,
  needsTests: boolean,
  needsMock: boolean,
  needsMoreWork: boolean,
  allPassed: boolean,
  budgetExceeded: boolean
}
```

## Routing Logic

```typescript
if (budgetExceeded) → END
if (allPassed) → END (set completionSummary)
if (needsBuild) → verify_build
if (needsTests) → verify_tests
if (needsMock) → verify_mock
if (appliedChanges && !overviewRefreshed) → refresh_overview
if (needsMoreWork) → agent
else → END
```

## Execute Mode Fix

```typescript
// Prevents completion without making changes
if (mode === 'execute' && appliedChanges.length === 0) {
  return { needsMoreWork: true }  // Send back to agent
}
```

## Related

- [State Machine](../orchestration/state-machine.md#reviewer)
- [Acceptance Criteria](./acceptance-criteria.md)
