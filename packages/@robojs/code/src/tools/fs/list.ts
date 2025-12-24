/**
 * fs_list tool - List directory contents
 */

import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js'
import { successResult, errorResult } from '../types.js'
import { checkFilePolicy } from '../runtime/policy.js'
import { CodeAgentError } from '../../errors/index.js'
import { matchesDenyPath } from '../../providers/utils/path.js'

/**
 * Input schema for fs_list
 */
export const fsListSchema = z.object({
	path: z.string().optional().default('/').describe('Directory path to list'),
	recursive: z.boolean().optional().default(false).describe('List contents recursively')
})

export type FsListInput = z.infer<typeof fsListSchema>

/**
 * Directory entry type
 */
export interface ListEntry {
	name: string
	path: string
	type: 'file' | 'directory'
}

/**
 * Output type for fs_list
 */
export interface FsListOutput {
	path: string
	entries: ListEntry[]
	count: number
}

/**
 * fs_list tool definition
 */
export const fsListTool: ToolDefinition<FsListInput, FsListOutput> = {
	name: 'fs_list',
	description: 'List contents of a directory. Returns files and subdirectories.',
	schema: fsListSchema,

	async execute(input: FsListInput, context: ToolContext): Promise<ToolResult<FsListOutput>> {
		const { path, recursive } = input

		// Check policy
		const policyCheck = checkFilePolicy({ path, operation: 'list' }, context.policy)
		if (!policyCheck.allowed) {
			return errorResult(policyCheck.reason!, {
				errorCode: 'POLICY_VIOLATION',
				recoverable: false
			})
		}

		try {
			const dirEntries = await context.provider.readdir(path, { recursive })
			const denyPaths = context.policy.denyPaths ?? []

			// Filter and convert to output format (policy enforcement at tool layer)
			const entries: ListEntry[] = dirEntries
				.filter((entry) => !matchesDenyPath(entry.path, denyPaths))
				.map((entry) => ({
					name: entry.name,
					path: entry.path,
					type: entry.isDirectory ? 'directory' : 'file'
				}))

			return successResult({
				path,
				entries,
				count: entries.length
			})
		} catch (error) {
			if (CodeAgentError.isCodeAgentError(error)) {
				return errorResult(error.message, {
					errorCode: error.code,
					recoverable: error.recoverable
				})
			}

			return errorResult(`Failed to list directory: ${error instanceof Error ? error.message : String(error)}`, {
				errorCode: 'EXECUTION_FAILED',
				recoverable: true
			})
		}
	}
}
