# Verification System

> **For AI Agents**: Read this when implementing verification workflows, understanding acceptance criteria, or debugging build/test/mock verification.

## Overview

The verification system maps acceptance criteria to executable scenarios with build/test/mock validation. Autonomous verification loops ensure quality before completion.

**Key Files:**
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/verification/scenario-mapper.ts` - Scenario mapping
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/verification/runner-selection.ts` - Test runner detection
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/verification/mock-runner.ts` - Mock validation

## Components

1. [Acceptance Criteria](./acceptance-criteria.md) - Requirements, scenarios, mustPass
2. [Scenario Mapping](./scenario-mapping.md) - kind → verification action
3. [Runner Selection](./runner-selection.md) - Auto-detect test framework
4. [Build Verification](./build-verification.md) - verify_build node
5. [Test Verification](./test-verification.md) - verify_tests node
6. [Mock Verification](./mock-verification.md) - verify_mock node, MockRunner
7. [Reviewer Logic](./reviewer-logic.md) - Completion check, iteration tracking

## Verification Loop

```
reviewer → verify_build → reviewer → verify_tests → reviewer → verify_mock → reviewer
             ↓ fail          ↓ fail                  ↓ fail          ↓ all pass
           agent         agent                     agent           COMPLETE
```

## Scenario Kinds

- **build**: Run build command (`robo build` or `npm run build`)
- **test**: Run test suite (vitest/jest/mocha)
- **mock**: Run @robojs/mock scenarios
- **manual**: User verification steps (future)

## Related

- [planner node](../orchestration/state-machine.md#planner)
- [reviewer node](../orchestration/state-machine.md#reviewer)
- [Robo Detection](../project-understanding/robo-detection.md)
