# Implementation Guide

> **For AI Agents**: Read this when implementing features, debugging production issues, or understanding system constraints and security boundaries.

## Overview

Implementation guidance covering critical execution paths, error handling patterns, security boundaries, and WebContainer constraints.

## Components

1. [Critical Paths](./critical-paths.md) - Hot execution paths, performance considerations
2. [Error Handling](./error-handling.md) - Error codes, recovery patterns, wrapping
3. [Security](./security.md) - Trust boundaries, defense-in-depth, policy layers
4. [Browser Constraints](./browser-constraints.md) - WebContainer limitations, workarounds

## Key Principles

### Performance
- Minimize file reads (use fs_read_many, snapshots)
- Use stat before reading large files
- Prefer outline over full content
- Stream long-running commands

### Security
- Validate all user-provided paths
- Enforce policies at every layer
- Never expose secrets to browser
- Defense-in-depth (policy + validation + limits)

### Reliability
- Handle interrupts idempotently
- Clean up resources on abort
- Provide recovery paths for errors
- Track token usage and limits

## Related

- [Tools](../tools/README.md)
- [Execution](../execution/README.md)
- [Orchestration](../orchestration/README.md)
