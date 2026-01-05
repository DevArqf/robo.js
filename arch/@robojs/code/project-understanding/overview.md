# Project Overview

> **For AI Agents**: Read this when working with project mental models or agent memory persistence.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/project/overview.ts`

## Purpose

Structured "mental model" of project with package info, key files, Robo signals, and agent-maintained memory (decisions + changeLog).

## ProjectOverview Structure

```typescript
{
  updatedAt: string,
  root: string,
  summary: string,           // "my-bot - Discord bot project"
  package: {
    name: string,
    version: string,
    scripts: Record<string, string>,
    dependencies: Record<string, string>
  },
  robo?: {
    kind: RoboProjectKind,
    plugins: string[],
    commands?: string[],     // ['/ping', '/help']
    events?: string[],       // ['ready', 'messageCreate']
    apiRoutes?: string[]     // ['/health', '/user/:id']
  },
  keyFiles: Array<{
    path: string,
    why: string              // Rationale for inclusion
  }>,
  constraints: string[],     // Detected conventions
  decisions: Array<{         // Agent memory
    what: string,
    why: string,
    when: string
  }>,
  changeLog: Array<{         // Agent memory
    description: string,
    files: string[],
    when: string
  }>
}
```

## Agent Memory

Persists across overview refreshes:

```typescript
// Add decision
builder.addDecision('Use TypeScript', 'Better type safety')

// Add change
builder.addChange('Added authentication', ['/src/auth.ts', '/src/middleware/auth.ts'])
```

## Related

- [refresh_overview node](../orchestration/state-machine.md#refresh_overview)
- [Robo Detection](./robo-detection.md)
