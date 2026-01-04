/**
 * fs_read_tail tool - Read the last N bytes of a file
 */

import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js'
import { successResult, errorResult } from '../types.js'
import { checkFilePolicy } from '../runtime/policy.js'
import { CodeAgentError } from '../../errors/index.js'

/**
 * Default max bytes for tail reads
 */
const DEFAULT_MAX_BYTES = 32_768 // 32KB

/**
 * Input schema for fs_read_tail
 */
export const fsReadTailSchema = z.object({
	path: z.string().describe('Path to the file'),
	maxBytes: z.number().min(1).optional().default(DEFAULT_MAX_BYTES).describe('Maximum bytes to read')
})

export type FsReadTailInput = z.infer<typeof fsReadTailSchema>

/**
 * Output type for fs_read_tail
 */
export interface FsReadTailOutput {
	path: string
	text: string
	size: number
	totalSize: number
	truncated: boolean
}

/**
 * fs_read_tail tool definition
 */
export const fsReadTailTool: ToolDefinition<FsReadTailInput, FsReadTailOutput> = {
	name: 'fs_read_tail',
	description: 'Read the last N bytes of a file. Useful for viewing log file endings.',
	schema: fsReadTailSchema,

	async execute(input: FsReadTailInput, context: ToolContext): Promise<ToolResult<FsReadTailOutput>> {
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

			// Slice from end
			const startOffset = Math.max(0, totalSize - maxBytes)
			const sliced = bytes.slice(startOffset)
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

			return errorResult(`Failed to read tail: ${error instanceof Error ? error.message : String(error)}`, {
				errorCode: 'EXECUTION_FAILED',
				recoverable: true
			})
		}
	}
}
