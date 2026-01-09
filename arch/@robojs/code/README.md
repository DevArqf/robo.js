# @robojs/code Architecture

> **For AI Agents**: Start here for all @robojs/code SDK tasks. This document provides an architectural overview and navigation to specialized subsystems.

## Overview

`@robojs/code` is an SDK for building agentic coding experiences that combines WebContainer execution, LangGraph orchestration, and Robo.js project intelligence to create autonomous coding agents.

**Package Location:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/`

**Version:** 0.1.0

**Primary Use Case:** Browser-based coding agents with in-memory filesystem (WebContainer) and LLM-powered autonomous code writing, testing, and verification.

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          @robojs/code SDK                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  PUBLIC API (CodeAgent)                                        │    │
│  │  start() → stream() → resume() → abort()                       │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                              ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  ORCHESTRATION (LangGraph State Machine)                       │    │
│  │  detect → index → plan → question? → agent ⟷ tools → verify  │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                              ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  TOOL SYSTEM (Registry + Executor + Policy)                    │    │
│  │  13 filesystem + 5 terminal + 1 change = 19 tools              │    │
│  └────────────────────────────────────────────────────────────────┘    │
│         ▼                     ▼                      ▼                   │
│  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────────┐       │
│  │   PROJECT    │  │       MCP        │  │   VERIFICATION      │       │
│  │ UNDERSTANDING│  │   INTEGRATION    │  │  build/test/mock    │       │
│  └──────────────┘  └──────────────────┘  └─────────────────────┘       │
│                              ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  EXECUTION LAYER (WebContainer / Node)                         │    │
│  │  Filesystem + Terminal + Service Discovery                     │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Core Principles

1. **WebContainer-First**: Optimized for browser execution with StackBlitz WebContainers
2. **LangGraph-Native**: Full state management with interrupts, checkpointing, and resume
3. **Security-First**: Policy enforcement, path validation, command allowlists, no secrets in browser
4. **Verification-Driven**: Acceptance criteria with build/test/mock validation loops
5. **Scale-Optimized**: Project indexing + targeted retrieval instead of giant snapshots
6. **Token-Aware**: Automatic context compaction to stay within model limits
7. **Robo-Aware**: Detects and understands Robo.js project structure and conventions
8. **MCP-Extensible**: Integrates with Model Context Protocol servers for extended capabilities

---

## Documentation Navigation

### Foundational Layers

| Section | Entry Point | Description |
|---------|-------------|-------------|
| **Execution** | [execution/README.md](./execution/README.md) | WebContainer/Node providers, service discovery, terminal buffering, path validation |
| **Orchestration** | [orchestration/README.md](./orchestration/README.md) | LangGraph state machine, nodes, edges, interrupts, run lifecycle, event streaming |
| **Tools** | [tools/README.md](./tools/README.md) | Tool registry, executor, policy enforcement, all 25 tools, stale detection |

### Extension Layers

| Section | Entry Point | Description |
|---------|-------------|-------------|
| **MCP** | [mcp/README.md](./mcp/README.md) | Model Context Protocol integration, local/remote servers, tool adapter, patch-plan rule |
| **Project Understanding** | [project-understanding/README.md](./project-understanding/README.md) | Indexing, overview building, Robo detection, scale primitives |
| **Verification** | [verification/README.md](./verification/README.md) | Acceptance criteria, scenario mapping, build/test/mock runners, reviewer logic |

### Contract Layers

| Section | Entry Point | Description |
|---------|-------------|-------------|
| **Types** | [types/README.md](./types/README.md) | Type system reference for events, execution, LLM, policy, acceptance, changes |
| **Testing** | [testing/README.md](./testing/README.md) | Mock providers, fixtures, integration patterns, e2e with Playwright |
| **Implementation** | [implementation/README.md](./implementation/README.md) | Critical paths, error handling, security, browser constraints |

---

## Quick Start Guide

### For Understanding the Codebase

**Q: How do agents execute code in the browser?**
→ Read [execution/providers.md](./execution/providers.md) - WebContainerProvider architecture

**Q: How does the state machine work?**
→ Read [orchestration/state-machine.md](./orchestration/state-machine.md) - Graph topology with all nodes

**Q: What tools are available?**
→ Read [tools/README.md](./tools/README.md) - Overview of all 25 tools

**Q: How do interrupts work (approval, questions)?**
→ Read [orchestration/interrupts.md](./orchestration/interrupts.md) - Interrupt/resume patterns

**Q: How does verification work?**
→ Read [verification/README.md](./verification/README.md) - Build/test/mock workflows

**Q: What is the MCP integration?**
→ Read [mcp/README.md](./mcp/README.md) - Model Context Protocol support

### For Implementing Features

**Adding a new tool:**
1. Read [tools/registry.md](./tools/registry.md) - Registration patterns
2. Read [tools/executor.md](./tools/executor.md) - Execution requirements
3. Check [tools/policy.md](./tools/policy.md) - Policy integration

**Adding a new verification type:**
1. Read [verification/scenario-mapping.md](./verification/scenario-mapping.md) - Scenario kinds
2. Read [verification/reviewer-logic.md](./verification/reviewer-logic.md) - Routing logic
3. Check [orchestration/state-machine.md](./orchestration/state-machine.md) - Add verify_* node

**Modifying the state machine:**
1. Read [orchestration/state-schema.md](./orchestration/state-schema.md) - State fields and reducers
2. Read [orchestration/state-machine.md](./orchestration/state-machine.md) - Graph structure
3. Check [orchestration/interrupts.md](./orchestration/interrupts.md) - Interrupt safety

**Debugging issues:**
1. Read [implementation/error-handling.md](./implementation/error-handling.md) - Error codes
2. Read [implementation/critical-paths.md](./implementation/critical-paths.md) - Hot paths
3. Check relevant subsystem documentation

---

## Key Concepts

### Run Modes

- **explain**: Answer questions grounded in project facts (no edits, read-only tools)
- **plan**: Produce acceptance criteria + plan, ask clarifying questions (no edits)
- **execute**: Implement + verify + iterate until acceptance criteria pass or budget exceeded

### Interrupts

The agent pauses execution and waits for user input at:
- **Approval Required**: File changes need confirmation (when `autoApprove: false`)
- **Question**: Agent needs clarification to proceed
- **Limit Reached**: Iteration budget exceeded, user decides to continue or stop

### Verification Loop

Execute mode runs autonomous verification:
1. Apply changes
2. Run build verification (`robo build` or `npm run build`)
3. Run test verification (if configured)
4. Run mock verification (if `@robojs/mock` available and scenarios exist)
5. If verification fails → iterate (fix → verify)
6. If verification passes → complete

### Tool Execution Model

- **Serial by default**: Tools execute one at a time (FIFO queue)
- **Policy-gated**: All operations validated against AgentPolicy
- **Stale-aware**: Detects file changes between read and write
- **Approval-triggered**: apply_changes tool triggers approval gate when needed

---

## Dependencies

### Runtime Dependencies
- `@langchain/langgraph` ^1.0.7 - State graph orchestration
- `@langchain/core` ^1.0.1 - Messages and base types
- `@ai-sdk/mcp` ^1.0.1 - MCP client integration (browser-compatible)
- `zod` ^3.25.32 - Schema validation
- `zod-to-json-schema` ^3.25.0 - Schema conversion for LLM
- `js-tiktoken` ^1.0.18 - Token counting for context management
- `uuid` ^11.1.0 - UUID generation for run IDs

### Peer Dependencies
- `@webcontainer/api` ^1.4.0 (optional) - For WebContainerProvider
- `robo.js` ^0.10.1 - Robo.js framework integration

---

## Export Map

```typescript
// Main entry
import { CodeAgent, DEFAULT_POLICY } from '@robojs/code'

// Types only
import type { AgentEvent, FileChange } from '@robojs/code/types'

// Providers
import { WebContainerProvider } from '@robojs/code/providers/webcontainer'
import { NodeProvider } from '@robojs/code/providers/node'

// Tools
import { createDefaultToolRegistry } from '@robojs/code/tools'

// MCP
import { createMcpClientManager } from '@robojs/code/mcp'
```

---

## Related Documentation

- [Robo.js AGENTS.md](/Users/pkmmte/Documents/GitHub/robo.js/CLAUDE.md) - Root agent handbook
- [Robo.js Architecture](/Users/pkmmte/Documents/GitHub/robo.js/architecture/) - Framework architecture
- [@robojs/mock Documentation](../mock/) - Mock server for Discord testing (when available)

---

## Document Organization Philosophy

This architecture documentation is optimized for AI agent consumption:

1. **Concept-first organization**: Each major concept gets its own folder
2. **README.md entry points**: Every folder has a navigation README
3. **File path references**: All code references include full absolute paths
4. **ASCII diagrams**: Visual flows for complex systems
5. **Quick reference tables**: Fast lookups for common patterns
6. **Cross-references**: Navigation graph between related concepts

---

## Changelog

- **2026-01-03**: Initial architecture documentation structure created
