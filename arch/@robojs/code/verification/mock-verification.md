# Mock Verification

> **For AI Agents**: Read this when implementing Discord bot testing with @robojs/mock.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/verification/mock-runner.ts`

## Purpose

Manages @robojs/mock server sessions for Discord interaction testing.

## MockRunner

### Lifecycle

1. **Start Server:** `npx robo dev --port 3000` with `ROBO_MOCK=true`
2. **Wait for Ready:** Pattern detection in output
3. **Create Session:** POST `/api/control/sessions`
4. **Run Scenarios:** Dispatch interactions, collect assertions
5. **Cleanup:** DELETE session + stop server

### Session Creation

```typescript
POST /api/control/sessions
{
  name: string,
  config: {
    botUser: { username },
    guilds: [{ name, channels: [...] }]
  }
}

Response: { session_id, token }
```

### Dispatch Types

- `message` - MESSAGE_CREATE
- `slash_command` - INTERACTION_CREATE (type 2)
- `button` - INTERACTION_CREATE (type 3, component 2)
- `select_menu` - INTERACTION_CREATE (type 3, component 3)
- `modal` - INTERACTION_CREATE (type 5)

## MockVerificationResult

```typescript
{
  success: boolean,
  sessionId: string,
  scenarios: Array<{
    id: string,
    title: string,
    passed: boolean,
    assertions: Array<{
      description: string,
      passed: boolean,
      expected?: unknown,
      actual?: unknown
    }>,
    error?: string
  }>,
  durationMs: number
}
```

## Related

- [verify_mock node](../orchestration/state-machine.md#verify_mock)
- [Robo Detection](../project-understanding/robo-detection.md)
