/**
 * terminal_session_stop tool - Stop a running terminal session
 */

import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js'
import { successResult, errorResult } from '../types.js'
import { CodeAgentError } from '../../errors/index.js'

/**
 * Input schema for terminal_session_stop
 */
export const terminalSessionStopSchema = z.object({
	sessionId: z.string().describe('Session ID from terminal_session_start')
})

export type TerminalSessionStopInput = z.infer<typeof terminalSessionStopSchema>

/**
 * Output type for terminal_session_stop
 */
export interface TerminalSessionStopOutput {
	sessionId: string
	stopped: boolean
}

/**
 * terminal_session_stop tool definition
 */
export const terminalSessionStopTool: ToolDefinition<TerminalSessionStopInput, TerminalSessionStopOutput> = {
	name: 'terminal_session_stop',
	description: 'Stop a running terminal session. Use to clean up dev servers or long-running processes.',
	schema: terminalSessionStopSchema,

	async execute(input: TerminalSessionStopInput, context: ToolContext): Promise<ToolResult<TerminalSessionStopOutput>> {
		const { sessionId } = input

		try {
			await context.provider.stopSession({ id: sessionId })

			return successResult({
				sessionId,
				stopped: true
			})
		} catch (error) {
			if (CodeAgentError.isCodeAgentError(error)) {
				// If session doesn't exist, consider it stopped
				if (error.code === 'INVALID_STATE') {
					return successResult({
						sessionId,
						stopped: true
					})
				}
				return errorResult(error.message, {
					errorCode: error.code,
					recoverable: error.recoverable
				})
			}

			return errorResult(`Failed to stop session: ${error instanceof Error ? error.message : String(error)}`, {
				errorCode: 'EXECUTION_FAILED',
				recoverable: true
			})
		}
	}
}
