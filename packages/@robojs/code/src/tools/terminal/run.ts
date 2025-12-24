/**
 * terminal_run tool - Execute a one-shot command
 */

import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js'
import { successResult, errorResult } from '../types.js'
import { checkCommandPolicy } from '../runtime/policy.js'
import { CodeAgentError } from '../../errors/index.js'

/**
 * Input schema for terminal_run
 */
export const terminalRunSchema = z.object({
	command: z.string().describe('Command to execute (e.g., "npm", "node")'),
	args: z.array(z.string()).describe('Arguments to pass to the command'),
	cwd: z.string().optional().describe('Working directory'),
	env: z.record(z.string(), z.string()).optional().describe('Environment variables'),
	timeout: z.number().optional().describe('Timeout in milliseconds')
})

export type TerminalRunInput = z.infer<typeof terminalRunSchema>

/**
 * Output type for terminal_run
 */
export interface TerminalRunOutput {
	command: string
	args: string[]
	exitCode: number
	output: string
	stdout?: string
	stderr?: string
	timedOut?: boolean
}

/**
 * terminal_run tool definition
 */
export const terminalRunTool: ToolDefinition<TerminalRunInput, TerminalRunOutput> = {
	name: 'terminal_run',
	description: 'Execute a command and wait for it to complete. Returns the output and exit code.',
	schema: terminalRunSchema,

	async execute(input: TerminalRunInput, context: ToolContext): Promise<ToolResult<TerminalRunOutput>> {
		const { command, args, cwd, env, timeout } = input

		// Check command policy
		const policyCheck = checkCommandPolicy({ command, args }, context.policy)
		if (!policyCheck.allowed) {
			// If approval is possible and we can auto-approve, proceed
			if (policyCheck.canApprove && context.policy.autoApprove) {
				// Auto-approved - continue to execution
			} else if (policyCheck.canApprove) {
				// Request user approval
				return {
					success: false,
					requiresApproval: true,
					approvalReason: policyCheck.reason
				}
			} else {
				// Denied - cannot be approved
				return errorResult(policyCheck.reason!, {
					errorCode: 'COMMAND_DENIED',
					recoverable: false
				})
			}
		}

		try {
			const result = await context.provider.run(command, args, {
				cwd,
				env,
				timeout,
				signal: context.signal
			})

			return successResult({
				command,
				args,
				exitCode: result.exitCode,
				output: result.output,
				stdout: result.stdout,
				stderr: result.stderr
			})
		} catch (error) {
			if (CodeAgentError.isCodeAgentError(error)) {
				if (error.code === 'TIMEOUT') {
					return successResult({
						command,
						args,
						exitCode: -1,
						output: error.message,
						timedOut: true
					})
				}
				return errorResult(error.message, {
					errorCode: error.code,
					recoverable: error.recoverable
				})
			}

			return errorResult(`Command failed: ${error instanceof Error ? error.message : String(error)}`, {
				errorCode: 'EXECUTION_FAILED',
				recoverable: true
			})
		}
	}
}
