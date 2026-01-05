# Path Validation

> **For AI Agents**: Read this when implementing filesystem operations, handling user-provided paths, or debugging path-related security errors.

## Overview

Path validation prevents directory traversal attacks, enforces deny-path policies, and normalizes paths across different platforms (Windows/Unix). All filesystem operations go through validation before execution.

**Key Files:**
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/providers/utils/path.ts` - Validation functions
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/types/policy.ts` - Policy types

---

## Security Threats

### 1. Directory Traversal

Attacker tries to access files outside project root:

```typescript
// Attack attempts
readFile('../../../../etc/passwd')
readFile('../../../.env')
readFile('foo/../../bar/../../../secret.key')
```

### 2. Deny Path Access

Accessing sensitive files within project:

```typescript
// Should be blocked
readFile('.env')
readFile('.git/config')
readFile('node_modules/some-package/.npmrc')
```

### 3. Platform-Specific Exploits

```typescript
// Windows drive letters
readFile('C:\\Windows\\System32\\config\\SAM')

// URL-encoded traversal
readFile('..%2F..%2F..%2Fetc%2Fpasswd')

// Multiple separators
readFile('foo//../../bar')
```

---

## Validation Functions

### validatePath(path, denyPaths?)

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/providers/utils/path.ts`

**Purpose:** Main validation function called before all filesystem operations

```typescript
function validatePath(path: string, denyPaths?: string[]): void {
  // 1. Normalize path (resolve '..' and '.')
  const normalized = normalizePath(path)

  // 2. Check for traversal attempts
  if (containsTraversal(normalized)) {
    throw pathTraversalError(path)
  }

  // 3. Check deny paths
  if (denyPaths && matchesDenyPath(normalized, denyPaths)) {
    throw policyViolationError(`Access denied to path: ${path}`)
  }
}
```

**Throws:**
- `CodeAgentError` with code `PATH_TRAVERSAL` if `..` detected
- `CodeAgentError` with code `POLICY_VIOLATION` if deny path matched

---

## Path Normalization

### normalizePath(path)

```typescript
function normalizePath(path: string): string {
  // 1. Convert backslashes to forward slashes (Windows compat)
  let normalized = path.replace(/\\/g, '/')

  // 2. Decode URL-encoded characters
  normalized = decodeURIComponent(normalized)

  // 3. Remove multiple consecutive slashes
  normalized = normalized.replace(/\/+/g, '/')

  // 4. Ensure leading slash
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized
  }

  // 5. Remove trailing slash (except root)
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.substring(0, normalized.length - 1)
  }

  return normalized
}
```

### Examples

```typescript
normalizePath('foo/bar')              // '/foo/bar'
normalizePath('/foo//bar')            // '/foo/bar'
normalizePath('foo\\bar')             // '/foo/bar' (Windows)
normalizePath('/foo/bar/')            // '/foo/bar'
normalizePath('..%2F..%2Ffoo')        // '/../foo' (detected as traversal)
normalizePath('/')                    // '/'
```

---

## Traversal Detection

### containsTraversal(normalizedPath)

```typescript
function containsTraversal(path: string): boolean {
  // Split into segments
  const segments = path.split('/').filter(s => s.length > 0)

  // Check for '..' in any segment
  return segments.some(segment => segment === '..')
}
```

### Why This Works

After normalization, legitimate paths never contain `..`:
```typescript
containsTraversal('/foo/bar')          // false ✅
containsTraversal('/foo/../bar')       // true  ❌
containsTraversal('/../etc/passwd')    // true  ❌
```

---

## Deny Path Matching

### matchesDenyPath(path, denyPaths)

```typescript
function matchesDenyPath(path: string, denyPaths: string[]): boolean {
  const normalized = normalizePath(path)

  return denyPaths.some(denyPattern => {
    const normalizedPattern = normalizePath(denyPattern)

    // Exact match
    if (normalized === normalizedPattern) return true

    // Prefix match (directory)
    if (normalized.startsWith(normalizedPattern + '/')) return true

    return false
  })
}
```

### Examples

```typescript
const denyPaths = ['.env', '.git', 'node_modules']

