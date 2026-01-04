/**
 * Unit tests for CodeAgentError and error factory functions
 *
 * Tests error construction, serialization, and static utility methods.
 */

import {
	CodeAgentError,
	pathTraversalError,
	policyViolationError,
	commandDeniedError,
	budgetExceededError,
	abortError,
	type ErrorCode
} from '../../src/errors/index.js'

describe('CodeAgentError', () => {
	describe('constructor', () => {
		it('should create error with code and message', () => {
			const error = new CodeAgentError('EXECUTION_FAILED', 'Command failed')

			expect(error.code).toBe('EXECUTION_FAILED')
			expect(error.message).toBe('Command failed')
			expect(error.name).toBe('CodeAgentError')
			expect(error.recoverable).toBe(false)
			expect(error.details).toBeUndefined()
		})

		it('should set recoverable flag', () => {
			const error = new CodeAgentError('TIMEOUT', 'Operation timed out', {
				recoverable: true
			})

			expect(error.recoverable).toBe(true)
		})

		it('should set details', () => {
			const details = { path: '/test/file.txt', reason: 'Not found' }
			const error = new CodeAgentError('EXECUTION_FAILED', 'File not found', {
				details
			})

			expect(error.details).toEqual(details)
		})

		it('should set cause', () => {
			const originalError = new Error('Original error')
			const error = new CodeAgentError('EXECUTION_FAILED', 'Wrapped error', {
				cause: originalError
			})

			expect(error.cause).toBe(originalError)
		})

		it('should support all error codes', () => {
			const codes: ErrorCode[] = [
				'EXECUTION_FAILED',
				'PATH_TRAVERSAL',
				'POLICY_VIOLATION',
				'COMMAND_DENIED',
				'APPROVAL_REQUIRED',
				'BUDGET_EXCEEDED',
				'VERIFICATION_FAILED',
				'MCP_UNAVAILABLE',
				'CHECKPOINTER_ERROR',
				'ABORT',
				'INVALID_STATE',
				'TIMEOUT',
				'PARSE_ERROR'
			]

			for (const code of codes) {
				const error = new CodeAgentError(code, `Test ${code}`)
				expect(error.code).toBe(code)
			}
		})

		it('should extend Error', () => {
			const error = new CodeAgentError('EXECUTION_FAILED', 'Test error')

			expect(error instanceof Error).toBe(true)
			expect(error instanceof CodeAgentError).toBe(true)
		})

		it('should have stack trace', () => {
			const error = new CodeAgentError('EXECUTION_FAILED', 'Test error')

			expect(error.stack).toBeDefined()
			expect(error.stack).toContain('CodeAgentError')
		})
	})

	describe('toJSON', () => {
		it('should return JSON-serializable object', () => {
			const error = new CodeAgentError('EXECUTION_FAILED', 'Test error', {
				recoverable: true,
				details: { key: 'value' }
			})

			const json = error.toJSON()

			expect(json.name).toBe('CodeAgentError')
			expect(json.code).toBe('EXECUTION_FAILED')
			expect(json.message).toBe('Test error')
			expect(json.recoverable).toBe(true)
			expect(json.details).toEqual({ key: 'value' })
			expect(json.stack).toBeDefined()
		})

		it('should be JSON.stringify compatible', () => {
			const error = new CodeAgentError('PATH_TRAVERSAL', 'Bad path', {
				details: { path: '../etc/passwd' }
			})

			const jsonString = JSON.stringify(error.toJSON())
			const parsed = JSON.parse(jsonString)

			expect(parsed.code).toBe('PATH_TRAVERSAL')
			expect(parsed.message).toBe('Bad path')
			expect(parsed.details.path).toBe('../etc/passwd')
		})

		it('should handle undefined details', () => {
			const error = new CodeAgentError('ABORT', 'Aborted')

			const json = error.toJSON()

			expect(json.details).toBeUndefined()
		})
	})

	describe('isCodeAgentError', () => {
		it('should return true for CodeAgentError instance', () => {
			const error = new CodeAgentError('EXECUTION_FAILED', 'Test')

			expect(CodeAgentError.isCodeAgentError(error)).toBe(true)
		})

		it('should return false for regular Error', () => {
			const error = new Error('Test')

			expect(CodeAgentError.isCodeAgentError(error)).toBe(false)
		})

		it('should return false for non-Error objects', () => {
			expect(CodeAgentError.isCodeAgentError({})).toBe(false)
			expect(CodeAgentError.isCodeAgentError(null)).toBe(false)
			expect(CodeAgentError.isCodeAgentError(undefined)).toBe(false)
			expect(CodeAgentError.isCodeAgentError('error string')).toBe(false)
			expect(CodeAgentError.isCodeAgentError(42)).toBe(false)
		})

		it('should return false for error-like objects', () => {
			const fakeError = {
				name: 'CodeAgentError',
				code: 'EXECUTION_FAILED',
				message: 'Fake error'
			}

			expect(CodeAgentError.isCodeAgentError(fakeError)).toBe(false)
		})
	})

	describe('wrap', () => {
		it('should return same error if already CodeAgentError', () => {
			const original = new CodeAgentError('TIMEOUT', 'Timed out')
			const wrapped = CodeAgentError.wrap(original)

			expect(wrapped).toBe(original)
		})

		it('should wrap regular Error', () => {
			const original = new Error('Original message')
			const wrapped = CodeAgentError.wrap(original)

			expect(wrapped.code).toBe('EXECUTION_FAILED')
			expect(wrapped.message).toBe('Original message')
			expect(wrapped.cause).toBe(original)
			expect(wrapped.details).toEqual({ originalName: 'Error' })
		})

		it('should wrap Error with custom code', () => {
			const original = new Error('Something failed')
			const wrapped = CodeAgentError.wrap(original, 'VERIFICATION_FAILED')

			expect(wrapped.code).toBe('VERIFICATION_FAILED')
			expect(wrapped.message).toBe('Something failed')
		})

		it('should wrap TypeError', () => {
			const original = new TypeError('Invalid type')
			const wrapped = CodeAgentError.wrap(original)

			expect(wrapped.code).toBe('EXECUTION_FAILED')
			expect(wrapped.message).toBe('Invalid type')
			expect(wrapped.details).toEqual({ originalName: 'TypeError' })
		})

		it('should wrap string', () => {
			const wrapped = CodeAgentError.wrap('Something went wrong')

			expect(wrapped.code).toBe('EXECUTION_FAILED')
			expect(wrapped.message).toBe('Something went wrong')
			expect(wrapped.details).toEqual({ originalValue: 'Something went wrong' })
		})

		it('should wrap number', () => {
			const wrapped = CodeAgentError.wrap(404)

			expect(wrapped.code).toBe('EXECUTION_FAILED')
			expect(wrapped.message).toBe('404')
			expect(wrapped.details).toEqual({ originalValue: 404 })
		})

		it('should wrap null', () => {
			const wrapped = CodeAgentError.wrap(null)

			expect(wrapped.code).toBe('EXECUTION_FAILED')
			expect(wrapped.message).toBe('null')
			expect(wrapped.details).toEqual({ originalValue: null })
		})

		it('should wrap undefined', () => {
			const wrapped = CodeAgentError.wrap(undefined)

			expect(wrapped.code).toBe('EXECUTION_FAILED')
			expect(wrapped.message).toBe('undefined')
			expect(wrapped.details).toEqual({ originalValue: undefined })
		})

		it('should wrap object', () => {
			const obj = { error: 'Something failed', code: 500 }
			const wrapped = CodeAgentError.wrap(obj)

			expect(wrapped.code).toBe('EXECUTION_FAILED')
			expect(wrapped.message).toBe('[object Object]')
			expect(wrapped.details).toEqual({ originalValue: obj })
		})
	})
})

