/**
 * Error model for @robojs/code SDK
 */

/**
 * Error codes for CodeAgentError
 */
export type ErrorCode =
	| 'EXECUTION_FAILED' // Command or file operation failed
	| 'PATH_TRAVERSAL' // Attempted path traversal attack
	| 'POLICY_VIOLATION' // Violated agent policy (denyPaths, maxBytes, etc.)
	| 'COMMAND_DENIED' // Command not in allowlist or blocked by arg policy
	| 'APPROVAL_REQUIRED' // Action requires user approval
	| 'BUDGET_EXCEEDED' // Exceeded maxIterations
	| 'VERIFICATION_FAILED' // Build/test/mock verification failed
	| 'MCP_UNAVAILABLE' // MCP server not available
	| 'CHECKPOINTER_ERROR' // Checkpointer save/load failed
	| 'ABORT' // Run was aborted
	| 'INVALID_STATE' // Agent in invalid state for operation
	| 'TIMEOUT' // Operation timed out
	| 'PARSE_ERROR' // Failed to parse response or file

/**
 * Options for CodeAgentError construction
 */
export interface CodeAgentErrorOptions {
	/**
	 * Whether the error is recoverable (agent can retry)
	 */
	recoverable?: boolean

	/**
	 * Additional error details
	 */
	details?: unknown

	/**
	 * Original error if wrapping
	 */
	cause?: Error
}

/**
 * Custom error class for @robojs/code SDK
 *
 * Provides structured error information for handling and display.
 */
export class CodeAgentError extends Error {
	/**
	 * Error code for programmatic handling
	 */
	readonly code: ErrorCode

	/**
	 * Whether the error is recoverable (agent can retry)
	 */
	readonly recoverable: boolean

	/**
	 * Additional error details
	 */
	readonly details?: unknown

	constructor(code: ErrorCode, message: string, options?: CodeAgentErrorOptions) {
		super(message, { cause: options?.cause })
		this.name = 'CodeAgentError'
		this.code = code
		this.recoverable = options?.recoverable ?? false
		this.details = options?.details
	}

	/**
	 * Create a JSON-serializable representation
	 */
	toJSON(): Record<string, unknown> {
		return {
			name: this.name,
			code: this.code,
			message: this.message,
			recoverable: this.recoverable,
			details: this.details,
			stack: this.stack
		}
	}

	/**
	 * Check if an error is a CodeAgentError
	 */
	static isCodeAgentError(error: unknown): error is CodeAgentError {
		return error instanceof CodeAgentError
	}

	/**
	 * Wrap an unknown error as a CodeAgentError
	 */
	static wrap(error: unknown, code: ErrorCode = 'EXECUTION_FAILED'): CodeAgentError {
		if (error instanceof CodeAgentError) {
			return error
		}

		if (error instanceof Error) {
			return new CodeAgentError(code, error.message, {
				cause: error,
				details: { originalName: error.name }
			})
		}

		return new CodeAgentError(code, String(error), {
			details: { originalValue: error }
		})
	}
}

/**
 * Create a path traversal error
 */
export function pathTraversalError(path: string): CodeAgentError {
	return new CodeAgentError('PATH_TRAVERSAL', `Path traversal attempt detected: ${path}`, {
		recoverable: false,
		details: { path }
	})
}

/**
 * Create a policy violation error
 */
export function policyViolationError(message: string, details?: unknown): CodeAgentError {
	return new CodeAgentError('POLICY_VIOLATION', message, {
		recoverable: false,
		details
	})
}

/**
 * Create a command denied error
 */
export function commandDeniedError(command: string, args: string[], reason: string): CodeAgentError {
	return new CodeAgentError('COMMAND_DENIED', `Command denied: ${command} ${args.join(' ')} - ${reason}`, {
		recoverable: false,
		details: { command, args, reason }
	})
}

/**
 * Create a budget exceeded error
 */
export function budgetExceededError(iterations: number, maxIterations: number): CodeAgentError {
	return new CodeAgentError('BUDGET_EXCEEDED', `Budget exceeded: ${iterations}/${maxIterations} iterations`, {
		recoverable: false,
		details: { iterations, maxIterations }
	})
}

/**
 * Create an abort error
 */
export function abortError(reason: string): CodeAgentError {
	return new CodeAgentError('ABORT', `Run aborted: ${reason}`, {
		recoverable: false,
		details: { reason }
	})
}
