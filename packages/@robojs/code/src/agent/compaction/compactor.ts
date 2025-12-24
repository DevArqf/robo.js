/**
 * Context compaction engine for @robojs/code SDK
 *
 * Compacts chat history to stay within context limits while preserving
 * critical information. Per spec requirements:
 * - Trims only `messages` array
 * - Never drops structured fields (plan, profile, verification, projectOverview, acceptance)
 * - Never drops incomplete tool-call turns (AIMessage with tool_calls + all ToolMessages)
 * - Summary includes: goals, decisions, changed files, last verification status
 */

import { AIMessage, ToolMessage, HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages'
import type { AgentState } from '../state.js'
import type { ContextPolicy } from '../../types/policy.js'
import { codeLogger } from '../../core/logger.js'

/**
 * Result of a compaction operation
 */
export interface CompactionResult {
	/**
	 * Structured summary of dropped messages
	 */
	summary: string

	/**
	 * Messages to keep (replacing original messages array)
	 */
	trimmedMessages: BaseMessage[]

	/**
	 * Number of messages dropped
	 */
	droppedCount: number
}

/**
 * A group of messages that form a complete tool-call turn.
 * Never split a turn - AIMessage with tool_calls must stay with its ToolMessages.
 */
interface MessageTurn {
	messages: BaseMessage[]
	isToolCallTurn: boolean
}

/**
 * Default compaction policy values
 */
const DEFAULT_COMPACTION_POLICY: ContextPolicy = {
	enableCompaction: false,
	maxMessagesBeforeCompaction: 50,
	keepLastMessages: 10,
	maxSummaryChars: 2000
}

/**
 * Context compactor for long-running sessions.
 *
 * Compaction rules:
 * 1. Only trim the `messages` array
 * 2. Preserve structured fields (plan, profile, verification, etc.)
 * 3. Group messages into "turns" (complete tool-call groups)
 * 4. Never split a turn in the middle
 * 5. Keep the last N turns as specified by policy
 * 6. Summarize dropped turns into a structured summary
 */
export class ContextCompactor {
	private readonly policy: ContextPolicy

	constructor(policy?: Partial<ContextPolicy>) {
		this.policy = { ...DEFAULT_COMPACTION_POLICY, ...policy }
	}

	/**
	 * Check if compaction is needed based on message count
	 */
	shouldCompact(state: AgentState): boolean {
		if (!this.policy.enableCompaction) {
			return false
		}
		return state.messages.length > this.policy.maxMessagesBeforeCompaction
	}

	/**
	 * Perform compaction on the state
	 *
	 * Returns a CompactionResult with:
	 * - summary: Structured summary of dropped content
	 * - trimmedMessages: Messages to keep
	 * - droppedCount: Number of messages removed
	 */
	compact(state: AgentState): CompactionResult {
		const { messages } = state
		const keepCount = this.policy.keepLastMessages

		codeLogger.debug(`Compacting messages: ${messages.length} -> keep last ${keepCount} turns`)

		// Group messages into turns (complete tool-call groups)
		const turns = this.groupMessagesIntoTurns(messages)

		// Calculate how many turns to keep
		const turnsToKeep = Math.min(turns.length, keepCount)
		const keepTurns = turns.slice(-turnsToKeep)
		const dropTurns = turns.slice(0, turns.length - turnsToKeep)

		// Flatten kept turns back into messages
		const trimmedMessages = keepTurns.flatMap(t => t.messages)

		// Count dropped messages
		const droppedCount = dropTurns.reduce((sum, t) => sum + t.messages.length, 0)

		// Generate summary from dropped turns and state
		const summary = this.generateSummary(state, dropTurns)

		codeLogger.debug(`Compaction complete: dropped ${droppedCount} messages, ${dropTurns.length} turns`)

		return {
			summary,
			trimmedMessages,
			droppedCount
		}
	}

	/**
	 * Group messages into turns.
	 *
	 * A "turn" is a logical unit:
	 * - HumanMessage or SystemMessage: standalone turn
	 * - AIMessage without tool_calls: standalone turn
	 * - AIMessage with tool_calls + all following ToolMessages: combined turn
	 *
	 * This ensures we never split a tool-call in the middle.
	 */
	private groupMessagesIntoTurns(messages: BaseMessage[]): MessageTurn[] {
		const turns: MessageTurn[] = []
		let currentTurn: BaseMessage[] = []
		let expectingToolMessages = false

		for (const msg of messages) {
			if (msg instanceof HumanMessage || msg instanceof SystemMessage) {
				// Start a new turn for human/system messages
				if (currentTurn.length > 0) {
					turns.push({
						messages: currentTurn,
						isToolCallTurn: expectingToolMessages
					})
				}
				turns.push({
					messages: [msg],
					isToolCallTurn: false
				})
				currentTurn = []
				expectingToolMessages = false
			} else if (msg instanceof AIMessage) {
				// Check if this AI message has tool calls
				const hasToolCalls = msg.tool_calls && msg.tool_calls.length > 0

				if (currentTurn.length > 0 && !expectingToolMessages) {
					// Previous non-tool-call turn is complete
					turns.push({
						messages: currentTurn,
						isToolCallTurn: false
					})
					currentTurn = []
				}

				if (hasToolCalls) {
					// Start a new tool-call turn
					if (currentTurn.length > 0) {
						turns.push({
							messages: currentTurn,
							isToolCallTurn: expectingToolMessages
						})
					}
					currentTurn = [msg]
					expectingToolMessages = true
				} else {
					// Standalone AI message
					if (expectingToolMessages) {
						// Previous tool-call turn is complete
						turns.push({
							messages: currentTurn,
							isToolCallTurn: true
						})
						currentTurn = []
					}
					turns.push({
						messages: [msg],
						isToolCallTurn: false
					})
					expectingToolMessages = false
				}
			} else if (msg instanceof ToolMessage) {
				// Add to current tool-call turn
				currentTurn.push(msg)
			} else {
				// Unknown message type - treat as standalone
				if (currentTurn.length > 0) {
					turns.push({
						messages: currentTurn,
						isToolCallTurn: expectingToolMessages
					})
					currentTurn = []
				}
				turns.push({
					messages: [msg],
					isToolCallTurn: false
				})
				expectingToolMessages = false
			}
		}

		// Don't forget any remaining messages
		if (currentTurn.length > 0) {
			turns.push({
				messages: currentTurn,
				isToolCallTurn: expectingToolMessages
			})
		}

		return turns
	}

	/**
	 * Generate a structured summary from dropped turns and state.
	 *
	 * Summary includes:
	 * - Goals (original instruction)
	 * - Key decisions made (extracted from AI messages)
	 * - Changed files
	 * - Last verification status
	 */
	private generateSummary(state: AgentState, droppedTurns: MessageTurn[]): string {
		const parts: string[] = []

		// 1. Goals (original instruction)
		if (state.instruction) {
			parts.push(`## Goals\n${state.instruction}`)
		}

		// 2. Plan steps (if available)
		if (state.plan && state.plan.length > 0) {
			const planSummary = state.plan
				.map(step => `${step.step}. ${step.title} [${step.status}]`)
				.join('\n')
			parts.push(`\n## Plan\n${planSummary}`)
		}

		// 3. Key decisions (extract from dropped AI messages)
		const decisions = this.extractDecisions(droppedTurns)
		if (decisions.length > 0) {
			parts.push(`\n## Key Decisions\n${decisions.map(d => `- ${d}`).join('\n')}`)
		}

		// 4. Changed files
		if (state.appliedChanges && state.appliedChanges.length > 0) {
			const filesList = state.appliedChanges
				.map(c => `- ${c.path} (${c.type})`)
				.join('\n')
			parts.push(`\n## Files Changed\n${filesList}`)
		}

		// 5. Last verification status
		if (state.lastVerification) {
			const status = state.lastVerification.success ? 'PASSED' : 'FAILED'
			const verificationParts = [`\n## Last Verification: ${status}`]

			if (!state.lastVerification.success) {
				if (state.lastVerification.build?.errors?.length) {
					verificationParts.push(`- Build errors: ${state.lastVerification.build.errors.length}`)
				}
				if (state.lastVerification.tests?.failures?.length) {
					verificationParts.push(`- Test failures: ${state.lastVerification.tests.failures.length}`)
				}
				if (state.lastVerification.mock?.scenarios?.some(s => s.error)) {
					const failedCount = state.lastVerification.mock.scenarios.filter(s => s.error).length
					verificationParts.push(`- Mock failures: ${failedCount}`)
				}
			}

			parts.push(verificationParts.join('\n'))
		}

		// 6. Iteration count
		if (state.iterations && state.iterations > 1) {
			parts.push(`\n## Progress\nCompleted ${state.iterations} verification iterations`)
		}

		// Combine and truncate if needed
		let summary = parts.join('\n')

		if (summary.length > this.policy.maxSummaryChars) {
			summary = summary.slice(0, this.policy.maxSummaryChars - 3) + '...'
		}

		return summary
	}

	/**
	 * Extract key decisions from dropped AI messages.
	 *
	 * Looks for patterns that indicate decisions:
	 * - "I will..." / "I'll..."
	 * - "Let me..."
	 * - "I've decided..."
	 * - First sentence of non-tool AI responses
	 */
	private extractDecisions(droppedTurns: MessageTurn[]): string[] {
		const decisions: string[] = []
		const maxDecisions = 10 // Limit to avoid summary bloat

		for (const turn of droppedTurns) {
			if (decisions.length >= maxDecisions) break

			for (const msg of turn.messages) {
				if (decisions.length >= maxDecisions) break

				if (msg instanceof AIMessage) {
					const content = typeof msg.content === 'string'
						? msg.content
						: Array.isArray(msg.content)
							? msg.content.filter(c => typeof c === 'object' && 'text' in c).map(c => (c as { text: string }).text).join(' ')
							: ''

					if (!content) continue

					// Look for decision patterns
					const patterns = [
						/^I (?:will|'ll) (.+?)\.$/m,
						/^Let me (.+?)\.$/m,
						/^I(?:'ve)? decided to (.+?)\.$/m,
						/^(?:First|Next), I (?:will|'ll) (.+?)\.$/m
					]

					for (const pattern of patterns) {
						const match = content.match(pattern)
						if (match && match[1]) {
							const decision = match[1].trim()
							if (decision.length > 10 && decision.length < 200) {
								decisions.push(decision)
								break // Only one decision per message
							}
						}
					}
				}
			}
		}

		return decisions
	}
}

/**
 * Create a context compactor with optional policy override
 */
export function createContextCompactor(policy?: Partial<ContextPolicy>): ContextCompactor {
	return new ContextCompactor(policy)
}
