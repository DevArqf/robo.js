# Integration Test Patterns

> **For AI Agents**: Read this when writing integration tests for workflows.

**Location:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/__tests__/integration/`

## Test Categories

### Multi-Run Tests
- Concurrent runs don't interfere
- Abort one doesn't affect others
- Session isolation

### Interrupt Tests
- Question pause/resume
- Approval pause/resume
- Limit pause/resume

### Workflow Tests
- Plan → Execute
- Apply changes workflow
- Verification loop

### Cleanup Tests
- Abort stops sessions
- Mock server cleanup
- Resource disposal

## Pattern: Complete Workflow

```typescript
it('executes complete workflow', async () => {
  // Setup
  const mockLLM = new MockLLMProvider()
  mockLLM.addResponses([...])

  // Execute
  const { runId } = await agent.start({ input: '...' })
  const events = []

  for await (const event of agent.stream(runId)) {
    events.push(event)
  }

  // Assert
  expect(events.find(e => e.type === 'plan')).toBeDefined()
  expect(events.find(e => e.type === 'complete')).toBeDefined()
})
```

## Related

- [Mock LLM](./mock-llm.md)
- [E2E Tests](./e2e-playwright.md)
