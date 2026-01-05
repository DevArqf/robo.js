# Critical Paths

> **For AI Agents**: Read this when optimizing performance or understanding hot execution paths.

## Hot Paths

### 1. Agent Reasoning Loop

```
agent node → LLM.stream() → accumulate chunks → emit llm_text → return AIMessage → route to tools
```

**Performance:**
- Streaming starts immediately (no buffering)
- Text deltas emitted via custom stream (bypasses queue)
- Token counting happens pre-LLM (for compaction check)

### 2. Tool Execution

```
tools node → extract tool_calls → executeMany → [validate → policy check → queue → execute → emit events] × N
```

**Performance:**
- Serial execution (one at a time)
- Validation happens before queueing
- Events emitted immediately (not batched)

### 3. File Read

```
fs_read → validatePath → provider.readFile → checkSize → truncate if needed → record snapshot → return content
```

**Performance:**
- stat() called for size check
- Content truncated at 64KB default
- Snapshot recorded for stale detection

### 4. Context Compaction

```
check tokens → calculate target → preserve recent → trim old messages → generate summary → prepend as system
```

**Performance:**
- Only when over threshold (70% of limit)
- Token counting via js-tiktoken (accurate)
- Summary generation via string template (fast)

## Optimization Opportunities

- **Batch Reads:** Use fs_read_many for 2+ files
- **Skip Stat:** If size known, skip stat() call
- **Outline First:** Use fs_outline before fs_read for structure
- **Cache Fingerprints:** Avoid recomputing if timestamp unchanged

## Related

- [Agent Node](../orchestration/state-machine.md#agent)
- [Tool Executor](../tools/executor.md)
