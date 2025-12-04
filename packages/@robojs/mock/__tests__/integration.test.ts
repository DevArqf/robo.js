/**
 * Phase 1F: Integration Test with discord.js
 *
 * This test verifies that a real discord.js client can connect to the
 * @robojs/mock server and receive proper READY and GUILD_CREATE events.
 *
 * ## How It Works
 *
 * 1. Start the actual @robojs/mock server (via `robo start`)
 * 2. Create a session via the plugin's REST API (`POST /api/control/sessions`)
 * 3. Configure discord.js to use the mock server's REST API
 * 4. Connect and verify READY event fires with correct data
 *
 * ## Token Format
 *
 * Sessions are identified by Discord-like tokens that encode the session ID.
 * Format: <base64(botId)>.<MOCK marker>.<base64url(sessionId)>
 */
import { spawn, ChildProcess } from 'node:child_process'
import { Client, GatewayIntentBits } from 'discord.js'
import type { Client as DiscordClient } from 'discord.js'

const SERVER_PORT = 3000
const SERVER_URL = `http://localhost:${SERVER_PORT}`

interface SessionResponse {
	session_id: string
	token: string
	expires_at: number
}

interface StateResponse {
	botUser: { id: string; username: string }
	guilds: Array<{ id: string; name: string }>
}

/**
 * Start the Robo server and wait for it to be ready
 */
async function startServer(): Promise<ChildProcess> {
	return new Promise((resolve, reject) => {
		// Explicitly set NODE_ENV=production to override Jest's NODE_ENV=test
		const proc = spawn('npx', ['robo', 'start'], {
			cwd: process.cwd(),
			stdio: ['pipe', 'pipe', 'pipe'],
			env: { ...process.env, PORT: String(SERVER_PORT), FORCE_COLOR: '0', NODE_ENV: 'production' },
			shell: true
		})

		let output = ''
		const timeout = setTimeout(() => {
			proc.kill()
			reject(new Error(`Server failed to start within 30s. Output: ${output}`))
		}, 30000)

		proc.stdout?.on('data', (data) => {
			output += data.toString()
			// Server is ready when we see the gateway message
			if (output.includes('Gateway WebSocket server ready') || output.includes('Ready!')) {
				clearTimeout(timeout)
				resolve(proc)
			}
		})

		proc.stderr?.on('data', (data) => {
			output += data.toString()
		})

		proc.on('error', (err) => {
			clearTimeout(timeout)
			reject(err)
		})

		proc.on('exit', (code) => {
			if (code !== 0 && code !== null) {
				clearTimeout(timeout)
				reject(new Error(`Server exited with code ${code}. Output: ${output}`))
			}
		})
	})
}

/**
 * Create a session via the REST API
 */
async function createSession(config: {
	name: string
	botUser?: { username: string }
	guilds?: Array<{ name: string }>
}): Promise<{ id: string; token: string; botUser: { id: string }; guilds: Array<{ id: string; name: string }> }> {
	const response = await fetch(`${SERVER_URL}/api/control/sessions`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			name: config.name,
			config: {
				botUser: config.botUser,
				guilds: config.guilds
			}
		})
	})

	if (!response.ok) {
		const text = await response.text()
		throw new Error(`Failed to create session: ${response.status} - ${text}`)
	}

	const data = (await response.json()) as SessionResponse

	// Fetch the full session state
	const stateResponse = await fetch(`${SERVER_URL}/api/control/sessions/${data.session_id}/state`)
	const state = (await stateResponse.json()) as StateResponse

	return {
		id: data.session_id,
		token: data.token,
		botUser: state.botUser,
		guilds: state.guilds || []
	}
}

/**
 * Create a discord.js Client configured for the mock server
 */
function createMockClient(): Client {
	return new Client({
		intents: [GatewayIntentBits.Guilds],
		rest: {
			// Point to our mock server's API root (discord.js adds /v10 etc.)
			api: `${SERVER_URL}/api`
		}
	})
}

describe('Phase 1F: Integration Test with discord.js', () => {
	let serverProcess: ChildProcess | null = null
	let client: DiscordClient | null = null

	beforeAll(async () => {
		// Start the actual @robojs/mock server
		serverProcess = await startServer()
	}, 35000)

	afterAll(async () => {
		if (serverProcess) {
			serverProcess.kill('SIGTERM')
			await new Promise((resolve) => setTimeout(resolve, 500))
		}
	})

	afterEach(async () => {
		if (client) {
			client.destroy()
			client = null
		}
	})

	describe('Bot Connection', () => {
		it('should connect and emit ready event', async () => {
			const session = await createSession({
				name: 'ready-test',
				botUser: { username: 'TestBot' },
				guilds: [{ name: 'Test Guild' }]
			})

			client = createMockClient()

			const readyPromise = new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error('Ready event did not fire within 10 seconds'))
				}, 10000)

				client!.once('ready', () => {
					clearTimeout(timeout)
					resolve()
				})
			})

			await client.login(session.token)
			await readyPromise

			expect(client.isReady()).toBe(true)
		}, 15000)

		it('should populate client.user with bot info', async () => {
			const session = await createSession({
				name: 'user-test',
				botUser: { username: 'MyTestBot' },
				guilds: [{ name: 'Test Guild' }]
			})

			client = createMockClient()

			const readyPromise = new Promise<void>((resolve) => {
				client!.once('ready', () => resolve())
			})

			await client.login(session.token)
			await readyPromise

			expect(client.user).not.toBeNull()
			expect(client.user?.username).toBe('MyTestBot')
			expect(client.user?.bot).toBe(true)
			expect(client.user?.id).toBe(session.botUser.id)
		}, 15000)

		it('should populate client.guilds.cache with test guild', async () => {
			const session = await createSession({
				name: 'guilds-test',
				botUser: { username: 'GuildTestBot' },
				guilds: [{ name: 'My Test Server' }]
			})

			client = createMockClient()

			const readyPromise = new Promise<void>((resolve) => {
				client!.once('ready', () => resolve())
			})

			await client.login(session.token)
			await readyPromise

			expect(client.guilds.cache.size).toBe(1)

			const cachedGuild = client.guilds.cache.first()
			expect(cachedGuild).toBeDefined()
			expect(cachedGuild?.name).toBe('My Test Server')
			expect(cachedGuild?.id).toBe(session.guilds[0]?.id)
		}, 15000)

		it('should have correct guild channels', async () => {
			const session = await createSession({
				name: 'channels-test',
				botUser: { username: 'ChannelTestBot' },
				guilds: [{ name: 'Channel Test Guild' }]
			})

			client = createMockClient()

			const readyPromise = new Promise<void>((resolve) => {
				client!.once('ready', () => resolve())
			})

			await client.login(session.token)
			await readyPromise

			const cachedGuild = client.guilds.cache.first()
			expect(cachedGuild).toBeDefined()
			expect(cachedGuild?.channels.cache.size).toBeGreaterThan(0)

			const generalChannel = cachedGuild?.channels.cache.find((ch) => ch.name === 'general')
			expect(generalChannel).toBeDefined()
			expect(generalChannel?.name).toBe('general')
		}, 15000)
	})
})
