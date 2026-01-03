/**
 * Tool registry for @robojs/code SDK
 *
 * Manages registration and lookup of available tools.
 * Provides JSON Schema generation for LLM tool binding.
 */

import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { ToolDefinition, ToolRegistry, ToolSchema } from '../types.js'
import { codeLogger } from '../../core/logger.js'

/**
 * Default tool registry implementation
 */
export class DefaultToolRegistry implements ToolRegistry {
	private tools: Map<string, ToolDefinition> = new Map()

	/**
	 * Register a tool
	 */
	register<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): void {
		if (this.tools.has(tool.name)) {
			codeLogger.warn(`Tool '${tool.name}' is already registered, overwriting`)
		}

		this.tools.set(tool.name, tool as ToolDefinition)
		codeLogger.debug(`Registered tool: ${tool.name}`)
	}

	/**
	 * Get a tool by name
	 */
	get(name: string): ToolDefinition | undefined {
		return this.tools.get(name)
	}

	/**
	 * Get all registered tools
	 */
	getAll(): ToolDefinition[] {
		return Array.from(this.tools.values())
	}

	/**
	 * Get tool schemas for LLM binding
	 */
	getSchemas(): ToolSchema[] {
		return this.getAll().map((tool) => ({
			name: tool.name,
			description: tool.description,
			// Use 'as any' for compatibility between Zod 4 and zod-to-json-schema types
			parameters: zodToJsonSchema(tool.schema as any, { target: 'openApi3' })
		}))
	}

	/**
	 * Check if a tool exists
	 */
	has(name: string): boolean {
		return this.tools.has(name)
	}

	/**
	 * Remove a tool
	 */
	unregister(name: string): boolean {
		const existed = this.tools.delete(name)
		if (existed) {
			codeLogger.debug(`Unregistered tool: ${name}`)
		}
		return existed
	}

	/**
	 * Get the number of registered tools
	 */
	size(): number {
		return this.tools.size
	}

	/**
	 * Clear all registered tools
	 */
	clear(): void {
		this.tools.clear()
		codeLogger.debug('Cleared all tools from registry')
	}
}

/**
 * Create a new tool registry
 */
export function createToolRegistry(): ToolRegistry {
	return new DefaultToolRegistry()
}

/**
 * Helper to convert Zod schema to JSON Schema for LLM binding
 */
export function schemaToJsonSchema(schema: z.ZodSchema): Record<string, unknown> {
	// Use 'as any' for compatibility between Zod 4 and zod-to-json-schema types
	return zodToJsonSchema(schema as any, { target: 'openApi3' })
}
