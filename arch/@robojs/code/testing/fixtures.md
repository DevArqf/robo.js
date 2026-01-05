# Test Fixtures

> **For AI Agents**: Reference for test project structures used in integration tests.

## Fixture Types

### robo-bot
- Discord bot with commands + events
- Has @robojs/discordjs
- package.json with build script

### robo-activity
- Discord Activity
- Has @discord/embedded-app-sdk
- React frontend

### generic-ts
- Plain TypeScript project
- No Robo.js dependencies
- Tests generic workflows

## Fixture Structure

```typescript
{
  '/package.json': JSON.stringify({
    name: 'test-bot',
    dependencies: { 'robo.js': '^0.10.0' }
  }),
  '/src/commands/ping.ts': 'export default () => ({ content: "Pong!" })',
  '/src/events/ready.ts': 'export default () => { console.log("Ready") }'
}
```

## Related

- [Integration Tests](./integration-patterns.md)
