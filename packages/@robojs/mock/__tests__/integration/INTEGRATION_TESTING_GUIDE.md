# Integration Testing Guide for @robojs/mock

This guide provides comprehensive documentation for implementing and maintaining Discord.js integration tests for the @robojs/mock Discord Mock Server. It is designed for AI agents implementing future test phases.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Running Tests](#running-tests)
4. [Test Structure](#test-structure)
5. [Test Utilities Reference](#test-utilities-reference)
6. [Control API Reference](#control-api-reference)
7. [Writing New Tests](#writing-new-tests)
8. [Adding New Test Phases](#adding-new-test-phases)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

---

## Overview

### Purpose

These integration tests verify that the @robojs/mock Discord Mock Server works correctly with real Discord.js clients. The tests ensure:

- Gateway WebSocket connections work properly
- REST API endpoints return correct responses
- Events are dispatched and filtered correctly
- Intent enforcement works as expected
- Session management functions correctly

### Technology Stack

- **Test Framework:** Jest with ts-jest
- **Client Library:** Discord.js v14
- **Language:** TypeScript
- **Runtime:** Node.js with ESM

### Test Organization

Tests are organized into phases matching the mock server implementation:

| Phase | Description | File |
|-------|-------------|------|
| Phase 1 | Basic Connection | `phase-1/connection.test.ts` |
| Phase 2A | Gateway Connection | `phase-2/gateway.test.ts` |
| Phase 2B | Heartbeat | `phase-2/heartbeat.test.ts` |
| Phase 2C | Reconnection | `phase-2/reconnection.test.ts` |
| Phase 2D | REST API | `phase-2/rest-api.test.ts` |
| Phase 2E-2H | Intents | `phase-2/intents.test.ts` |
| Phase 3 | Messages, Channels, Threads, Webhooks | `phase-3/*.test.ts` |
| Phase 4 | Members, Roles, Bans, Permissions | `phase-4/*.test.ts` |
| Phase 5 | Interactions, AutoMod, Stickers, etc. | `phase-5/*.test.ts` |
| Phase 6A | Recording Export | `phase-6/recording-export.test.ts` |
| Phase 6B | Recording Replay | `phase-6/recording-replay.test.ts` |
| Phase 6C | State Inspection API | `phase-6/state-api.test.ts` |
| Phase 6E | File Uploads & Attachments | `phase-6/attachments.test.ts` |
| Phase 6F | Components V2 | `phase-6/components-v2.test.ts` |
| Phase 6H | Forum Channels Deep | `phase-6/forum-channels.test.ts` |
| Phase 6 | Guild Settings | `phase-6/guild-settings.test.ts` |
| Phase 6 | Message Completeness | `phase-6/message-completeness.test.ts` |
| Phase 7 | Interaction Response Lifecycle | `phase-7/interaction-lifecycle.test.ts` |
| Phase 7 | Channel Helper Methods | `phase-7/channel-helpers.test.ts` |
| Phase 7 | Message Helper Methods | `phase-7/message-helpers.test.ts` |
| Phase 7 | Member Voice Methods | `phase-7/member-voice.test.ts` |
| Phase 7 | Guild Asset Methods | `phase-7/guild-assets.test.ts` |
| Phase 7 | Webhook Thread Operations | `phase-7/webhook-threads.test.ts` |
| Phase 8 | User Methods (send, fetch, DM) | `phase-8/user-methods.test.ts` |
| Phase 8 | GuildMember Shortcut Methods | `phase-8/member-shortcuts.test.ts` |
| Phase 8 | Message Methods (reply, react, etc.) | `phase-8/message-methods.test.ts` |
| Phase 8 | Reaction Methods | `phase-8/reaction-methods.test.ts` |
| Phase 8 | Thread Methods | `phase-8/thread-methods.test.ts` |
| Phase 8 | Role Methods | `phase-8/role-methods.test.ts` |
| Phase 8 | Guild Methods | `phase-8/guild-methods.test.ts` |
| Phase 8 | Collector Methods | `phase-8/collectors.test.ts` |
| Phase 9 | Client-Level Methods | `phase-9/client-methods.test.ts` |
| Phase 9 | GuildMemberManager Methods | `phase-9/member-manager.test.ts` |
| Phase 9 | GuildChannelManager Methods | `phase-9/channel-manager.test.ts` |
| Phase 9 | Permission Overwrites | `phase-9/permission-overwrites.test.ts` |
| Phase 9 | Sticker Methods | `phase-9/stickers.test.ts` |
| Phase 9 | Discord.js Utilities | `phase-9/utilities.test.ts` |

---

## Architecture

### Directory Structure

```
__tests__/integration/
├── INTEGRATION_TESTING_GUIDE.md    # This guide
├── global-setup.js                 # Starts mock server before all tests
├── global-teardown.js              # Stops mock server after all tests
├── setup/
│   ├── constants.ts                # Configuration values
│   ├── control-api.ts              # Control API helpers
│   └── test-client.ts              # Discord.js client factory
├── utils/
│   └── helpers.ts                  # Test utility functions
├── phase-1/
│   └── connection.test.ts          # Basic connection tests
├── phase-2/
│   ├── gateway.test.ts             # Gateway tests
│   ├── heartbeat.test.ts           # Heartbeat tests
│   ├── reconnection.test.ts        # Reconnection tests
│   ├── rest-api.test.ts            # REST API tests
│   └── intents.test.ts             # Intent filtering tests
├── phase-3/
│   ├── channels.test.ts            # Channel CRUD tests
│   ├── messages.test.ts            # Message tests
│   ├── threads.test.ts             # Thread tests
│   └── webhooks.test.ts            # Webhook tests
├── phase-4/
│   ├── members.test.ts             # Member operations
│   ├── roles.test.ts               # Role CRUD tests
│   ├── bans.test.ts                # Ban management tests
│   └── permissions.test.ts         # Permission tests
├── phase-5/
│   ├── interactions.test.ts        # Interaction tests
│   ├── automod.test.ts             # Auto moderation tests
│   ├── stickers.test.ts            # Sticker tests
│   ├── emojis.test.ts              # Emoji tests
│   ├── invites.test.ts             # Invite tests
│   ├── scheduled-events.test.ts    # Scheduled events
│   └── ... (additional tests)
└── phase-6/
    ├── recording-export.test.ts    # Recording export tests
    ├── recording-replay.test.ts    # Recording replay tests
    ├── state-api.test.ts           # State inspection API tests
    ├── attachments.test.ts         # File upload tests
    ├── components-v2.test.ts       # Components V2 tests
    ├── forum-channels.test.ts      # Forum channel tests
    ├── guild-settings.test.ts      # Guild CRUD tests
    └── message-completeness.test.ts # Message validation tests
├── phase-7/
│   ├── interaction-lifecycle.test.ts # Interaction response lifecycle
│   ├── channel-helpers.test.ts      # Channel helper methods
│   ├── message-helpers.test.ts      # Message helper methods
│   ├── member-voice.test.ts         # Member voice state methods
│   ├── guild-assets.test.ts         # Guild asset methods
│   └── webhook-threads.test.ts      # Webhook thread operations
├── phase-8/
│   ├── user-methods.test.ts         # User methods (send, fetch, DM)
│   ├── member-shortcuts.test.ts     # GuildMember shortcut methods
│   ├── message-methods.test.ts      # Message methods (reply, react, etc.)
│   ├── reaction-methods.test.ts     # Reaction methods
│   ├── thread-methods.test.ts       # Thread methods
│   ├── role-methods.test.ts         # Role methods
│   ├── guild-methods.test.ts        # Guild methods
│   └── collectors.test.ts           # Collector methods
└── phase-9/
    ├── client-methods.test.ts       # Client-level methods
    ├── member-manager.test.ts       # GuildMemberManager methods
    ├── channel-manager.test.ts      # GuildChannelManager methods
    ├── permission-overwrites.test.ts # Permission overwrites
    ├── stickers.test.ts             # Sticker methods
    └── utilities.test.ts            # Discord.js utilities
```

### Server Lifecycle

1. **Global Setup** (`global-setup.js`):
   - Starts the mock server via `npx robo start`
   - Waits for "Gateway WebSocket server ready" message
   - Stores process reference in `globalThis.__MOCK_SERVER_PROCESS__`

2. **Test Execution**:
   - All test files share the same server instance
   - Each test creates its own session via Control API
   - Sessions are isolated from each other

3. **Global Teardown** (`global-teardown.js`):
   - Sends SIGTERM to gracefully stop the server
   - Falls back to SIGKILL if needed

### Key Concepts

#### Sessions

Each test should create its own session using `createSession()`. Sessions provide:
- Isolated state (guilds, channels, users)
- Unique token for authentication
- Independent configuration (intents, permissions)

```typescript
const session = await createSession({
  name: 'my-test',
  config: {
    botUser: { username: 'TestBot' },
    guilds: [{ name: 'Test Guild' }],
    enforceIntents: true
  }
})
```

#### Control API

The Control API (`/api/control/...`) allows tests to:
- Create and manage sessions
- Dispatch events to clients
- Control server behavior (stop heartbeats, disconnect, etc.)
- Query session state

---

## Running Tests

### All Tests (Unit + Integration)

```bash
pnpm test
```

### Unit Tests Only

```bash
pnpm test:unit
```

### Integration Tests Only

```bash
pnpm test:integration
```

### Specific Test File

```bash
pnpm test:integration -- --testPathPattern=gateway
```

### Specific Test Phase

```bash
pnpm test:integration -- --testPathPattern=phase-2
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MOCK_REST_URL` | `http://localhost:3000/api` | REST API base URL |
| `MOCK_WS_URL` | `ws://localhost:3000` | WebSocket URL |
| `MOCK_CONTROL_URL` | `http://localhost:3000/api/control` | Control API URL |
| `MOCK_PORT` | `3000` | Server port |
| `MOCK_TIMEOUT` | `10000` | Default timeout (ms) |

---

## Test Structure

### Basic Test Pattern

```typescript
import { Client } from 'discord.js'
import { createSession } from '../setup/control-api.js'
import { createTestClient, destroyClient } from '../setup/test-client.js'
import { waitForReady } from '../utils/helpers.js'

describe('My Test Suite', () => {
  let client: Client | null = null

  afterEach(async () => {
    await destroyClient(client)
    client = null
  })

  it('should do something', async () => {
    // 1. Create session
    const session = await createSession({
      name: 'test-name',
      config: {
        guilds: [{ name: 'Test Guild' }]
      }
    })

    // 2. Create and connect client
    client = createTestClient()
    await client.login(session.token)
    await waitForReady(client)

    // 3. Test assertions
    expect(client.isReady()).toBe(true)
  })
})
```

### Test with Event Dispatch

```typescript
it('should receive dispatched event', async () => {
  const session = await createSession({ /* ... */ })
  client = createTestClient()
  await client.login(session.token)
  await waitForReady(client)

  const channel = client.channels.cache.first()!

  // Set up event listener BEFORE dispatching
  const messagePromise = waitForEvent(client, Events.MessageCreate, 5000)

  // Dispatch event via Control API
  await dispatchEvent(session.id, 'MESSAGE_CREATE', {
    channel_id: channel.id,
    content: 'Test message'
  })

  // Wait for and verify event
  const message = await messagePromise
  expect(message.content).toBe('Test message')
})
```

---

## Test Utilities Reference

### `setup/constants.ts`

```typescript
// Configuration
MOCK_CONFIG.REST_URL      // REST API URL
MOCK_CONFIG.WS_URL        // WebSocket URL
MOCK_CONFIG.CONTROL_URL   // Control API URL
MOCK_CONFIG.TIMEOUT       // Default timeout

// Intents
ALL_INTENTS               // All intents combined
PRIVILEGED_INTENTS        // { GUILD_MEMBERS, GUILD_PRESENCES, MESSAGE_CONTENT }

// Close Codes
GATEWAY_CLOSE_CODES       // { NORMAL, UNKNOWN_ERROR, AUTH_FAILED, ... }
```

### `setup/control-api.ts`

```typescript
// Session Management
createSession(config)           // Create new test session
resetSession(sessionId)         // Reset session to initial state
deleteSession(sessionId)        // Delete a session
getSessionStatus(sessionId)     // Get session info and connection count

// Event Dispatch
dispatchEvent(sessionId, event, data)  // Dispatch event to clients

// Intent Control
sessionIntents(sessionId, options?)    // Get/set intent configuration

// Gateway Control
stopHeartbeatAcks(sessionId, stop)     // Stop/resume heartbeat ACKs
disconnectSession(sessionId, code)      // Force disconnect with close code
invalidateSession(sessionId)            // Invalidate session for fresh READY

// Action Recording
getSessionActions(sessionId, options?)  // Get recorded actions

// Recording & Replay (Phase 6)
getSessionRecording(sessionId)          // Export session recording
replayRecording(sessionId, recording, options?)  // Replay a recording
getFullSessionState(sessionId)          // Get full session state
getDetailedSessionStatus(sessionId)     // Get detailed status with counts

// Direct REST API
mockRestAPI(token, endpoint, options?)  // Make direct REST API requests
```

### `setup/test-client.ts`

```typescript
// Client Creation
createTestClient(options?)        // Create client with default intents
createFullAccessClient()          // Client with ALL intents
createMinimalClient()             // Client with only GUILDS intent
createClientWithIntents(intents)  // Client with specific intents

// Client Lifecycle
destroyClient(client)             // Safely destroy client
connectClient(client, token)      // Connect and wait for ready
```

### `utils/helpers.ts`

```typescript
// Event Waiting
waitForEvent(client, event, timeout, predicate?)  // Wait for specific event
waitForReady(client, timeout)                      // Wait for client ready
waitForAllEvents(client, events, timeout)         // Wait for multiple events

// Utilities
delay(ms)                         // Promise-based delay
retry(fn, options)                // Retry with exponential backoff
generateSnowflake()               // Generate Discord snowflake ID
expectError(fn, matcher?)         // Assert function throws
createDeferred()                  // Create externally-controlled promise
```

---

## Control API Reference

### Session Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sessions` | Create new session |
| GET | `/sessions/:id` | Get session info |
| DELETE | `/sessions/:id` | Delete session |
| GET | `/sessions/:id/state` | Get full session state |
| POST | `/sessions/:id/reset` | Reset to initial state |
| GET | `/sessions/:id/status` | Get status with connection count |

### Event Dispatch

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sessions/:id/dispatch` | Dispatch event to clients |

**Request Body:**
```json
{
  "event": "MESSAGE_CREATE",
  "data": {
    "channel_id": "123456789",
    "content": "Hello!"
  }
}
```

### Gateway Control

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sessions/:id/heartbeat/stop-acks` | Stop heartbeat ACKs |
| POST | `/sessions/:id/gateway/disconnect` | Force disconnect |
| POST | `/sessions/:id/gateway/invalidate-session` | Invalidate session |

### Intent Control

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sessions/:id/intents` | Get intent configuration |
| POST | `/sessions/:id/intents` | Update intent configuration |

---

## Writing New Tests

### Step 1: Choose the Right Phase Directory

- Use existing phase directory if test fits the category
- Create new phase directory for new feature areas

### Step 2: Follow the Pattern

```typescript
// 1. Import from setup utilities, not directly from source
import { createSession, dispatchEvent } from '../setup/control-api.js'
import { createTestClient, destroyClient } from '../setup/test-client.js'
import { waitForReady, waitForEvent, delay } from '../utils/helpers.js'

// 2. Use describe blocks for organization
describe('Phase X: Feature Name', () => {
  // 3. Always clean up clients
  let client: Client | null = null

  afterEach(async () => {
    await destroyClient(client)
    client = null
  })

  // 4. Use descriptive test names
  it('should [expected behavior] when [condition]', async () => {
    // 5. Create isolated session for each test
    const session = await createSession({
      name: 'descriptive-test-name',
      config: { /* minimal config needed */ }
    })

    // 6. Test implementation
    client = createTestClient()
    await client.login(session.token)
    await waitForReady(client)

    // 7. Clear assertions
    expect(result).toBe(expected)
  })
})
```

### Step 3: Consider Edge Cases

- What happens with invalid input?
- What happens when features are disabled?
- What happens with race conditions?

---

## Adding New Test Phases

### Step 1: Create Phase Directory

```bash
mkdir __tests__/integration/phase-N
```

### Step 2: Create Test Files

Follow naming convention: `feature.test.ts`

### Step 3: Update This Guide

Add new phase to the [Test Organization](#test-organization) table.

### Step 4: Update Plan File (if applicable)

If working from a plan file, update it to reflect completion.

---

## Troubleshooting

### Server Fails to Start

**Symptom:** Tests hang or timeout at startup

**Solution:**
1. Check if port 3000 is available: `lsof -i :3000`
2. Kill any existing processes: `pkill -f "robo start"`
3. Check server logs in test output

### Tests Timeout

**Symptom:** Tests fail with "Timeout waiting for..."

**Solutions:**
1. Increase timeout in specific test: `it('...', async () => {...}, 30000)`
2. Check if event is being dispatched correctly
3. Verify client has correct intents for the event

### Client Authentication Fails

**Symptom:** "Invalid session token" errors

**Solutions:**
1. Ensure session was created successfully
2. Use `session.token` not `session.id` for login
3. Check session hasn't expired (default TTL: 1 hour)

### Events Not Received

**Symptom:** Event listener never fires

**Solutions:**
1. Verify client has required intents
2. Check `enforceIntents` session config
3. Set up listener BEFORE dispatching event
4. Use `waitForEvent()` helper with proper timeout

### Import Errors

**Symptom:** Module resolution failures

**Solutions:**
1. Use `.js` extension in imports (ESM requirement)
2. Ensure paths are relative to test file location
3. Check that ts-jest is configured correctly

---

## Best Practices

### Session Naming

Use descriptive session names for debugging:
```typescript
// Good
createSession({ name: 'message-content-intent-test' })

// Bad
createSession({ name: 'test1' })
```

### Isolation

Each test should be independent:
- Create new session per test
- Don't share state between tests
- Clean up clients in afterEach

### Timeouts

Be mindful of timeouts:
- Default Jest timeout: 30000ms (configured in jest.config.ts)
- Use explicit timeouts for slow operations
- Heartbeat tests may need 60000ms+

### Error Messages

Use clear assertions:
```typescript
// Good - clear failure message
expect(message.content).toBe('Expected content')

// Better - with context
expect(message.content, 'Message content should not be stripped').toBe('Expected')
```

### Event Handling

Always set up listeners before triggering events:
```typescript
// Correct order
const eventPromise = waitForEvent(client, Events.MessageCreate)
await dispatchEvent(session.id, 'MESSAGE_CREATE', data)
const result = await eventPromise

// Wrong order - race condition!
await dispatchEvent(session.id, 'MESSAGE_CREATE', data)
const result = await waitForEvent(client, Events.MessageCreate) // May miss event
```

---

## Future Test Parts

This infrastructure supports adding tests for future mock server phases:

- **Part 2:** Interaction handling (slash commands, buttons, modals)
- **Part 3:** Voice state, presence, typing events
- **Part 4:** Threads, forums, polls
- **Part 5+:** Additional Discord features

When implementing new parts:
1. Read the corresponding test specification document
2. Create new phase directories as needed
3. Follow existing patterns and utilities
4. Update this guide with new endpoints/utilities

---

## Lessons Learned & Debugging Techniques

This section documents key insights and techniques discovered while implementing and debugging the integration tests. These patterns will help you solve similar issues.

### 1. BigInt Serialization

**Problem:** Session configuration uses BigInt for `approvedPrivilegedIntents`, but JSON doesn't support BigInt.

**Symptom:** Tests timing out or intent filtering not working correctly.

**Solution:** The control API helpers serialize BigInt to string, and the server converts string back to BigInt:

```typescript
// Client-side: control-api.ts
function serializeBody(body: unknown): string {
  return JSON.stringify(body, (_key, value) => {
    if (typeof value === 'bigint') {
      return value.toString()
    }
    return value
  })
}

// Server-side: sessions.ts
if (body.config?.approvedPrivilegedIntents !== undefined) {
  const intentsValue = body.config.approvedPrivilegedIntents
  if (typeof intentsValue === 'string') {
    body.config.approvedPrivilegedIntents = BigInt(intentsValue)
  }
}
```

**Key Insight:** Always trace data through the entire flow (client → HTTP → server → state) when debugging serialization issues.

### 2. Configurable Heartbeat Interval

**Problem:** Default Discord heartbeat interval is 41.25 seconds, making heartbeat tests extremely slow.

**Symptom:** Heartbeat tests timing out or `client.ws.ping` staying at -1.

**Solution:** Add a control API endpoint to configure the gateway's heartbeat interval:

```typescript
// Set short heartbeat interval for testing (1 second)
await setHeartbeatInterval(1000)

// In test's beforeAll
beforeAll(async () => {
  await setHeartbeatInterval(1000)
})

afterAll(async () => {
  await setHeartbeatInterval(41250) // Restore default
})
```

**Key Insight:** When testing time-dependent behavior, make the timing configurable. Don't hard-code production values.

### 3. Discord.js Event Names

**Problem:** Discord.js doesn't always emit `shardDisconnect` when expected. It may emit `shardReconnecting` instead.

**Symptom:** Tests waiting for `shardDisconnect` timing out.

**Solution:** Listen for multiple possible events:

```typescript
const eventPromise = new Promise<string>((resolve) => {
  const onDisconnect = () => { cleanup(); resolve('shardDisconnect') }
  const onReconnecting = () => { cleanup(); resolve('shardReconnecting') }

  const cleanup = () => {
    client?.off('shardDisconnect', onDisconnect)
    client?.off('shardReconnecting', onReconnecting)
  }

  client?.on('shardDisconnect', onDisconnect)
  client?.on('shardReconnecting', onReconnecting)

  setTimeout(() => { cleanup(); resolve('timeout') }, 10000)
})

const result = await eventPromise
expect(['shardDisconnect', 'shardReconnecting']).toContain(result)
```

**Key Insight:** Discord.js behavior may differ from raw Discord API. Test for observable outcomes, not specific implementation details.

### 4. Message Mentions Flow

**Problem:** Bot mention exception for MessageContent intent not working.

**Symptom:** Message content stripped even when bot is mentioned.

**Root Cause:** Mentions weren't being passed through the dispatch flow:
1. Dispatch endpoint didn't extract mentions from request
2. `dispatchMessage` didn't accept mentions parameter
3. `MockMessageConfig` didn't have mentions field
4. `createMockMessage` always set mentions to empty array

**Solution:** Trace the entire data flow and add mentions support at each layer:

```typescript
// 1. Dispatch endpoint extracts mention IDs
const mentionIds = data.mentions?.map((m) => m.id).filter((id): id is string => !!id) ?? []

// 2. Pass to dispatchMessage
await session.dispatchMessage({
  channelId: data.channel_id,
  content: data.content,
  mentions: mentionIds
})

// 3. createMessage uses mentions
const message = this.state.createMessage({
  mentions: options.mentions ?? []
})

// 4. createMockMessage uses config.mentions
mentions: config.mentions ?? [],
```

**Key Insight:** When a feature doesn't work, trace the data through every transformation. Draw the flow diagram mentally:
```
Test → dispatch endpoint → session.dispatchMessage → state.createMessage →
createMockMessage → buildMessageCreatePayload → stripMessageContent → client
```

### 5. Explicit Test Timeouts

**Problem:** Jest default timeout (5000ms) too short for some tests.

**Symptom:** Tests failing with "Exceeded timeout" errors.

**Solution:** Add explicit timeouts to slow tests:

```typescript
it('should complete slowly', async () => {
  // test code
}, 15000)  // 15 second timeout

// Or using the callback pattern
it(
  'should complete slowly',
  async () => {
    // test code
  },
  15000
)
```

**Key Insight:** Always add explicit timeouts to tests that:
- Wait for heartbeat cycles
- Wait for reconnection attempts
- Involve network delays
- Use `delay()` calls

### 6. Client Cleanup

**Problem:** Jest warning about open handles after tests complete.

**Solution:** Improve `destroyClient` to fully clean up:

```typescript
export async function destroyClient(client: Client | null): Promise<void> {
  if (!client) return
  try {
    client.removeAllListeners()  // Prevent memory leaks
    client.destroy()
    await new Promise((resolve) => setTimeout(resolve, 100))  // Allow WebSocket cleanup
  } catch {
    // Ignore errors during cleanup
  }
}
```

**Key Insight:** WebSocket connections need time to close. Add small delays in cleanup code.

### 7. Debugging Test Failures

When tests fail, use this debugging checklist:

1. **Check the error message carefully** - It often points to exactly what's wrong
2. **Run the failing test in isolation** - `pnpm test:integration -- --testPathPattern=<test-name>`
3. **Add console.log at key points** - Temporarily log values at each transformation
4. **Check the mock server logs** - They show what's being dispatched
5. **Verify the session config** - Intent settings, approved privileged intents
6. **Check if it's a timing issue** - Add delays or increase timeouts
7. **Trace the data flow** - From test input to client output

### 8. Creating Missing REST Endpoints

**Problem:** Tests fail with "API Route not found" errors.

**Symptom:** `TypeError: fetch failed` or 404 errors.

**Solution:** Create the missing endpoint in the mock server:

```typescript
// Example: /api/v10/users/[id].ts
export default async (request: RoboRequest) => {
  const { id } = request.params as { id: string }

  // Handle @me alias
  if (id === '@me') {
    return buildUserResponse(session.state.botUser)
  }

  // Look up user in session state
  const user = session.state.users.get(id)
  if (!user) {
    return new Response(JSON.stringify({ message: 'Unknown User', code: 10013 }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return buildUserResponse(user)
}
```

**Key Insight:** Discord.js makes many REST API calls. When adding tests, you may need to implement missing endpoints first.

### 9. Intent Filtering Debug Approach

When intent filtering doesn't work as expected:

1. **Check enforceIntents is set:**
   ```typescript
   config: {
     enforceIntents: true,  // Must be true!
     approvedPrivilegedIntents: BigInt(...)
   }
   ```

2. **Verify client intents:**
   ```typescript
   const client = createClientWithIntents([
     GatewayIntentBits.Guilds,
     GatewayIntentBits.GuildMessages
   ])
   ```

3. **Check the EVENT_INTENTS mapping** in `src/core/intents.ts`

4. **Check shouldDispatchEvent()** - Add logging to see what's being checked

5. **Check stripMessageContent()** - For MESSAGE_CONTENT intent issues

---

## Quick Reference

### Create Test Session
```typescript
const session = await createSession({
  name: 'test-name',
  config: {
    botUser: { username: 'Bot' },
    guilds: [{ name: 'Guild' }],
    enforceIntents: true,
    approvedPrivilegedIntents: BigInt(1 << 15)
  }
})
```

### Connect Client
```typescript
client = createTestClient()
await client.login(session.token)
await waitForReady(client)
```

### Dispatch Event
```typescript
await dispatchEvent(session.id, 'MESSAGE_CREATE', {
  channel_id: channel.id,
  content: 'Hello'
})
```

### Wait for Event
```typescript
const message = await waitForEvent(client, Events.MessageCreate, 5000)
```

### Control Gateway
```typescript
await stopHeartbeatAcks(session.id, true)
await disconnectSession(session.id, 4000)
await invalidateSession(session.id)
```
