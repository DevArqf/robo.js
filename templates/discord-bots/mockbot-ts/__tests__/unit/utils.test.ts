/**
 * Unit Tests
 *
 * Regular Jest tests that don't require the mock server.
 * Demonstrates that standard Jest functionality works alongside mock tests.
 */
import { jest, describe, it, expect } from '@jest/globals'

describe('utility functions', () => {
	it('should work with regular Jest assertions', () => {
		const result = 2 + 2
		expect(result).toBe(4)
	})

	it('should handle async operations', async () => {
		const promise = Promise.resolve('hello')
		await expect(promise).resolves.toBe('hello')
	})

	it('should work with object matchers', () => {
		const user = {
			name: 'TestBot',
			id: '123456789',
			bot: true
		}

		expect(user).toMatchObject({
			name: expect.any(String),
			bot: true
		})
	})

	it('should work with array matchers', () => {
		const items = ['apple', 'banana', 'cherry']

		expect(items).toContain('banana')
		expect(items).toHaveLength(3)
	})

	it('should handle errors correctly', () => {
		const throwError = () => {
			throw new Error('Test error')
		}

		expect(throwError).toThrow('Test error')
	})

	it('should work with mock functions', () => {
		const mockFn = jest.fn()
		mockFn('hello', 'world')

		expect(mockFn).toHaveBeenCalledWith('hello', 'world')
		expect(mockFn).toHaveBeenCalledTimes(1)
	})
})

describe('string utilities', () => {
	it('should match string patterns', () => {
		const message = 'Hello, World!'

		expect(message).toMatch(/Hello/)
		expect(message).toContain('World')
	})

	it('should handle template literals', () => {
		const name = 'Bot'
		const greeting = `Hello, ${name}!`

		expect(greeting).toBe('Hello, Bot!')
	})
})
