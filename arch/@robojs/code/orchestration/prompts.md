# System Prompts

> **For AI Agents**: Read this when modifying LLM prompts, understanding agent behavior, or debugging planning/reasoning issues.

## Overview

The SDK uses specialized system prompts for different agent nodes. Prompts are dynamically constructed based on mode, project context, and acceptance criteria.

**Key Files:**
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/nodes/planner.ts:15-40` - PLANNER_SYSTEM_PROMPT
- `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/nodes/agent.ts:buildSystemPrompt` - Agent prompt builder

---

## PLANNER_SYSTEM_PROMPT

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/nodes/planner.ts:15-40`

### Purpose

Guides LLM to generate structured acceptance criteria and task plans from user instructions.

### Key Directives

1. **Generate AcceptanceCriteria JSON** with:
   - `requirements` (featureBullets, constraints, nonGoals)
   - `scenarios` (id, title, description, kind, steps, assertions)
   - `mustPass` (scenario IDs required for completion)

2. **Ask clarifying questions** when:
   - Multiple valid implementation approaches exist
   - User intent is ambiguous
   - Critical details missing

3. **Robo.js awareness**:
   - Detect project type (bot, activity, plugin)
   - Use Robo.js conventions (file-based routing)
   - Leverage available plugins

4. **Verification-focused**:
   - Generate testable scenarios
   - Map to verification types (build, test, mock)
   - Set appropriate mustPass criteria

### Output Format

```json
{
  "acceptance": {
    "requirements": {
      "featureBullets": ["Feature 1", "Feature 2"],
      "constraints": ["TypeScript only", "No new dependencies"]
    },
    "scenarios": [
      {
        "id": "build-001",
        "title": "Project builds successfully",
        "description": "...",
        "kind": "build",
        "mustPass": true
      }
    ],
    "mustPass": ["build-001"]
  },
  "plan": [
    {
      "id": "step-1",
      "title": "Create command file",
      "description": "...",
      "files": ["/src/commands/ping.ts"]
    }
  ],
  "needsClarification": false
}
```

---

## Agent System Prompt

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/agent/nodes/agent.ts:buildSystemPrompt`

### Purpose

Dynamically constructed prompt providing full context for agent reasoning and tool execution.

### Components

#### 1. Base Instructions

Mode-specific behavior:
- **explain**: Read-only operations, answer questions
- **plan**: Already have plan, just clarify
- **execute**: Implement changes, use tools, verify

#### 2. Project Context

```
Project: {projectOverview.package.name}
Type: {projectProfile.kind}
Plugins: {projectProfile.plugins.join(', ')}

Key files:
{projectOverview.keyFiles.map(f => `- ${f.path}: ${f.why}`).join('\n')}
```

#### 3. Acceptance Criteria (execute mode)

```
## Requirements
{acceptance.requirements.featureBullets.map(b => `- ${b}`).join('\n')}

## Scenarios
{acceptance.scenarios.map(s => `
### ${s.title} (${s.kind})
${s.description}
Status: ${scenarioStatus.status}
`).join('\n')}

## Must Pass
{mustPassScenarios.join(', ')}
```

#### 4. Current Step (if in plan)

```
Current step ({currentStep + 1}/{plan.length}):
{plan[currentStep].title}
{plan[currentStep].description}

Files to modify: {plan[currentStep].files.join(', ')}
```

#### 5. Last Verification (if exists)

```
Last verification:
- Build: {lastVerification.build.success ? 'PASSED' : 'FAILED'}
{lastVerification.build.errors?.map(e => `  - ${e.message}`).join('\n')}

- Tests: {lastVerification.tests.success ? 'PASSED' : 'FAILED'}
{lastVerification.tests.failures?.map(f => `  - ${f.name}: ${f.message}`).join('\n')}
```

#### 6. Compacted Summary (if compacted)

```
# Previous Context Summary

{state.summary}
```

### Full Prompt Structure

```
You are an AI coding agent powered by @robojs/code SDK.

[Mode-specific instructions]

## Project
{project context}

## Task
{original instruction}

## Acceptance Criteria
{requirements + scenarios}

## Current Step
{plan step if applicable}

## Last Verification
{verification results if applicable}

## Compacted History
{summary if compacted}

## Available Tools
{tool schemas}

Think step by step. Use tools to understand the project, implement changes, and verify your work.
```

---

## Prompt Engineering Principles

### 1. Structured Output

Planner enforces JSON output with schema:
- Ensures parseable responses
- Type-safe acceptance criteria
- Consistent plan format

### 2. Minimal Ambiguity

Prompts include:
- Explicit examples
- Clear success criteria
- Specific tool recommendations

### 3. Self-Correction

Agent prompt includes:
- Last verification results
- Previous errors/failures
- Iteration count

Encourages agent to learn from mistakes.

### 4. Context Efficiency

- Compacted summary replaces verbose history
- Structured fields preferred over prose
- Tool schemas only when needed

---

## Prompt Customization (Future)

### Custom Planner Behavior

```typescript
const plannerPrompt = `
${PLANNER_SYSTEM_PROMPT}

Additional guidelines:
- Prefer minimal changes
- Always add tests
- Follow existing patterns
`
```

### Mode-Specific Prompts

```typescript
const modeInstructions = {
  explain: 'Answer questions based on project facts. Do not propose changes.',
  plan: 'Generate detailed plan with scenarios. Ask clarifying questions if needed.',
  execute: 'Implement changes, verify, and iterate until acceptance criteria satisfied.'
}
```

---

## Related Documents

- [Planner Node](./state-machine.md#planner) - Where PLANNER_SYSTEM_PROMPT used
- [Agent Node](./state-machine.md#agent) - Where agent prompt constructed
- [Context Compaction](./context-compaction.md) - Summary in agent prompt
- [Acceptance Criteria](../verification/acceptance-criteria.md) - Output format
