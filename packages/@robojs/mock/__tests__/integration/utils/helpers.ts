/**
 * Integration Test Helpers
 *
 * Utility functions for integration tests.
 */

import type { Client, ClientEvents } from 'discord.js'

/**
 * Generate a Discord snowflake ID
 * Uses a simplified algorithm suitable for testing
 */
let snowflakeCounter = 0
const EPOCH = 1420070400000 // Discord epoch

export function generateSnowflake(): string {
	const timestamp = BigInt(Date.now() - EPOCH) << BigInt(22)
	const counter = BigInt(snowflakeCounter++ & 0xfff)
	return String(timestamp | counter)
}

/**
 * Reset the snowflake counter (useful for test isolation)
 */
export function resetSnowflakeCounter(): void {
	snowflakeCounter = 0
}

/**
 * Wait for a specific event on a discord.js client
 *
 * Supports two calling patterns:
 * 1. Type-safe: `waitForEvent(client, 'messageCreate')` - infers Message from ClientEvents
 * 2. Explicit type: `waitForEvent<GuildMember>(client, 'guildMemberAdd')` - uses explicit type
 *
 * @param client - The discord.js client
 * @param event - Event name to wait for
 * @param timeout - Maximum time to wait (ms)
 * @param predicate - Optional filter function
 * @returns The first event argument
 */
// Overload 1: Type-safe inference from event name (for unparameterized calls)
export function waitForEvent<K extends keyof ClientEvents>(
	client: Client,
	event: K,
	timeout?: number,
	predicate?: (...args: ClientEvents[K]) => boolean
): Promise<ClientEvents[K][0]>
// Overload 2: Explicit return type (for parameterized calls like waitForEvent<Message>(...))
export function waitForEvent<T>(
	client: Client,
	event: string,
	timeout?: number,
	predicate?: (...args: unknown[]) => boolean
): Promise<T>
// Implementation
export function waitForEvent<T>(
	client: Client,
	event: string,
	timeout = 10000,
	predicate?: (...args: unknown[]) => boolean
): Promise<T> {
	return new Promise((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			client.off(event, handler)
			reject(new Error(`Timeout waiting for event "${event}" after ${timeout}ms`))
		}, timeout)

		const handler = (...args: unknown[]) => {
			if (!predicate || predicate(...args)) {
				clearTimeout(timeoutId)
				client.off(event, handler)
				resolve(args[0] as T)
			}
		}

		client.on(event, handler)
	})
}

/**
 * Wait for the client to be ready
 *
 * @param client - The discord.js client
 * @param timeout - Maximum time to wait (ms)
 */
export function waitForReady(client: Client, timeout = 10000): Promise<Client<true>> {
	return new Promise((resolve, reject) => {
		if (client.isReady()) {
			resolve(client as Client<true>)
			return
		}

		const timeoutId = setTimeout(() => {
			reject(new Error(`Client did not become ready within ${timeout}ms`))
		}, timeout)

		client.once('ready', (readyClient) => {
			clearTimeout(timeoutId)
			resolve(readyClient)
		})
	})
}

/**
 * Delay execution for a specified time
 *
 * @param ms - Milliseconds to wait
 */
export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry an async operation with exponential backoff
 *
 * @param fn - Function to retry
 * @param options - Retry options
 * @returns Result of the function
 */
export async function retry<T>(
	fn: () => Promise<T>,
	options: {
		maxAttempts?: number
		initialDelay?: number
		maxDelay?: number
		factor?: number
	} = {}
): Promise<T> {
	const { maxAttempts = 3, initialDelay = 100, maxDelay = 5000, factor = 2 } = options

	let lastError: Error | null = null
	let currentDelay = initialDelay

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn()
		} catch (error) {
			lastError = error as Error
			if (attempt < maxAttempts) {
				await delay(currentDelay)
				currentDelay = Math.min(currentDelay * factor, maxDelay)
			}
		}
	}

	throw lastError
}

/**
 * Create a promise that resolves after all events are received
 *
 * @param client - The discord.js client
 * @param events - Event names to wait for
 * @param timeout - Maximum time to wait (ms)
 */
export async function waitForAllEvents<K extends keyof ClientEvents>(
	client: Client,
	events: K[],
	timeout = 10000
): Promise<Map<K, ClientEvents[K][0]>> {
	const results = new Map<K, ClientEvents[K][0]>()
	const pending = new Set(events)

	return new Promise((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			cleanup()
			reject(new Error(`Timeout waiting for events: ${Array.from(pending).join(', ')}`))
		}, timeout)

		const handlers = new Map<K, (...args: ClientEvents[K]) => void>()

		const cleanup = () => {
			clearTimeout(timeoutId)
			Array.from(handlers.entries()).forEach(([event, handler]) => {
				client.off(event, handler)
			})
		}

		for (const event of events) {
			const handler = (...args: ClientEvents[K]) => {
				results.set(event, args[0])
				pending.delete(event)
				if (pending.size === 0) {
					cleanup()
					resolve(results)
				}
			}
			handlers.set(event, handler)
			client.once(event, handler)
		}
	})
}

/**
 * Create a deferred promise with external resolve/reject control
 */
export function createDeferred<T>(): {
	promise: Promise<T>
	resolve: (value: T) => void
	reject: (reason?: unknown) => void
} {
	let resolve!: (value: T) => void
	let reject!: (reason?: unknown) => void

	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})

	return { promise, resolve, reject }
}

/**
 * Assert that an operation throws an error
 *
 * @param fn - Async function that should throw
 * @param matcher - Error message or regex to match
 */
export async function expectError(fn: () => Promise<unknown>, matcher?: string | RegExp): Promise<Error> {
	try {
		await fn()
		throw new Error('Expected function to throw an error')
	} catch (error) {
		if (error instanceof Error && error.message === 'Expected function to throw an error') {
			throw error
		}
		if (matcher) {
			const message = (error as Error).message
			if (typeof matcher === 'string') {
				if (!message.includes(matcher)) {
					throw new Error(`Expected error to contain "${matcher}" but got "${message}"`)
				}
			} else if (!matcher.test(message)) {
				throw new Error(`Expected error to match ${matcher} but got "${message}"`)
			}
		}
		return error as Error
	}
}
