/**
 * fs_write tool - Write content to a file
 */

import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js'
import { successResult, errorResult } from '../types.js'
import { checkFilePolicy } from '../runtime/policy.js'
import { CodeAgentError } from '../../errors/index.js'
import { codeLogger } from '../../core/logger.js'

/**
 * Input schema for fs_write
 */
export const fsWriteSchema = z.object({
	path: z.string().describe('Path to the file to write'),
	content: z.string().describe('Content to write to the file')
})

export type FsWriteInput = z.infer<typeof fsWriteSchema>

/**
 * Output type for fs_write
 */
export interface FsWriteOutput {
	path: string
	size: number
	created: boolean
}

/**
 * fs_write tool definition
 */
export const fsWriteTool: ToolDefinition<FsWriteInput, FsWriteOutput> = {
	name: 'fs_write',
	description: 'Write content to a file. Creates the file if it does not exist, or overwrites if it does.',
	schema: fsWriteSchema,
	mutates: true,

	async execute(input: FsWriteInput, context: ToolContext): Promise<ToolResult<FsWriteOutput>> {
		const { path, content } = input
		const size = new TextEncoder().encode(content).length

		// Check policy
		const policyCheck = checkFilePolicy({ path, operation: 'write', size }, context.policy)
		if (!policyCheck.allowed) {
			return errorResult(policyCheck.reason!, {
				errorCode: 'POLICY_VIOLATION',
				recoverable: false
			})
		}

		try {
			// Check if file exists before writing
			const existed = await context.provider.exists(path)

			codeLogger.debug('[fs_write] Writing file', {
				path,
				contentLength: content.length,
				contentPreview: content.slice(0, 200) + (content.length > 200 ? '...' : ''),
				lineCount: content.split('\n').length,
				existed
			})

			await context.provider.writeFile(path, content)

			codeLogger.debug('[fs_write] File written successfully', { path, size })

			return successResult({
				path,
				size,
				created: !existed
			})
		} catch (error) {
			codeLogger.error('[fs_write] Failed to write file', {
				path,
				error: error instanceof Error ? error.message : String(error)
			})
			if (CodeAgentError.isCodeAgentError(error)) {
				return errorResult(error.message, {
					errorCode: error.code,
					recoverable: error.recoverable
				})
			}

			return errorResult(`Failed to write file: ${error instanceof Error ? error.message : String(error)}`, {
				errorCode: 'EXECUTION_FAILED',
				recoverable: true
			})
		}
	}
}
