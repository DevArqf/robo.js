# Mock LLM Provider

> **For AI Agents**: Read this when writing deterministic tests with queued LLM responses.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/llm/MockLLMProvider.ts`

## Purpose

Queue-based mock for deterministic testing. Responses consumed FIFO.

## API

```typescript
class MockLLMProvider implements LLMProvider {
  addResponse(response: Partial<ChatResponse>): void
  addResponses(responses: Partial<ChatResponse>[]): void
  getCallCount(): number
  getLastCall(): ChatRequest | undefined
  getAllCalls(): ChatRequest[]
  reset(): void
}
```

## Usage

```typescript
const mockLLM = new MockLLMProvider()

// Queue responses
mockLLM.addResponses([
  { content: 'I will help you' },
  { content: '', toolCalls: [{ name: 'fs_read', arguments: {...} }] },
  { content: 'Done!', finishReason: 'stop' }
])

// Execute agent (consumes responses in order)
const { runId } = await agent.start({ input: 'Test' })
for await (const event of agent.stream(runId)) {
  // ...
}

// Assert
expect(mockLLM.getCallCount()).toBe(3)
```

## Response Builders

```typescript
MockResponses.text('Hello')
MockResponses.fsRead('/path')
MockResponses.fsWrite('/path', 'content')
MockResponses.terminalRun('npm', ['test'])
MockResponses.done('Completed')
```

## Related

- [Integration Patterns](./integration-patterns.md)
- [E2E Tests](./e2e-playwright.md)
