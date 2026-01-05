# E2E Tests with Playwright

> **For AI Agents**: Read this when writing browser-based end-to-end tests with WebContainer.

**Location:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/__tests__/e2e/`

## Purpose

Test @robojs/code in real browser with WebContainer using Playwright.

## Setup

```typescript
import { test, expect } from '@playwright/test'

test('agent executes in browser', async ({ page }) => {
  // Serve static test page
  await page.goto('http://localhost:3000')

  // Wait for WebContainer boot
  await page.waitForFunction(() => window.agentReady)

  // Execute agent
  await page.evaluate(async () => {
    const { runId } = await window.agent.start({
      input: 'Add hello command'
    })

    const events = []
    for await (const event of window.agent.stream(runId)) {
      events.push(event)
    }

    return events
  })
})
```

## Related

- [WebContainerProvider](../execution/providers.md)
- [Integration Tests](./integration-patterns.md)
