/**
 * fs_read_many tool - Read multiple files at once
 */

import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js'
import { successResult, errorResult } from '../types.js'
import { checkFilePolicy } from '../runtime/policy.js'
import { CodeAgentError } from '../../errors/index.js'

/**
 * Input schema for fs_read_many
 */
export const fsReadManySchema = z.object({
	paths: z.array(z.string()).describe('Array of file paths to read')
})

export type FsReadManyInput = z.infer<typeof fsReadManySchema>

/**
 * Output type for fs_read_many
 */
export interface FsReadManyOutput {
	files: Array<{
		path: string
		content?: string
		size?: number
		error?: string
	}>
	successCount: number
	errorCount: number
}

/**
 * fs_read_many tool definition
 */
export const fsReadManyTool: ToolDefinition<FsReadManyInput, FsReadManyOutput> = {
	name: 'fs_read_many',
	description: 'Read multiple files at once. Returns content for each file, with errors for files that could not be read.',
	schema: fsReadManySchema,

	async execute(input: FsReadManyInput, context: ToolContext): Promise<ToolResult<FsReadManyOutput>> {
		const { paths } = input

		if (paths.length === 0) {
			return errorResult('No paths provided', {
				errorCode: 'INVALID_ARGS',
				recoverable: false
			})
		}

		// Check all paths first - reject entire batch if any path is denied
		// This prevents information leakage about whether denied files exist
		const deniedPaths: string[] = []
		for (const path of paths) {
			const policyCheck = checkFilePolicy({ path, operation: 'read' }, context.policy)
			if (!policyCheck.allowed) {
				deniedPaths.push(path)
			}
		}

		if (deniedPaths.length > 0) {
			return errorResult(`Access denied to paths: ${deniedPaths.join(', ')}`, {
				errorCode: 'POLICY_VIOLATION',
				recoverable: false
			})
		}

		// All paths passed policy check, now read them
		const files: FsReadManyOutput['files'] = []
		let successCount = 0
		let errorCount = 0

		for (const path of paths) {
			try {
				const content = await context.provider.readFile(path)
				const size = new TextEncoder().encode(content).length
				files.push({ path, content, size })
				successCount++
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error)
				files.push({ path, error: message })
				errorCount++
			}
		}

		return successResult({
			files,
			successCount,
			errorCount
		})
	}
}
