/**
 * fs_read_range tool - Read a byte range from a file
 */

import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js'
import { successResult, errorResult } from '../types.js'
import { checkFilePolicy } from '../runtime/policy.js'
import { CodeAgentError } from '../../errors/index.js'

/**
 * Input schema for fs_read_range
 */
export const fsReadRangeSchema = z.object({
	path: z.string().describe('Path to the file'),
	offset: z.number().min(0).describe('Byte offset to start reading from'),
	length: z.number().min(1).describe('Number of bytes to read')
})

export type FsReadRangeInput = z.infer<typeof fsReadRangeSchema>

/**
 * Output type for fs_read_range
 */
export interface FsReadRangeOutput {
	path: string
	text: string
	offset: number
	length: number
	totalSize: number
	truncated: boolean
}

/**
 * fs_read_range tool definition
 */
export const fsReadRangeTool: ToolDefinition<FsReadRangeInput, FsReadRangeOutput> = {
	name: 'fs_read_range',
	description: 'Read a specific byte range from a file. Use fs_stat first to determine file size.',
	schema: fsReadRangeSchema,

	async execute(input: FsReadRangeInput, context: ToolContext): Promise<ToolResult<FsReadRangeOutput>> {
		const { path, offset, length } = input

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

			// Read full file and extract range
			// Note: Provider doesn't have native range support, so we read and slice
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

			// Calculate actual range
			const actualOffset = Math.min(offset, totalSize)
			const actualLength = Math.min(length, totalSize - actualOffset)
			const sliced = bytes.slice(actualOffset, actualOffset + actualLength)
			const text = new TextDecoder().decode(sliced)

			// Check if we hit the end or length limit
			const truncated = actualOffset + actualLength < totalSize && actualLength === length

			return successResult({
				path,
				text,
				offset: actualOffset,
				length: sliced.length,
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

			return errorResult(`Failed to read range: ${error instanceof Error ? error.message : String(error)}`, {
				errorCode: 'EXECUTION_FAILED',
				recoverable: true
			})
		}
	}
}
