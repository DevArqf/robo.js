# Test Runner Selection

> **For AI Agents**: Read this when detecting test frameworks or configuring test commands.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/verification/runner-selection.ts`

## Purpose

Auto-detect test runner from package.json (scripts + dependencies).

## Supported Runners

- **vitest** - Config: `vitest.config.{ts,js,mjs}`
- **jest** - Config: `jest.config.{ts,js,mjs,json}`
- **mocha** - Config: `.mocharc.{js,json,yaml,yml}`
- **node-test** - Built-in Node.js test runner

## Detection Priority

1. npm test script (highest priority)
2. Config file existence (vitest > jest > mocha)
3. Direct dependency detection

## TestRunnerConfig

```typescript
{
  cmd: 'npx',
  args: ['vitest', 'run', '--testPathPattern', pattern],
  type: 'vitest',
  pattern?: string
}
```

## Related

- [verify_tests node](./test-verification.md)
- [Scenario Mapping](./scenario-mapping.md)
