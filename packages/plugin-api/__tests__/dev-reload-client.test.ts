/**
 * Tests for Dev Reload Client Module (Browser-Side)
 *
 * Tests the WebSocket client that receives reload messages and triggers browser refresh.
 * Simulates browser environment for testing.
 */
import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals'

describe('Dev Reload Client', () => {
	// Store original globals
	let originalWindow: typeof globalThis.window
	let originalWebSocket: typeof globalThis.WebSocket
	let originalProcess: typeof process

	// Mock implementations
	let mockWebSocketInstance: {
		onopen: ((event: Event) => void) | null
		onmessage: ((event: MessageEvent) => void) | null
		onerror: ((event: Event) => void) | null
		onclose: ((event: CloseEvent) => void) | null
	}

	let mockLocationReload: jest.Mock

	beforeEach(() => {
		// Save originals
		originalWindow = globalThis.window
		originalWebSocket = globalThis.WebSocket
		originalProcess = globalThis.process

		// Create mock WebSocket instance
		mockWebSocketInstance = {
			onopen: null,
			onmessage: null,
			onerror: null,
			onclose: null
		}

		// Mock WebSocket constructor
		const MockWebSocket = jest.fn().mockImplementation(() => mockWebSocketInstance)
		;(globalThis as any).WebSocket = MockWebSocket

		// Mock window with location
		mockLocationReload = jest.fn()
		;(globalThis as any).window = {
			location: {
				protocol: 'http:',
				host: 'localhost:3000',
				reload: mockLocationReload
			}
		}

		// Mock process.env
		;(globalThis as any).process = {
			env: {
				NODE_ENV: 'development'
			}
		}

		// Clear module cache
		jest.resetModules()
	})

	afterEach(() => {
		// Restore originals
		;(globalThis as any).window = originalWindow
		;(globalThis as any).WebSocket = originalWebSocket
		;(globalThis as any).process = originalProcess
	})

	describe('initDevReload()', () => {
		it('should skip in SSR environment (no window)', async () => {
			delete (globalThis as any).window

			const { initDevReload } = await import('../.robo/build/client/dev-reload.js')

			// Should not throw
			expect(() => initDevReload()).not.toThrow()
		})

		it('should skip if WebSocket is undefined', async () => {
			delete (globalThis as any).WebSocket

			const { initDevReload } = await import('../.robo/build/client/dev-reload.js')

			// Should not throw
			expect(() => initDevReload()).not.toThrow()
		})

		it('should connect to correct WebSocket URL (HTTP)', async () => {
			const { initDevReload } = await import('../.robo/build/client/dev-reload.js')

			initDevReload()

			expect(globalThis.WebSocket).toHaveBeenCalledWith('ws://localhost:3000/__robo/ui-reload')
		})

		it('should connect to correct WebSocket URL (HTTPS)', async () => {
			;(globalThis as any).window.location.protocol = 'https:'

			const { initDevReload } = await import('../.robo/build/client/dev-reload.js')

			initDevReload()

			expect(globalThis.WebSocket).toHaveBeenCalledWith('wss://localhost:3000/__robo/ui-reload')
		})
	})

	describe('Message Handling', () => {
		it('should reload page on reload message', async () => {
			const { initDevReload } = await import('../.robo/build/client/dev-reload.js')

			initDevReload()

			// Simulate receiving a reload message
			const reloadMessage = {
				type: 'reload',
				timestamp: Date.now()
			}

			mockWebSocketInstance.onmessage?.({
				data: JSON.stringify(reloadMessage)
			} as MessageEvent)

			expect(mockLocationReload).toHaveBeenCalled()
		})

		it('should ignore non-reload messages', async () => {
			const { initDevReload } = await import('../.robo/build/client/dev-reload.js')

			initDevReload()

			// Simulate receiving a non-reload message
			const otherMessage = {
				type: 'ping',
				timestamp: Date.now()
			}

			mockWebSocketInstance.onmessage?.({
				data: JSON.stringify(otherMessage)
			} as MessageEvent)

			expect(mockLocationReload).not.toHaveBeenCalled()
		})

		it('should handle malformed JSON gracefully', async () => {
			const { initDevReload } = await import('../.robo/build/client/dev-reload.js')

			initDevReload()

			// Should not throw on invalid JSON
			expect(() => {
				mockWebSocketInstance.onmessage?.({
					data: 'not valid json'
				} as MessageEvent)
			}).not.toThrow()

			expect(mockLocationReload).not.toHaveBeenCalled()
		})
	})

	describe('Plugin Filtering', () => {
		it('should reload for any plugin when no filter specified', async () => {
			const { initDevReload } = await import('../.robo/build/client/dev-reload.js')

			initDevReload() // No plugin name filter

			const reloadMessage = {
				type: 'reload',
				plugin: '@robojs/mock',
				timestamp: Date.now()
			}

			mockWebSocketInstance.onmessage?.({
				data: JSON.stringify(reloadMessage)
			} as MessageEvent)

			expect(mockLocationReload).toHaveBeenCalled()
		})

		it('should reload when plugin matches filter', async () => {
			const { initDevReload } = await import('../.robo/build/client/dev-reload.js')

			initDevReload('@robojs/mock')

			const reloadMessage = {
				type: 'reload',
				plugin: '@robojs/mock',
				timestamp: Date.now()
			}

			mockWebSocketInstance.onmessage?.({
				data: JSON.stringify(reloadMessage)
			} as MessageEvent)

			expect(mockLocationReload).toHaveBeenCalled()
		})

		it('should skip reload when plugin does not match filter', async () => {
			const { initDevReload } = await import('../.robo/build/client/dev-reload.js')

			initDevReload('@robojs/mock')

			const reloadMessage = {
				type: 'reload',
				plugin: '@robojs/other',
				timestamp: Date.now()
			}

			mockWebSocketInstance.onmessage?.({
				data: JSON.stringify(reloadMessage)
			} as MessageEvent)

			expect(mockLocationReload).not.toHaveBeenCalled()
		})

		it('should reload when no plugin specified in message', async () => {
			const { initDevReload } = await import('../.robo/build/client/dev-reload.js')

			initDevReload('@robojs/mock')

			const reloadMessage = {
				type: 'reload',
				// No plugin field - means reload all
				timestamp: Date.now()
			}

			mockWebSocketInstance.onmessage?.({
				data: JSON.stringify(reloadMessage)
			} as MessageEvent)

			expect(mockLocationReload).toHaveBeenCalled()
		})
	})

	describe('Error Handling', () => {
		it('should handle WebSocket errors silently', async () => {
			const { initDevReload } = await import('../.robo/build/client/dev-reload.js')

			initDevReload()

			// Should not throw on error
			expect(() => {
				mockWebSocketInstance.onerror?.({} as Event)
			}).not.toThrow()
		})

		it('should handle WebSocket close silently', async () => {
			const { initDevReload } = await import('../.robo/build/client/dev-reload.js')

			initDevReload()

			// Should not throw on close
			expect(() => {
				mockWebSocketInstance.onclose?.({} as CloseEvent)
			}).not.toThrow()
		})

		it('should handle WebSocket constructor failure silently', async () => {
			// Make WebSocket constructor throw
			;(globalThis as any).WebSocket = jest.fn().mockImplementation(() => {
				throw new Error('WebSocket blocked')
			})

			const { initDevReload } = await import('../.robo/build/client/dev-reload.js')

			// Should not throw
			expect(() => initDevReload()).not.toThrow()
		})
	})
})

describe('WebSocket URL Construction', () => {
	const buildWsUrl = (protocol: string, host: string, path: string): string => {
		const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:'
		return `${wsProtocol}//${host}${path}`
	}

	it('should use ws: for http: protocol', () => {
		const wsUrl = buildWsUrl('http:', 'localhost:3000', '/__robo/ui-reload')
		expect(wsUrl).toBe('ws://localhost:3000/__robo/ui-reload')
	})

	it('should use wss: for https: protocol', () => {
		const wsUrl = buildWsUrl('https:', 'example.com', '/__robo/ui-reload')
		expect(wsUrl).toBe('wss://example.com/__robo/ui-reload')
	})
})
