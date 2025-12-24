/**
 * terminal_run_stream tool - Execute a command with streaming output
 */

import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js'
import { successResult, errorResult } from '../types.js'
import { checkCommandPolicy } from '../runtime/policy.js'
import { CodeAgentError } from '../../errors/index.js'

/**
 * Input schema for terminal_run_stream
 */
export const terminalRunStreamSchema = z.object({
	command: z.string().describe('Command to execute'),
	args: z.array(z.string()).describe('Arguments to pass to the command'),
	cwd: z.string().optional().describe('Working directory'),
	env: z.record(z.string(), z.string()).optional().describe('Environment variables'),
	timeout: z.number().optional().describe('Timeout in milliseconds')
})

export type TerminalRunStreamInput = z.infer<typeof terminalRunStreamSchema>

/**
 * Output type for terminal_run_stream
 */
export interface TerminalRunStreamOutput {
	command: string
	args: string[]
	exitCode: number
	output: string
	chunkCount: number
}

/**
 * terminal_run_stream tool definition
 */
export const terminalRunStreamTool: ToolDefinition<TerminalRunStreamInput, TerminalRunStreamOutput> = {
	name: 'terminal_run_stream',
	description: 'Execute a command with streaming output. Emits terminal events as output is produced.',
	schema: terminalRunStreamSchema,

	async execute(input: TerminalRunStreamInput, context: ToolContext): Promise<ToolResult<TerminalRunStreamOutput>> {
		const { command, args, cwd, env, timeout } = input

		// Check command policy
		const policyCheck = checkCommandPolicy({ command, args }, context.policy)
		if (!policyCheck.allowed) {
			if (policyCheck.canApprove && !context.policy.autoApprove) {
				return {
					success: false,
					requiresApproval: true,
					approvalReason: policyCheck.reason
				}
			}
			return errorResult(policyCheck.reason!, {
				errorCode: 'COMMAND_DENIED',
				recoverable: false
			})
		}

		try {
			let output = ''
			let exitCode = -1
			let chunkCount = 0

			const stream = context.provider.runStream(command, args, {
				cwd,
				env,
				timeout,
				signal: context.signal
			})

			for await (const chunk of stream) {
				if (chunk.type === 'output') {
					output += chunk.text ?? ''
					chunkCount++

					// Emit terminal event for streaming
					context.onEvent?.({
						type: 'terminal',
						chunk
					})
				} else if (chunk.type === 'exit') {
					exitCode = chunk.exitCode ?? -1
				}
			}

			return successResult({
				command,
				args,
				exitCode,
				output,
				chunkCount
			})
		} catch (error) {
			if (CodeAgentError.isCodeAgentError(error)) {
				return errorResult(error.message, {
					errorCode: error.code,
					recoverable: error.recoverable
				})
			}

			return errorResult(`Stream command failed: ${error instanceof Error ? error.message : String(error)}`, {
				errorCode: 'EXECUTION_FAILED',
				recoverable: true
			})
		}
	}
}
