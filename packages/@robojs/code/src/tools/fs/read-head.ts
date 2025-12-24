/**
 * fs_read_head tool - Read the first N bytes of a file
 */

import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js'
import { successResult, errorResult } from '../types.js'
import { checkFilePolicy } from '../runtime/policy.js'
import { CodeAgentError } from '../../errors/index.js'

/**
 * Default max bytes for head reads
 */
const DEFAULT_MAX_BYTES = 32_768 // 32KB

/**
 * Input schema for fs_read_head
 */
export const fsReadHeadSchema = z.object({
	path: z.string().describe('Path to the file'),
	maxBytes: z.number().min(1).optional().default(DEFAULT_MAX_BYTES).describe('Maximum bytes to read')
})

export type FsReadHeadInput = z.infer<typeof fsReadHeadSchema>

/**
 * Output type for fs_read_head
 */
export interface FsReadHeadOutput {
	path: string
	text: string
	size: number
	totalSize: number
	truncated: boolean
}

/**
 * fs_read_head tool definition
 */
export const fsReadHeadTool: ToolDefinition<FsReadHeadInput, FsReadHeadOutput> = {
	name: 'fs_read_head',
	description: 'Read the first N bytes of a file. Useful for previewing large files.',
	schema: fsReadHeadSchema,

	async execute(input: FsReadHeadInput, context: ToolContext): Promise<ToolResult<FsReadHeadOutput>> {
		const { path, maxBytes } = input

		// Check policy
		const policyCheck = checkFilePolicy({ path, operation: 'read' }, context.policy)
		if (!policyCheck.allowed) {
			return errorResult(policyCheck.reason!, {
				errorCode: 'POLICY_VIOLATION',
				recoverable: false
			})
		}

		try {
			// Get file stat for stale detection tracking
			let mtimeMs: number | null = null
			try {
				const stat = await context.provider.stat(path)
				mtimeMs = stat.mtimeMs ?? null
			} catch {
				// Stat failed but file might still be readable
			}

			const content = await context.provider.readFile(path)
			const bytes = new TextEncoder().encode(content)
			const totalSize = bytes.length

			// Record read snapshot for stale detection
			if (context.fileTracker) {
				context.fileTracker.record({
					path,
					mtimeMs,
					size: totalSize,
					readAt: Date.now(),
					exists: true
				})
			}

			// Slice to maxBytes
			const sliced = bytes.slice(0, maxBytes)
			const text = new TextDecoder().decode(sliced)
			const truncated = totalSize > maxBytes

			return successResult({
				path,
				text,
				size: sliced.length,
				totalSize,
				truncated
			})
		} catch (error) {
			if (CodeAgentError.isCodeAgentError(error)) {
				return errorResult(error.message, {
					errorCode: error.code,
					recoverable: error.recoverable
				})
			}

			return errorResult(`Failed to read head: ${error instanceof Error ? error.message : String(error)}`, {
				errorCode: 'EXECUTION_FAILED',
				recoverable: true
			})
		}
	}
}
