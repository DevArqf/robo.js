# Robo Detection

> **For AI Agents**: Read this when detecting Robo.js projects or understanding project kind classification.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/project/robo-detection.ts`

## Project Kinds

```typescript
type RoboProjectKind = 'bot' | 'bot+api' | 'activity' | 'unknown'
```

## Detection Logic

1. **Activity:** Has `@discord/embedded-app-sdk` OR `@robojs/patch`
2. **Bot+API:** Has Discord.js + (API dir OR `@robojs/server`)
3. **Bot:** Has `discord.js` OR `@robojs/discordjs`
4. **Unknown:** Has `robo.js` but unclear category

## Robo Signals

### Packages

```typescript
['robo.js', '@robojs/discordjs', '@robojs/server', '@robojs/mock', ...]
```

### Directories

```typescript
{
  commands: '/src/commands',
  events: '/src/events',
  api: '/src/api',
  plugins: '/config/plugins',
  flashcore: '/src/robo/flashcore'
}
```

## RoboIndexSignals

```typescript
{
  kind: RoboProjectKind,
  plugins: string[],
  hasMock: boolean,
  commandsDir?: string,
  eventsDir?: string,
  apiDir?: string,
  flashcoreDir?: string
}
```

## Related

- [detect_profile node](../orchestration/state-machine.md#detect_profile)
- [Mock Verification](../verification/mock-verification.md)
