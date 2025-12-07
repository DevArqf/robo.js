/**
 * Test Client Factory
 *
 * Creates discord.js Client instances configured to connect to the mock server.
 */

import { Client, GatewayIntentBits, type ClientOptions } from 'discord.js'
import { MOCK_CONFIG, ALL_INTENTS } from './constants.js'

/**
 * Options for creating a test client
 */
export interface TestClientOptions {
	/** Gateway intents (default: GUILDS) */
	intents?: number | number[]

	/** Additional client options */
	clientOptions?: Partial<ClientOptions>
}

/**
 * Create a discord.js Client configured for the mock server
 *
 * @param options - Client options
 * @returns Configured discord.js Client
 *
 * @example
 * ```typescript
 * const client = createTestClient()
 * await client.login(session.token)
 * ```
 *
 * @example
 * ```typescript
 * const client = createTestClient({
 *   intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
 * })
 * ```
 */
export function createTestClient(options: TestClientOptions = {}): Client {
	// Normalize intents to a single number
	let intents: number
	if (options.intents === undefined) {
		intents = GatewayIntentBits.Guilds
	} else if (Array.isArray(options.intents)) {
		intents = options.intents.reduce((acc, i) => acc | i, 0)
	} else {
		intents = options.intents
	}

	return new Client({
		intents,
		rest: {
			// Point to mock server's API root (discord.js adds /v10)
			api: MOCK_CONFIG.REST_URL
		},
		...options.clientOptions
	})
}

/**
 * Create a client with all intents enabled
 *
 * @returns Client with full access to all events
 */
export function createFullAccessClient(): Client {
	return createTestClient({ intents: ALL_INTENTS })
}

/**
 * Create a client with minimal intents (GUILDS only)
 *
 * @returns Client with minimal permissions
 */
export function createMinimalClient(): Client {
	return createTestClient({ intents: GatewayIntentBits.Guilds })
}

/**
 * Create a client with specific intent bits
 *
 * @param intentBits - Array of intent bit values from GatewayIntentBits
 * @returns Configured client
 *
 * @example
 * ```typescript
 * const client = createClientWithIntents([
 *   GatewayIntentBits.Guilds,
 *   GatewayIntentBits.GuildMessages,
 *   GatewayIntentBits.MessageContent
 * ])
 * ```
 */
export function createClientWithIntents(intentBits: number[]): Client {
	return createTestClient({ intents: intentBits })
}

/**
 * Safely destroy a client, handling cases where it may not be connected
 *
 * @param client - The client to destroy
 */
export async function destroyClient(client: Client | null): Promise<void> {
	if (!client) return

	try {
		// Remove all listeners to prevent memory leaks
		client.removeAllListeners()
		client.destroy()
		// Allow time for WebSocket connections to close cleanly
		await new Promise((resolve) => setTimeout(resolve, 100))
	} catch {
		// Ignore errors during cleanup
	}
}

/**
 * Connect a client and wait for it to be ready
 *
 * @param client - The client to connect
 * @param token - Session token
 * @param timeout - Timeout in ms (default: MOCK_CONFIG.TIMEOUT)
 * @returns The ready client
 */
export async function connectClient(client: Client, token: string, timeout = MOCK_CONFIG.TIMEOUT): Promise<Client> {
	return new Promise((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			reject(new Error(`Client did not become ready within ${timeout}ms`))
		}, timeout)

		client.once('ready', () => {
			clearTimeout(timeoutId)
			resolve(client)
		})

		client.once('error', (error) => {
			clearTimeout(timeoutId)
			reject(error)
		})

		client.login(token).catch((error) => {
			clearTimeout(timeoutId)
			reject(error)
		})
	})
}

// Re-export GatewayIntentBits for convenience
export { GatewayIntentBits }
