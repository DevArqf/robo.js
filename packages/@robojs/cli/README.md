<p align="center">✨ <strong>Generated with <a href="https://robojs.dev/create-robo">create-robo</a> magic!</strong> ✨</p>

---

# @robojs/cli

Build standalone command-line applications with **file-based routing** powered by [Robo.js](https://robojs.dev). Create professional CLIs with minimal boilerplate, automatic help generation, and full TypeScript support.

- [📚 **Documentation:** Getting started](https://robojs.dev/cli/overview)
- [✨ **Discord:** Robo - Imagine Magic](https://robojs.dev/discord)

## Features

- **File-based routing** - Commands map directly to files
- **Automatic help generation** - Help text generated from your config
- **Subcommand support** - Nested directories become subcommands
- **Type-safe options** - Full TypeScript inference for command options
- **Extensions** - Add before/after hooks and options to existing commands
- **Zero config** - Works out of the box

## Installation

Add to your existing Robo.js project:

```bash
npx robo add @robojs/cli
```

Or create a new project with the plugin:

```bash
npx create-robo my-cli -p @robojs/cli
```

## Quick Start

### 1. Create a command

Create `src/robo/cli/commands/hello.ts`:

```typescript
import { createCliCommandConfig, type CliContext } from 'robo.js/cli.js'

export const config = createCliCommandConfig({
  description: 'Say hello to someone',
  options: [
    { alias: '-n', name: '--name', description: 'Name to greet', type: 'string', default: 'World' }
  ]
} as const)

export default (ctx: CliContext<typeof config>) => {
  console.log(`Hello, ${ctx.options.name}!`)
}
```

### 2. Build your CLI

```bash
npx robo build
```

### 3. Run it

```bash
node .robo/build/cli.js hello
# Hello, World!

node .robo/build/cli.js hello --name Robo
# Hello, Robo!
```

## Creating Commands

Commands are created by placing files in `src/robo/cli/commands/`. The file path determines the command name.

### Basic Command

```typescript
// src/robo/cli/commands/greet.ts
// Usage: mycli greet

export const config = {
  description: 'Greet the user'
}

export default () => {
  console.log('Hello!')
}
```

### Command with Options

```typescript
// src/robo/cli/commands/build.ts
// Usage: mycli build --watch --output ./dist

import { createCliCommandConfig, type CliContext } from 'robo.js/cli.js'

export const config = createCliCommandConfig({
  description: 'Build the project',
  options: [
    { alias: '-w', name: '--watch', description: 'Watch for changes', type: 'boolean' },
    { alias: '-o', name: '--output', description: 'Output directory', type: 'string', default: './build' }
  ]
} as const)

export default (ctx: CliContext<typeof config>) => {
  console.log(`Building to ${ctx.options.output}...`)
  if (ctx.options.watch) {
    console.log('Watching for changes...')
  }
}
```

### Subcommands

Create nested directories for subcommands:

```
src/robo/cli/commands/
├── db/
│   ├── index.ts      # mycli db
│   ├── migrate.ts    # mycli db migrate
│   └── seed.ts       # mycli db seed
└── config/
    ├── get.ts        # mycli config get
    └── set.ts        # mycli config set
```

Example subcommand:

```typescript
// src/robo/cli/commands/db/migrate.ts
// Usage: mycli db migrate --target latest

import { createCliCommandConfig, type CliContext } from 'robo.js/cli.js'

export const config = createCliCommandConfig({
  description: 'Run database migrations',
  options: [
    { alias: '-t', name: '--target', description: 'Target version', type: 'string', default: 'latest' },
    { alias: '-f', name: '--force', description: 'Force migration', type: 'boolean' }
  ]
} as const)

export default (ctx: CliContext<typeof config>) => {
  console.log(`Migrating to ${ctx.options.target}...`)
  if (ctx.options.force) {
    console.log('Force mode enabled')
  }
}
```

### Positional Arguments

Enable positional arguments to accept values without flags:

```typescript
// src/robo/cli/commands/install.ts
// Usage: mycli install lodash express react

import { createCliCommandConfig, type CliContext } from 'robo.js/cli.js'

export const config = createCliCommandConfig({
  description: 'Install packages',
  positionalArgs: true
} as const)

export default (ctx: CliContext<typeof config>) => {
  const packages = ctx.args
  console.log(`Installing: ${packages.join(', ')}`)
}
```

## Command Configuration

### Option Properties

| Property | Type | Description |
|----------|------|-------------|
| `alias` | `string` | Short flag (e.g., `-n`) |
| `name` | `string` | Long flag (e.g., `--name`) |
| `description` | `string` | Help text for this option |
| `type` | `'string' \| 'boolean' \| 'number'` | Value type (default: `'string'`) |
| `required` | `boolean` | Whether the option is required |
| `default` | `any` | Default value if not provided |

### Option Type Inference

When using `createCliCommandConfig` with `as const`, TypeScript infers the correct types:

```typescript
import { createCliCommandConfig, type CliContext } from 'robo.js/cli.js'

export const config = createCliCommandConfig({
  description: 'Example command',
  options: [
    { alias: '-p', name: '--port', type: 'number', default: 3000 },  // number (has default)
    { alias: '-h', name: '--host', type: 'string' },                  // string | undefined
    { alias: '-v', name: '--verbose', type: 'boolean', required: true } // boolean (required)
  ]
} as const)

export default (ctx: CliContext<typeof config>) => {
  ctx.options.port    // TypeScript knows: number
  ctx.options.host    // TypeScript knows: string | undefined
  ctx.options.verbose // TypeScript knows: boolean
}
```

## Command Context

The handler receives a context object with:

| Property | Type | Description |
|----------|------|-------------|
| `args` | `string[]` | Positional arguments |
| `options` | `object` | Parsed option values |
| `logger` | `Logger` | Robo.js logger instance |
| `cwd` | `string` | Current working directory |
| `argv` | `string[]` | Raw arguments after command |

## Command Extensions

Extensions let you add options and hooks to existing commands. Place them in `src/robo/cli/extend/`.

### Adding Options

```typescript
// src/robo/cli/extend/build.ts
// Extends: mycli build

export const config = {
  description: 'Extension for build command',
  options: [
    { alias: '-m', name: '--minify', description: 'Minify output', type: 'boolean' }
  ]
}
```

### Before/After Hooks

```typescript
// src/robo/cli/extend/auth/login.ts
// Extends: mycli auth login

import type { CliContext } from 'robo.js'

export const config = {
  description: 'Extension for auth login command',
  priority: 10
}

export async function before(ctx: CliContext) {
  console.log('Running pre-login checks...')
  // Return false to abort the command
  return true
}

export async function after(ctx: CliContext) {
  console.log('Login completed:', ctx.result)
  // Send notification, update status, etc.
}
```

### Extension File Naming

The file path determines which command is extended:

| File | Extends Command |
|------|----------------|
| `extend/build.ts` | `build` |
| `extend/config/set.ts` | `config set` |
| `extend/auth/login.ts` | `auth login` |

Use nested folders to extend subcommands.

## Publishing Your CLI

### 1. Configure package.json

```json
{
  "name": "my-awesome-cli",
  "version": "1.0.0",
  "bin": {
    "mycli": ".robo/build/cli.js"
  },
  "files": [
    ".robo/build"
  ]
}
```

### 2. Build and publish

```bash
npx robo build
npm publish
```

### 3. Users can now run

```bash
npx my-awesome-cli hello
# or after global install
mycli hello
```

## Project Structure

```
my-cli/
├── src/
│   └── robo/
│       └── cli/
│           ├── commands/      # CLI commands
│           │   ├── hello.ts
│           │   └── db/
│           │       ├── index.ts
│           │       └── migrate.ts
│           └── extend/        # Command extensions
│               └── auth/
│                   └── login.ts
├── config/
│   └── robo.ts               # Robo.js config
├── package.json
└── tsconfig.json
```

## API Reference

### Exports from `robo.js/cli.js`

```typescript
// Configuration helper
import { createCliCommandConfig } from 'robo.js/cli.js'

// Types
import type {
  CliContext,           // Command handler context
  CliCommandConfig,     // Command configuration
  CliOptionConfig,      // Option configuration
  CliHandler,           // Handler function type
  CliExtendConfig,      // Extension configuration
  CliBeforeHook,        // Before hook type
  CliAfterHook          // After hook type
} from 'robo.js/cli.js'
```

### createCliCommandConfig

Type-safe configuration helper that enables TypeScript inference:

```typescript
import { createCliCommandConfig, type CliContext } from 'robo.js/cli.js'

export const config = createCliCommandConfig({
  description: 'My command',
  options: [
    { alias: '-n', name: '--name', type: 'string', required: true }
  ]
} as const)  // Don't forget `as const`!

export default (ctx: CliContext<typeof config>) => {
  // ctx.options.name is typed as `string`
}
```

## More on Robo.js

Explore more about Robo.js:

- [Quickstart](https://robojs.dev/getting-started)
- [Discord Bots](https://robojs.dev/discord-bots)
- [Discord Activities](https://robojs.dev/discord-activities)
- [Plugins](https://robojs.dev/plugins/overview)

> **Heads up!** This is the plugin documentation. For extending the internal Robo CLI (adding commands to `npx robo`), see the [CLI Extending Guide](https://robojs.dev/cli/extending).