describe('Error Factory Functions', () => {
	describe('pathTraversalError', () => {
		it('should create PATH_TRAVERSAL error', () => {
			const error = pathTraversalError('../etc/passwd')

			expect(error.code).toBe('PATH_TRAVERSAL')
			expect(error.message).toContain('../etc/passwd')
			expect(error.recoverable).toBe(false)
			expect(error.details).toEqual({ path: '../etc/passwd' })
		})

		it('should include path in message', () => {
			const error = pathTraversalError('../../secret/file.txt')

			expect(error.message).toBe('Path traversal attempt detected: ../../secret/file.txt')
		})
	})

	describe('policyViolationError', () => {
		it('should create POLICY_VIOLATION error', () => {
			const error = policyViolationError('File exceeds max size')

			expect(error.code).toBe('POLICY_VIOLATION')
			expect(error.message).toBe('File exceeds max size')
			expect(error.recoverable).toBe(false)
		})

		it('should include details if provided', () => {
			const details = { maxSize: 1000, actualSize: 5000 }
			const error = policyViolationError('File too large', details)

			expect(error.details).toEqual(details)
		})

		it('should handle no details', () => {
			const error = policyViolationError('Policy violated')

			expect(error.details).toBeUndefined()
		})
	})

	describe('commandDeniedError', () => {
		it('should create COMMAND_DENIED error', () => {
			const error = commandDeniedError('rm', ['-rf', '/'], 'Dangerous command')

			expect(error.code).toBe('COMMAND_DENIED')
			expect(error.message).toContain('rm')
			expect(error.message).toContain('-rf')
			expect(error.message).toContain('Dangerous command')
			expect(error.recoverable).toBe(false)
		})

		it('should include command details', () => {
			const error = commandDeniedError('curl', ['http://malicious.com'], 'Not in allowlist')

			expect(error.details).toEqual({
				command: 'curl',
				args: ['http://malicious.com'],
				reason: 'Not in allowlist'
			})
		})

		it('should handle empty args', () => {
			const error = commandDeniedError('sudo', [], 'Elevated privileges')

			expect(error.message).toBe('Command denied: sudo  - Elevated privileges')
			expect(error.details).toEqual({
				command: 'sudo',
				args: [],
				reason: 'Elevated privileges'
			})
		})
	})

	describe('budgetExceededError', () => {
		it('should create BUDGET_EXCEEDED error', () => {
			const error = budgetExceededError(100, 50)

			expect(error.code).toBe('BUDGET_EXCEEDED')
			expect(error.message).toContain('100')
			expect(error.message).toContain('50')
			expect(error.recoverable).toBe(false)
		})

		it('should include iteration details', () => {
			const error = budgetExceededError(25, 20)

			expect(error.details).toEqual({
				iterations: 25,
				maxIterations: 20
			})
		})

		it('should format message correctly', () => {
			const error = budgetExceededError(150, 100)

			expect(error.message).toBe('Budget exceeded: 150/100 iterations')
		})
	})

	describe('abortError', () => {
		it('should create ABORT error', () => {
			const error = abortError('User cancelled')

			expect(error.code).toBe('ABORT')
			expect(error.message).toContain('User cancelled')
			expect(error.recoverable).toBe(false)
		})

		it('should include reason in details', () => {
			const error = abortError('Timeout reached')

			expect(error.details).toEqual({ reason: 'Timeout reached' })
		})

		it('should format message correctly', () => {
			const error = abortError('Manual abort')

			expect(error.message).toBe('Run aborted: Manual abort')
		})
	})
})
