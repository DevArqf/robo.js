/**
 * fs_delete tool - Delete a file or directory
 */

import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js'
import { successResult, errorResult } from '../types.js'
import { checkFilePolicy } from '../runtime/policy.js'
import { CodeAgentError } from '../../errors/index.js'

/**
 * Input schema for fs_delete
 */
export const fsDeleteSchema = z.object({
	path: z.string().describe('Path to the file or directory to delete'),
	recursive: z.boolean().default(false).describe('Delete directories recursively')
})

export type FsDeleteInput = z.output<typeof fsDeleteSchema>

/**
 * Output type for fs_delete
 */
export interface FsDeleteOutput {
	path: string
	deleted: boolean
}

/**
 * fs_delete tool definition
 */
export const fsDeleteTool: ToolDefinition<FsDeleteInput, FsDeleteOutput> = {
	name: 'fs_delete',
	description: 'Delete a file or directory. Use recursive=true for directories with contents.',
	schema: fsDeleteSchema,
	mutates: true,

	async execute(input: FsDeleteInput, context: ToolContext): Promise<ToolResult<FsDeleteOutput>> {
		const { path, recursive } = input

		// Check policy
		const policyCheck = checkFilePolicy({ path, operation: 'delete' }, context.policy)
		if (!policyCheck.allowed) {
			return errorResult(policyCheck.reason!, {
				errorCode: 'POLICY_VIOLATION',
				recoverable: false
			})
		}

		try {
			// Check if path exists
			const exists = await context.provider.exists(path)
			if (!exists) {
				return successResult({
					path,
					deleted: false
				})
			}

			await context.provider.deletePath(path, { recursive })

			return successResult({
				path,
				deleted: true
			})
		} catch (error) {
			if (CodeAgentError.isCodeAgentError(error)) {
				return errorResult(error.message, {
					errorCode: error.code,
					recoverable: error.recoverable
				})
			}

			return errorResult(`Failed to delete: ${error instanceof Error ? error.message : String(error)}`, {
				errorCode: 'EXECUTION_FAILED',
				recoverable: true
			})
		}
	}
}
