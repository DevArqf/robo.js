# Testing Patterns

> **For AI Agents**: Read this when writing tests for @robojs/code or understanding test infrastructure.

## Overview

Comprehensive testing with unit tests (Jest), integration tests (multi-workflow), and e2e tests (Playwright + WebContainer).

**Test Location:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/__tests__/`

## Components

1. [Mock LLM](./mock-llm.md) - MockLLMProvider for deterministic tests
2. [Mock Provider](./mock-provider.md) - In-memory ExecutionProvider
3. [Fixtures](./fixtures.md) - Test project structures
4. [Integration Patterns](./integration-patterns.md) - Multi-run, abort, interrupts
5. [E2E Playwright](./e2e-playwright.md) - WebContainer browser tests

## Test Categories

### Unit Tests
- Tool validation and policy checks
- Path validation and deny-path matching
- Serial queue behavior
- Stale detection logic

### Integration Tests
- Complete workflows (plan → execute → verify)
- Interrupt/resume flows
- Multi-run isolation
- Abort cleanup

### E2E Tests
- WebContainer in browser (Playwright)
- Real LLM integration (optional, gated)

## Related

- [Tools](../tools/README.md)
- [Orchestration](../orchestration/README.md)
