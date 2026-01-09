# Security Architecture

> **For AI Agents**: Read this when implementing security features or understanding trust boundaries.

## Trust Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│ UNTRUSTED                                                    │
│ ├─ User input (instruction, file paths, file content)       │
│ ├─ LLM output (tool calls, arguments, generated code)       │
│ └─ WebContainer filesystem (user can manually edit)         │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│ POLICY LAYER (Defense in Depth)                             │
│ ├─ Path validation (prevent traversal)                      │
│ ├─ Command allowlist (limit executables)                    │
│ ├─ Argument policy (prevent code injection)                 │
│ ├─ Deny paths (block sensitive files)                       │
│ └─ Size limits (prevent DoS)                                │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│ TRUSTED                                                      │
│ ├─ Backend LLM proxy (holds API keys)                       │
│ ├─ Validated tool execution                                 │
│ └─ Enforced policies                                         │
└─────────────────────────────────────────────────────────────┘
```

## Defense Layers

### 1. Path Validation
- Normalize all paths
- Detect `..` traversal
- Match against deny patterns

### 2. Command Policy
- Allowlist executables
- Block dangerous args (`-e`, `exec`)
- Require approval for risky commands

### 3. Size Limits
- File read: 64KB
- File write: 512KB
- Total diffs: 2MB
- Terminal buffer: 5MB

### 4. Browser Isolation
- LLM keys never in browser
- All LLM calls via backend proxy
- WebContainer sandbox (process isolation)

## What WebContainer Cannot Enforce

- Network isolation (best-effort only)
- Resource limits (CPU, memory)
- Filesystem quotas

## Security Checklist

- ✅ All paths validated
- ✅ Commands in allowlist
- ✅ Arguments checked
- ✅ Size limits enforced
- ✅ Secrets never in browser
- ✅ Deny paths respected

## Related

- [Policy](../tools/policy.md)
- [Path Validation](../execution/path-validation.md)
- [Browser Constraints](./browser-constraints.md)
