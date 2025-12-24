/**
 * fs_read tool - Read file content
 */

import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js'
import { successResult, errorResult } from '../types.js'
import { checkFilePolicy } from '../runtime/policy.js'
import { CodeAgentError } from '../../errors/index.js'

/**
 * Input schema for fs_read
 */
export const fsReadSchema = z.object({
	path: z.string().describe('Path to the file to read')
})

export type FsReadInput = z.infer<typeof fsReadSchema>

/**
 * Output type for fs_read
 */
export interface FsReadOutput {
	path: string
	content: string
	size: number
}

/**
 * fs_read tool definition
 */
export const fsReadTool: ToolDefinition<FsReadInput, FsReadOutput> = {
	name: 'fs_read',
	description: 'Read the content of a file. Returns the file content as a string.',
	schema: fsReadSchema,

	async execute(input: FsReadInput, context: ToolContext): Promise<ToolResult<FsReadOutput>> {
		const { path } = input

		// Check policy
		const policyCheck = checkFilePolicy({ path, operation: 'read' }, context.policy)
		if (!policyCheck.allowed) {
			return errorResult(policyCheck.reason!, {
				errorCode: 'POLICY_VIOLATION',
				recoverable: false
			})
		}

		try {
			const content = await context.provider.readFile(path)
			const size = new TextEncoder().encode(content).length

			return successResult({
				path,
				content,
				size
			})
		} catch (error) {
			if (CodeAgentError.isCodeAgentError(error)) {
				return errorResult(error.message, {
					errorCode: error.code,
					recoverable: error.recoverable
				})
			}

			return errorResult(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`, {
				errorCode: 'EXECUTION_FAILED',
				recoverable: true
			})
		}
	}
}