matchesDenyPath('/.env', denyPaths)                    // true
matchesDenyPath('/.env.local', denyPaths)              // false (must be exact or prefix)
matchesDenyPath('/.git/config', denyPaths)             // true (prefix match)
matchesDenyPath('/src/node_modules', denyPaths)        // false (not at root)
matchesDenyPath('/node_modules/pkg/index.js', denyPaths) // true (prefix match)
```

---

## Default Deny Paths

**From DEFAULT_POLICY:**

```typescript
denyPaths: [
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.git',
  'node_modules'  // Often huge, not useful for agents
]
```

---

## Integration with Providers

### WebContainerProvider

```typescript
async readFile(path: string): Promise<string> {
  const absPath = this.toAbsolutePath(path)  // rootDir + path

  // Validate before operation
  validatePath(absPath, this.denyPaths)

  return await this.container.fs.readFile(absPath, 'utf-8')
}
```

### NodeProvider

```typescript
async writeFile(path: string, content: string): Promise<void> {
  const absPath = nodePath.join(this.rootDir, path)

  // Validate before operation
  validatePath(absPath, this.denyPaths)

  // Ensure parent exists
  const dir = nodePath.dirname(absPath)
  await fs.mkdir(dir, { recursive: true })

  await fs.writeFile(absPath, content, 'utf-8')
}
```

---

## Error Handling

### PATH_TRAVERSAL Error

```typescript
try {
  await provider.readFile('../../etc/passwd')
} catch (error) {
  if (CodeAgentError.isCodeAgentError(error)) {
    console.log(error.code)        // 'PATH_TRAVERSAL'
    console.log(error.message)     // 'Path traversal attempt detected: ../../etc/passwd'
    console.log(error.recoverable) // false (security violation)
  }
}
```

### POLICY_VIOLATION Error

```typescript
try {
  await provider.readFile('.env')
} catch (error) {
  if (CodeAgentError.isCodeAgentError(error)) {
    console.log(error.code)        // 'POLICY_VIOLATION'
    console.log(error.message)     // 'Access denied to path: .env'
    console.log(error.recoverable) // false (security policy)
  }
}
```

---

## Deny Path Configuration

### Setting Deny Paths

```typescript
// Provider level
const provider = new WebContainerProvider({
  container,
  rootDir: '/project',
  denyPaths: ['.env', '.git', 'secrets/']
})

// Policy level (recommended)
const policy: AgentPolicy = {
  denyPaths: ['.env', '.git', '.npmrc', 'secrets/']
}
```

### Pattern Matching Rules

1. **Exact match**: Path exactly equals deny pattern
   ```typescript
   '/.env' matches '.env' ✅
   ```

2. **Prefix match**: Path starts with deny pattern + `/`
   ```typescript
   '/.git/config' matches '.git' ✅
   '/secrets/key.pem' matches 'secrets/' ✅
   ```

3. **No substring match**: Partial matches don't count
   ```typescript
   '/.environment' DOES NOT match '.env' ❌
   '/src/.git' DOES NOT match '.git' ❌ (must be at root)
   ```

### Recommendation: Use Absolute Patterns

For clarity, use leading slashes:
```typescript
denyPaths: ['/.env', '/.git', '/node_modules', '/secrets']
```

---

## Advanced Scenarios

### Wildcard Patterns (Not Supported)

Current implementation uses exact/prefix matching only:

```typescript
// ❌ NOT supported
denyPaths: ['*.env', '.env.*', '**/.git']

// ✅ Use exact paths
denyPaths: ['.env', '.env.local', '.env.production']
```

**Rationale:** Simple, fast, and covers 99% of use cases. Wildcards add complexity and performance overhead.

### Case Sensitivity

Path matching is case-sensitive (consistent with Unix):

```typescript
matchesDenyPath('/.ENV', ['.env'])  // false
matchesDenyPath('/.Git', ['.git'])  // false
```

**Recommendation:** Normalize deny paths to lowercase if case-insensitive matching needed:
```typescript
const normalized = path.toLowerCase()
matchesDenyPath(normalized, denyPaths.map(p => p.toLowerCase()))
```

---

## Validation in Tool Layer

Tools also validate paths via policy:

```typescript
// tools/runtime/policy.ts
function checkFilePolicy(
  path: string,
  operation: 'read' | 'write' | 'delete' | 'list',
  policy: AgentPolicy
): PolicyCheckResult {
  try {
    validatePath(path, policy.denyPaths)
    return { allowed: true }
  } catch (error) {
    return {
      allowed: false,
      reason: error.message,
      canApprove: false  // Security violations never allow override
    }
  }
}
```

---

## Testing

### Unit Test Examples

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/__tests__/tools/fs/deny-path.test.ts`

```typescript
describe('Path Validation', () => {
  test.each([
    '../../etc/passwd',
    '../../../.env',
    'foo/../../bar/../../../secret'
  ])('rejects traversal: %s', (path) => {
    expect(() => validatePath(path)).toThrow('PATH_TRAVERSAL')
  })

  test.each([
    ['.env', ['.env']],
    ['.git/config', ['.git']],
    ['node_modules/pkg/index.js', ['node_modules']]
  ])('rejects deny path: %s', (path, denyPaths) => {
    expect(() => validatePath(path, denyPaths)).toThrow('POLICY_VIOLATION')
  })
})
```

---

## Related Documents

- [Providers](./providers.md) - How providers use validation
- [Policy](../tools/policy.md) - AgentPolicy.denyPaths configuration
- [Filesystem Tools](../tools/filesystem-tools.md) - Tools using validation
- [Error Handling](../implementation/error-handling.md) - Error codes
