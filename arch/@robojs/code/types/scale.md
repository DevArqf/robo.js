# Scale Types

> **For AI Agents**: Reference for scale primitives that enable operation on large repositories through targeted retrieval.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/types/scale.ts`

## Overview

Scale primitives (`ProjectIndex` and `ProjectOverview`) enable reliable operation on larger repositories by providing targeted retrieval instead of giant snapshots.

---

## ProjectIndex

Lightweight project index for retrieval and drift detection. Computed quickly at run start and refreshed when fingerprint changes.

```typescript
interface ProjectIndex {
  updatedAt: string           // When the index was last updated
  root: string                // Project root path
  fingerprint: string         // Content-based fingerprint for drift detection
  files: Array<{              // All files in the project (with sizes for scale decisions)
    path: string
    size: number
  }>
  dirs: Array<{               // Directories in the project
    path: string
  }>
  robo?: RoboIndexSignals     // Robo-specific signals (if detected as Robo project)
}
```

---

## ProjectOverview

Structured project overview ("mental model") grounded in real artifacts. Includes durable agent-maintained memory (decisions, changelog) that persists separately from chat context.

**Update rules:**
- Refresh at run start (light)
- Refresh after apply_changes
- Refresh after verification
- Allow explicit refresh (for user edits outside agent)

```typescript
interface ProjectOverview {
  updatedAt: string           // When the overview was last updated
  root: string                // Project root path
  summary: string             // Brief summary of the project
  package: PackageInfo        // Package.json information
  robo?: RoboOverview         // Robo-specific details (if Robo project)
  keyFiles: KeyFile[]         // Key files with rationale
  constraints: string[]       // Project constraints and conventions
  decisions: Decision[]       // Decisions made during the run (agent-maintained memory)
  changeLog: ChangeLogEntry[] // Change log (agent-maintained memory)
}
```

---

## RoboIndexSignals

Robo-specific signals in the project index.

```typescript
interface RoboIndexSignals {
  kind: RoboProjectKind       // Detected project kind
  plugins: string[]           // Installed plugins
  commandsDir?: string        // Path to commands directory (if exists)
  eventsDir?: string          // Path to events directory (if exists)
  apiDir?: string             // Path to API routes directory (if exists)
  flashcoreDir?: string       // Path to Flashcore schemas directory (if exists)
  hasMock: boolean            // Whether @robojs/mock is available
}
```

---

## RoboOverview

Robo-specific overview details.

```typescript
interface RoboOverview {
  kind: RoboProjectKind       // Detected project kind
  plugins: string[]           // Installed plugins
  commands?: string[]         // Discovered commands
  events?: string[]           // Discovered event handlers
  apiRoutes?: string[]        // Discovered API routes
  flashcoreSchemas?: string[] // Discovered Flashcore schemas
  mock?: {                    // Mock server availability
    supported: boolean
  }
}
```

---

## Supporting Types

### PackageInfo

```typescript
interface PackageInfo {
  name?: string
  version?: string
  scripts?: Record<string, string>
  dependencies?: string[]
  devDependencies?: string[]
}
```

### KeyFile

```typescript
interface KeyFile {
  path: string
  why: string                 // Rationale for why it's important
}
```

### Decision

```typescript
interface Decision {
  when: string
  topic: string
  decision: string
}
```

### ChangeLogEntry

```typescript
interface ChangeLogEntry {
  when: string
  summary: string
  files: string[]
}
```

### RefreshOptions

```typescript
interface RefreshOptions {
  deep?: boolean              // Whether to do a deep refresh (re-scan all files)
  force?: boolean             // Force refresh even if fingerprint hasn't changed
}
```

---

## Related Documents

- [Project Understanding](../project-understanding/README.md) - How scale primitives are used
- [State Schema](../orchestration/state-schema.md) - projectIndex and projectOverview state fields
