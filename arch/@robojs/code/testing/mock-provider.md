# Mock Execution Provider

> **For AI Agents**: Read this when writing unit tests that need in-memory filesystem.

## Purpose

In-memory ExecutionProvider for fast unit tests without real filesystem.

## Usage

```typescript
function createMockProvider(initialFiles: Record<string, string> = {}) {
  const fs = { files: { ...initialFiles }, deleted: new Set() }

  return {
    readFile: jest.fn(async (path) => {
      if (fs.files[path]) return fs.files[path]
      throw new Error(`File not found: ${path}`)
    }),
    writeFile: jest.fn(async (path, content) => {
      fs.files[path] = content
    }),
    deletePath: jest.fn(async (path) => {
      delete fs.files[path]
      fs.deleted.add(path)
    }),
    // ... other methods
  } as ExecutionProvider
}
```

## Related

- [Execution Providers](../execution/providers.md)
