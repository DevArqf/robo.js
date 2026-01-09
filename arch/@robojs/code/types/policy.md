# Policy Types

> **For AI Agents**: Complete reference for AgentPolicy and sub-policies.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/types/policy.ts`

## AgentPolicy

See complete structure in [tools/policy.md](../tools/policy.md#complete-agentpolicy-structure)

## Sub-Policies

### CommandArgPolicy

```typescript
{
  disallow?: Array<{ command: string; argsPrefix?: string[] }>,
  requireApproval?: Array<{ command: string; argsPrefix?: string[] }>
}
```

### ContextPolicy

```typescript
{
  enableCompaction: boolean,
  modelContextLimit: number,
  tokenThresholdPercent: number,
  reservedOutputTokens: number,
  minTokensAfterCompaction: number,
  keepLastMessages: number,
  maxSummaryChars: number
}
```

### FileReadPolicy

```typescript
{
  maxReadBytes: number,
  contentRecencyTurns: number,
  maxSummaryChars: number,
  autoSummarizeLargeFiles: boolean
}
```

### NetworkPolicy

```typescript
{
  default: 'allow' | 'deny',
  allowForCommands?: Record<string, boolean>
}
```

## Related

- [Policy Enforcement](../tools/policy.md)
- [DEFAULT_POLICY](../tools/policy.md#default_policy)
