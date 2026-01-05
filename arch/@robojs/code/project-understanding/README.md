# Project Understanding

> **For AI Agents**: Read this when working on project analysis, indexing, or Robo.js detection features.

## Overview

The project understanding system provides scalable project analysis with fingerprint-based drift detection, Robo-aware signals, and agent-maintained memory.

**Key Files:**
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/project/indexer.ts` - File indexing
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/project/overview.ts` - Mental model
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/project/robo-detection.ts` - Robo detection

## Components

1. [Indexer](./indexer.md) - File listing, fingerprinting, caps
2. [Overview](./overview.md) - Mental model, agent memory
3. [Robo Detection](./robo-detection.md) - Project kind, signals
4. [Scale Primitives](./scale-primitives.md) - Large file handling, caps

## Key Concepts

**ProjectIndex:** File listing + fingerprint (10K files, 5K dirs max)
**ProjectOverview:** Mental model with decisions + changeLog
**Robo Detection:** bot | bot+api | activity | unknown
**Fingerprinting:** Content hash (≤256KB) or size+mtime (>256KB)

## Related

- [detect_profile node](../orchestration/state-machine.md#detect_profile)
- [refresh_index node](../orchestration/state-machine.md#refresh_index)
- [refresh_overview node](../orchestration/state-machine.md#refresh_overview)
