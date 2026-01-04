/**
 * Internal types for the agent module
 */

import type { ExecutionProvider, LocalServiceDiscovery } from '../types/execution.js'
import type { AgentPolicy } from '../types/policy.js'
import type { BrandedModelAlias, LLMProvider } from '../types/llm.js'
import type { ToolRegistry } from '../tools/types.js'
import type { ToolExecutor } from '../tools/runtime/executor.js'
import type { ProjectIndexer } from '../project/indexer.js'
import type { ProjectOverviewBuilder } from '../project/overview.js'
import type { AgentEvent } from '../types/events.js'
import type { McpConfig } from '../mcp/types.js'
import type { McpClientManager } from '../mcp/McpClientManager.js'

/**
 * Robo-specific configuration
 */
export interface RoboConfig {
	/**
	 * Whether Robo-aware behaviors are enabled
	 */
	enabled: boolean

	/**
	 * Build command to use
	 */
	buildCommand?: { cmd: string; args: string[] }

	/**
	 * Test command to use
	 */
	testCommand?: { cmd: string; args: string[] }

	/**
	 * Whether to prefer mock validation when available
	 */
	preferMockWhenAvailable?: boolean
}

/**
 * Context passed to all graph nodes
 *
 * This contains all the dependencies and configuration needed
 * for nodes to perform their work.
 */
export interface CodeAgentContext {
	/**
	 * Unique run ID (maps 1:1 to LangGraph thread_id)
	 */
	runId: string

	/**
	 * ExecutionProvider for filesystem and terminal access
	 */
	provider: ExecutionProvider

	/**
	 * Agent policy configuration
	 */
	policy: AgentPolicy

	/**
	 * LLM provider for chat completions
	 */
	llm: LLMProvider

	/**
	 * Tool registry with available tools
	 */
	toolRegistry: ToolRegistry

	/**
	 * Tool executor for serialized execution
	 */
	toolExecutor: ToolExecutor

	/**
	 * Project indexer for building project index
	 */
	projectIndexer: ProjectIndexer

	/**
	 * Project overview builder for mental model
	 */
	projectOverviewBuilder: ProjectOverviewBuilder

	/**
	 * Robo-specific configuration
	 */
	roboConfig?: RoboConfig

	/**
	 * MCP configuration (optional)
	 */
	mcpConfig?: McpConfig

	/**
	 * MCP client manager (initialized by CodeAgent if MCP enabled)
	 */
	mcpManager?: McpClientManager

	/**
	 * Service discovery for local services (dev/mock/mcp)
	 */
	serviceDiscovery?: LocalServiceDiscovery

	/**
	 * Event callback for UI streaming
	 */
	onEvent?: (event: AgentEvent) => void

	/**
	 * Abort signal for cancellation
	 */
	signal?: AbortSignal

	/**
	 * Per-run model alias override
	 * Used for per-request model selection instead of provider default
	 */
	modelAlias?: BrandedModelAlias

	/**
	 * Debug mode for deep inspection.
	 * When true, nodes emit verbose debug events for tools, LLM calls,
	 * state changes, and decisions.
	 */
	debugMode?: boolean
}

/**
 * Node function type - takes state, returns partial update
 */
export type NodeFunction<TState, TUpdate> = (state: TState) => Promise<TUpdate>
