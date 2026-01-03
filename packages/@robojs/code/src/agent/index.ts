/**
 * Agent module exports for @robojs/code SDK
 *
 * This module provides the LangGraph-based orchestration for the code agent.
 */

// Main public API
export { CodeAgent, createCodeAgent, type CodeAgentConfig } from './CodeAgent.js'

// State management
export {
	AgentStateAnnotation,
	createInitialState,
	isComplete,
	isWaitingForUser,
	type AgentState,
	type AgentStateUpdate,
	type AgentInput,
	type PendingQuestion
} from './state.js'

// Graph building
export { buildAgentGraph, type GraphConfig, type CompiledAgentGraph } from './graph.js'

// Types
export { type CodeAgentContext, type RoboConfig } from './types.js'

// Edge routing
export {
	NODE,
	type NodeName,
	routeAfterPlanner,
	routeAfterAgent,
	routeAfterTools,
	routeAfterReviewer,
	routeAfterVerification
} from './edges/index.js'

// Stream adapter
export {
	StreamAdapter,
	createStreamAdapter,
	extractToolEventsFromMessages,
	type StreamAdapterConfig
} from './events/index.js'

// Node implementations (for testing/extension)
export {
	detectProfileNode,
	refreshIndexNode,
	refreshOverviewNode,
	plannerNode,
	questionGateNode,
	agentNode,
	toolsNode,
	reviewerNode,
	verifyBuildNode,
	verifyTestsNode,
	verifyMockNode
} from './nodes/index.js'
