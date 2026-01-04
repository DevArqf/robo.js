/**
 * fs_snapshot tool - Get a snapshot of project files
 */

import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js'
import { successResult, errorResult } from '../types.js'
import { checkSnapshotPolicy } from '../runtime/policy.js'
import { CodeAgentError } from '../../errors/index.js'
import { matchesDenyPath } from '../../providers/utils/path.js'

/**
 * Input schema for fs_snapshot
 */
export const fsSnapshotSchema = z.object({
	paths: z.array(z.string()).optional().describe('Specific paths to include'),
	maxBytes: z.number().optional().describe('Maximum total bytes for snapshot'),
	excludePatterns: z.array(z.string()).optional().describe('Patterns to exclude')
})

export type FsSnapshotInput = z.infer<typeof fsSnapshotSchema>

/**
 * Output type for fs_snapshot
 */
export interface FsSnapshotOutput {
	files: Record<string, string>
	fileCount: number
	totalBytes: number
	truncated: boolean
}

/**
 * fs_snapshot tool definition
 */
export const fsSnapshotTool: ToolDefinition<FsSnapshotInput, FsSnapshotOutput> = {
	name: 'fs_snapshot',
	description: 'Get a snapshot of project files. Useful for understanding project structure. Limited by size policy.',
	schema: fsSnapshotSchema,

	async execute(input: FsSnapshotInput, context: ToolContext): Promise<ToolResult<FsSnapshotOutput>> {
		const { paths, maxBytes, excludePatterns } = input

		// Get max bytes from policy or input
		const policyMaxBytes = context.policy.maxSnapshotBytes ?? 2_000_000
		const effectiveMaxBytes = Math.min(maxBytes ?? policyMaxBytes, policyMaxBytes)

		try {
			const files = await context.provider.snapshot({
				paths,
				maxBytes: effectiveMaxBytes,
				excludePatterns
			})

			// Filter deny paths at tool layer (policy enforcement)
			const denyPaths = context.policy.denyPaths ?? []
			const filteredFiles: Record<string, string> = {}
			for (const [filePath, content] of Object.entries(files)) {
				if (!matchesDenyPath(filePath, denyPaths)) {
					filteredFiles[filePath] = content
				}
			}

			// Calculate total bytes
			let totalBytes = 0
			for (const content of Object.values(filteredFiles)) {
				totalBytes += new TextEncoder().encode(content).length
			}

			// Check if we hit the limit
			const truncated = totalBytes >= effectiveMaxBytes

			// Verify against policy
			const policyCheck = checkSnapshotPolicy(totalBytes, context.policy)
			if (!policyCheck.allowed) {
				return errorResult(policyCheck.reason!, {
					errorCode: 'POLICY_VIOLATION',
					recoverable: false
				})
			}

			return successResult({
				files: filteredFiles,
				fileCount: Object.keys(filteredFiles).length,
				totalBytes,
				truncated
			})
		} catch (error) {
			if (CodeAgentError.isCodeAgentError(error)) {
				return errorResult(error.message, {
					errorCode: error.code,
					recoverable: error.recoverable
				})
			}

			return errorResult(`Snapshot failed: ${error instanceof Error ? error.message : String(error)}`, {
				errorCode: 'EXECUTION_FAILED',
				recoverable: true
			})
		}
	}
}
