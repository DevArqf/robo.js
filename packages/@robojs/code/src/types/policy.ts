/**
 * Policy types for @robojs/code SDK
 *
 * AgentPolicy defines security, execution, and behavior constraints.
 */

/**
 * Command argument policy for fine-grained command control.
 *
 * Command allowlists alone are insufficient for security.
 * This policy allows blocking or requiring approval for specific
 * command + argument combinations.
 *
 * Examples:
 * - Block `node -e` (arbitrary code execution)
 * - Block `npm exec` / `npx` unless approved
 * - Require approval for `npm run <arbitrary>`
 */
export interface CommandArgPolicy {
	/**
	 * Commands + argument prefixes that are always blocked
	 */
	disallow?: Array<{
		command: string
		argsPrefix?: string[]
	}>

	/**
	 * Commands + argument prefixes that require user approval
	 */
	requireApproval?: Array<{
		command: string
		argsPrefix?: string[]
	}>
}

/**
 * Network access policy (best-effort in WebContainer)
 *
 * Note: WebContainer cannot fully enforce network isolation at OS level.
 * This is a best-effort policy for defense in depth.
 */
export interface NetworkPolicy {
	/**
	 * Default network access policy
	 */
	default: 'deny' | 'allow'

	/**
	 * Per-command network access overrides
	 */
	allowForCommands?: Record<string, boolean>
}

/**
 * Context compaction policy for long-running sessions.
 *
 * When enabled, the agent will compact chat history to stay within
 * context limits while preserving critical information.
 */
export interface ContextPolicy {
	/**
	 * Whether to enable automatic context compaction
	 */
	enableCompaction: boolean

	/**
	 * Maximum messages before triggering compaction
	 */
	maxMessagesBeforeCompaction: number

	/**
	 * Number of recent messages to always keep
	 */
	keepLastMessages: number

	/**
	 * Maximum characters for the compaction summary
	 */
	maxSummaryChars: number
}

/**
 * Agent execution and security policy.
 *
 * Required safety rules:
 * - Normalize and validate all paths (prevent `..` traversal)
 * - Never include denyPaths in snapshots or tool-visible context
 * - Disallow shell-string commands; always execute `command + args`
 * - Validate arguments for allowed commands (not just allowlisting)
 * - Never inject backend credentials into container environment
 */
export interface AgentPolicy {
	/**
	 * Whether to auto-approve file changes without user confirmation
	 */
	autoApprove: boolean

	/**
	 * Maximum verification/fix iterations before budget exhaustion
	 */
	maxIterations: number

	/**
	 * Commands allowed to execute (base command names)
	 */
	commandAllowlist: string[]

	/**
	 * Fine-grained command + argument policy
	 */
	commandArgPolicy?: CommandArgPolicy

	/**
	 * Network access policy (best-effort)
	 */
	networkPolicy?: NetworkPolicy

	/**
	 * Paths that should never be read, written, or included in snapshots
	 * Common examples: [".env", ".git", "node_modules"]
	 */
	denyPaths?: string[]

	/**
	 * Maximum bytes for a single file write
	 */
	maxFileWriteBytes?: number

	/**
	 * Maximum total bytes for all diffs in a single change set
	 */
	maxTotalDiffBytes?: number

	/**
	 * Maximum bytes for a snapshot operation
	 */
	maxSnapshotBytes?: number

	/**
	 * Maximum bytes to buffer from terminal output per session
	 * When exceeded, oldest output is dropped and terminal_truncated is emitted
	 */
	maxBufferedTerminalBytes?: number

	/**
	 * Whether to require mock validation when @robojs/mock is available
	 */
	requireMockValidationWhenAvailable?: boolean

	/**
	 * Context compaction policy
	 */
	context?: ContextPolicy
}

/**
 * Default policy values for reference
 */
export const DEFAULT_POLICY: Partial<AgentPolicy> = {
	autoApprove: false,
	maxIterations: 10,
	commandAllowlist: ['npm', 'pnpm', 'yarn', 'robo', 'node', 'vitest', 'jest'],
	denyPaths: ['.env', '.env.local', '.env.production', '.git'],
	maxFileWriteBytes: 512_000, // 512KB
	maxTotalDiffBytes: 2_000_000, // 2MB
	maxSnapshotBytes: 2_000_000, // 2MB
	maxBufferedTerminalBytes: 5_000_000, // 5MB
	commandArgPolicy: {
		disallow: [
			{ command: 'node', argsPrefix: ['-e', '--eval'] },
			{ command: 'npm', argsPrefix: ['exec'] }
		],
		requireApproval: [
			{ command: 'npx' },
			{ command: 'npm', argsPrefix: ['run'] }
		]
	}
}
