/**
 * fs_stat tool - Get file metadata
 */

import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js'
import { successResult, errorResult } from '../types.js'
import { checkFilePolicy } from '../runtime/policy.js'
import { CodeAgentError } from '../../errors/index.js'

/**
 * Input schema for fs_stat
 */
export const fsStatSchema = z.object({
	path: z.string().describe('Path to the file or directory')
})

export type FsStatInput = z.infer<typeof fsStatSchema>

/**
 * Output type for fs_stat
 */
export interface FsStatOutput {
	path: string
	size: number
	isDirectory: boolean
	mtimeMs?: number
}

/**
 * fs_stat tool definition
 */
export const fsStatTool: ToolDefinition<FsStatInput, FsStatOutput> = {
	name: 'fs_stat',
	description: 'Get file or directory metadata including size. Use before reading large files to check size.',
	schema: fsStatSchema,

	async execute(input: FsStatInput, context: ToolContext): Promise<ToolResult<FsStatOutput>> {
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
			const stat = await context.provider.stat(path)

			return successResult({
				path,
				size: stat.size,
				isDirectory: stat.isDirectory ?? false,
				mtimeMs: stat.mtimeMs
			})
		} catch (error) {
			if (CodeAgentError.isCodeAgentError(error)) {
				return errorResult(error.message, {
					errorCode: error.code,
					recoverable: error.recoverable
				})
			}

			return errorResult(`Failed to stat: ${error instanceof Error ? error.message : String(error)}`, {
				errorCode: 'EXECUTION_FAILED',
				recoverable: true
			})
		}
	}
}
