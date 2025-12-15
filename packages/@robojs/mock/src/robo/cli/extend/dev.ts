/**
 * CLI Extension for `robo dev` command
 *
 * Adds mock mode options:
 * - --mock (-M): Enable mock mode (starts new session)
 * - --mock-session: Connect to existing mock server session
 */
import path from 'node:path'
import type { CliExtendConfig, CliBeforeHook } from 'robo.js'
import { generateSessionId, createMockToken, parseMockToken } from '../../../utils/id.js'
import { getServerPort, getMockPluginPrefix } from '../../../utils/server.js'
import { readServerInfo, STANDALONE_MOCK_PORT } from '../../../utils/server-info.js'

export const config: CliExtendConfig = {
	options: [
		{
			alias: '-M',
			name: '--mock',
			description: 'Enable mock mode (creates new session)',
			type: 'boolean'
		},
		{
			alias: '-S',
			name: '--mock-session',
			description: 'Connect to mock server session (use "new" to create, or session ID to join)',
			type: 'string'
		}
	],
	priority: 10
}

export const before: CliBeforeHook = async (ctx) => {
	const { mock, 'mock-session': mockSession } = ctx.options as {
		mock?: boolean
		'mock-session'?: string
	}

	// Neither option specified - continue normally
	if (!mock && !mockSession) {
		return
	}

	// Cannot use both options
	if (mock && mockSession) {
		ctx.logger.error('Cannot use both --mock and --mock-session together')
		process.exit(1)
	}

	// Set mock mode flag
	process.env.ROBO_MOCK_MODE = 'true'

	if (mockSession) {
		// Connect to existing session
		await setupExistingSessionConnection(ctx, mockSession)
	} else {
		// Start new session (--mock flag)
		await setupNewSession(ctx)
	}
}

async function setupNewSession(ctx: { logger: { debug: (msg: string) => void } }) {
	const sessionId = generateSessionId()
	const sessionToken = createMockToken(sessionId)
	const projectName = path.basename(process.cwd())
	const sessionName = `${projectName}-mock`

	// Store real Discord token before overwriting
	const realDiscordToken = process.env.DISCORD_TOKEN

	// Set environment variables for init/start hooks
	process.env.ROBO_MOCK_SESSION_ID = sessionId
	process.env.ROBO_MOCK_SESSION_NAME = sessionName
	process.env.ROBO_MOCK_REAL_TOKEN = realDiscordToken ?? ''
	process.env.DISCORD_TOKEN = sessionToken

	// Set REST API URL (will be resolved at runtime with embedded server)
	const port = getServerPort()
	const prefix = getMockPluginPrefix()
	process.env.DISCORD_REST_API = `http://localhost:${port}${prefix}/api`

	// Signal to open browser after start
	process.env.__ROBO_MOCK_OPEN_BROWSER = 'true'

	ctx.logger.debug(`Mock mode enabled (new session: ${sessionId})`)
}

async function setupExistingSessionConnection(
	ctx: { logger: { debug: (msg: string) => void; info: (msg: string) => void; error: (msg: string) => void } },
	sessionInput: string
) {
	// Try to read server info file for port discovery
	const serverInfo = await readServerInfo()
	const port = serverInfo?.port ?? STANDALONE_MOCK_PORT
	const baseUrl = `http://localhost:${port}`

	let sessionId: string

	// Handle "new" or empty value - create a new session on the external server
	if (sessionInput === 'new' || sessionInput === '') {
		ctx.logger.info(`Creating new session on mock server at port ${port}...`)

		try {
			const response = await fetch(`${baseUrl}/api/control/sessions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: `${path.basename(process.cwd())}-bot` })
			})

			if (!response.ok) {
				ctx.logger.error(`Failed to create session: ${response.status} ${response.statusText}`)
				process.exit(1)
			}

			const data = (await response.json()) as { session_id: string; token: string }
			sessionId = data.session_id
			ctx.logger.info(`Created session: ${sessionId}`)
		} catch (error) {
			ctx.logger.error(`Failed to connect to mock server at ${baseUrl}: ${(error as Error).message}`)
			ctx.logger.info('Make sure the mock server is running: robo mock')
			process.exit(1)
		}
	} else {
		// Parse session ID from input (supports sess_xxx or mock:sess_xxx formats)
		sessionId = sessionInput

		// Try parsing as mock token first
		const parsed = parseMockToken(sessionInput)
		if (parsed) {
			sessionId = parsed
		} else if (sessionInput.startsWith('mock:')) {
			sessionId = sessionInput.slice(5)
		}
	}

	// Create mock token for this session
	const sessionToken = createMockToken(sessionId)

	// Store real Discord token
	const realDiscordToken = process.env.DISCORD_TOKEN

	// Set environment variables
	process.env.ROBO_MOCK_SESSION_ID = sessionId
	process.env.ROBO_MOCK_REAL_TOKEN = realDiscordToken ?? ''
	process.env.DISCORD_TOKEN = sessionToken

	// Set REST API URL with mock prefix
	// The mock plugin registers routes at /mock/api/v10/* so Discord.js must hit the prefixed path
	const prefix = getMockPluginPrefix()
	process.env.DISCORD_REST_API = `${baseUrl}${prefix}/api`

	// Mark as connecting to existing (don't open browser, don't create session)
	process.env.__ROBO_MOCK_CONNECT_EXISTING = 'true'
	process.env.__ROBO_MOCK_SERVER_PORT = String(port)

	ctx.logger.info(`Connecting to mock session: ${sessionId} on port ${port}`)
}
