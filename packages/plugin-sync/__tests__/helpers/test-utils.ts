/**
 * Test utilities for @robojs/sync tests
 *
 * Provides mock WebSocket implementations that allow testing actual server logic
 * while only mocking the transport layer.
 */

import { jest } from '@jest/globals'
import { EventEmitter } from 'events'
import type { MessagePayload } from '../../src/core/types.js'

/**
 * Mock WebSocket that behaves like a real WebSocket but captures messages
 * and allows simulating incoming messages.
 */
export class MockWebSocket extends EventEmitter {
	static CONNECTING = 0
	static OPEN = 1
	static CLOSING = 2
	static CLOSED = 3

	readyState = MockWebSocket.OPEN
	sentMessages: string[] = []

	send = jest.fn((data: string) => {
		this.sentMessages.push(data)
	})

	close = jest.fn(() => {
		this.readyState = MockWebSocket.CLOSED
		this.emit('close')
	})

	terminate = jest.fn(() => {
		this.readyState = MockWebSocket.CLOSED
		this.emit('close')
	})

	/**
	 * Simulate receiving a message from the client
	 */
	simulateMessage(payload: MessagePayload): void {
		this.emit('message', JSON.stringify(payload))
	}

	/**
	 * Get all sent messages as parsed objects
	 */
	getSentPayloads(): MessagePayload[] {
		return this.sentMessages.map((msg) => JSON.parse(msg))
	}

	/**
	 * Get the last sent message as parsed object
	 */
	getLastSentPayload(): MessagePayload | undefined {
		if (this.sentMessages.length === 0) return undefined
		return JSON.parse(this.sentMessages[this.sentMessages.length - 1])
	}

	/**
	 * Find sent messages by type
	 */
	getSentPayloadsByType(type: string): MessagePayload[] {
		return this.getSentPayloads().filter((p) => p.type === type)
	}

	/**
	 * Clear sent messages history
	 */
	clearSentMessages(): void {
		this.sentMessages = []
		this.send.mockClear()
	}
}

/**
 * Mock WebSocketServer that captures connections and allows simulating them
 */
export class MockWebSocketServer extends EventEmitter {
	connections: MockWebSocket[] = []

	/**
	 * Simulate a new client connecting
	 */
	simulateConnection(): MockWebSocket {
		const ws = new MockWebSocket()
		this.connections.push(ws)
		this.emit('connection', ws)
		return ws
	}

	/**
	 * Handle upgrade (for compatibility with server code)
	 */
	handleUpgrade = jest.fn(
		(
			_req: unknown,
			_socket: unknown,
			_head: unknown,
			callback: (ws: MockWebSocket) => void
		) => {
			const ws = new MockWebSocket()
			this.connections.push(ws)
			callback(ws)
		}
	)
}

/**
 * Helper to wait for a condition with timeout
 */
export async function waitFor(
	condition: () => boolean,
	timeout = 1000,
	interval = 10
): Promise<void> {
	const start = Date.now()
	while (!condition()) {
		if (Date.now() - start > timeout) {
			throw new Error('waitFor timeout')
		}
		await new Promise((resolve) => setTimeout(resolve, interval))
	}
}

/**
 * Helper to wait for debounce delay (used for StrictMode debounce testing)
 */
export async function waitForDebounce(ms = 160): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Helper to advance timers (for testing debounce without waiting)
 */
export function advanceTimers(ms: number): void {
	jest.advanceTimersByTime(ms)
}

/**
 * Create a message payload for testing
 */
export function createPayload<T = unknown>(
	type: string,
	data?: T,
	key?: string[],
	extra?: Partial<MessagePayload>
): MessagePayload<T> {
	return {
		type: type as MessagePayload['type'],
		data: data as T,
		key,
		...extra
	} as MessagePayload<T>
}

/**
 * Find a payload in a list by type
 */
export function findPayloadByType(
	payloads: MessagePayload[],
	type: string
): MessagePayload | undefined {
	return payloads.find((p) => p.type === type)
}

/**
 * Assert that a WebSocket received a specific message type
 */
export function assertSentMessage(
	ws: MockWebSocket,
	expectedType: string,
	message?: string
): MessagePayload {
	const payload = ws.getSentPayloadsByType(expectedType)[0]
	if (!payload) {
		const types = ws.getSentPayloads().map((p) => p.type)
		throw new Error(
			message ||
				`Expected message type "${expectedType}" not found. Sent types: ${types.join(', ')}`
		)
	}
	return payload
}

/**
 * Reset test state between tests
 */
export function resetTestState(): void {
	jest.clearAllMocks()
	jest.clearAllTimers()
}
