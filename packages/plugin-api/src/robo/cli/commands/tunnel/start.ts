/**
 * Start a tunnel for local development.
 *
 * By default, runs in detached (background) mode.
 * Use --attach to keep the tunnel in the foreground.
 */
import { createCliCommandConfig } from 'robo.js'
import { CloudflareProvider } from '../../../../core/tunnel/providers/cloudflare.js'
import { TunnelRegistry } from '../../../../core/tunnel/registry.js'
import type { CliContext } from 'robo.js'

export const config = createCliCommandConfig({
	description: 'Start a tunnel to expose your local server',
	options: [
		{
			alias: '-p',
			name: '--port',
			description: 'Port to tunnel (default: PORT env or 3000)',
			type: 'number'
		},
		{
			alias: '-u',
			name: '--url',
			description: 'Custom origin URL to tunnel (overrides --port)',
			type: 'string'
		},
		{
			alias: '-a',
			name: '--attach',
			description: 'Run tunnel in foreground (attached mode)',
			type: 'boolean',
			default: false
		},
		{
			alias: '-v',
			name: '--verbose',
			description: 'Show debug output',
			type: 'boolean',
			default: false
		}
	]
} as const)

export default async function ({ options, logger }: CliContext<typeof config>) {
	const { port: portOption, url, attach, verbose } = options

	// Enable debug output if verbose flag is set
	if (verbose) {
		logger.setup({ level: 'debug' })
	}

	// Determine port: option > PORT env > 3000
	const defaultPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000
	const port = portOption ?? defaultPort

	// Create CloudflareProvider
	const provider = new CloudflareProvider()

	// Check if cloudflared is installed
	if (!provider.isInstalled()) {
		logger.info('Installing cloudflared...')
		await provider.install()
	}

	// Determine local URL (--url overrides --port)
	const localUrl = url ?? `http://localhost:${port}`

	// Extract effective port from URL for registry
	let effectivePort = port
	if (url) {
		try {
			const parsedUrl = new URL(url)
			effectivePort = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 80
		} catch {
			// Invalid URL, use default port
		}
	}

	// Detached mode is the default (inverse of attach)
	const detached = !attach

	try {
		// Check for existing tunnel on the same port
		logger.debug('Checking for existing tunnels...')
		const existingTunnels = await TunnelRegistry.getAll()
		logger.debug(`Found ${existingTunnels.length} existing tunnel(s):`, existingTunnels.map((t) => ({ id: t.id, port: t.port })))

		const existingTunnel = existingTunnels.find((t) => t.port === effectivePort)

		if (existingTunnel) {
			logger.error('')
			logger.error(`Tunnel already running on port ${effectivePort}`)
			logger.error('')
			logger.info(`  ID:  ${existingTunnel.id}`)
			logger.info(`  URL: ${existingTunnel.url}`)
			logger.info('')
			logger.info(`Stop it first: robo tunnel stop ${existingTunnel.id}`)
			logger.info('')
			await logger.flush()
			process.exit(1)
		}

		// Start tunnel (waits for URL to be resolved)
		logger.debug(`Starting tunnel to ${localUrl} (detached: ${detached})...`)
		const instance = await provider.start(localUrl, { detached })

		// Log URL for user (in addition to provider's own logging)
		logger.info('')
		logger.info(`  ${instance.url}`)
		logger.info('')
		logger.debug(`Tunnel PID: ${instance.process.pid}`)

		if (!instance.url) {
			logger.error('Failed to get tunnel URL')
			process.exit(1)
		}

		if (detached) {
			// Register in Flashcore for later management
			logger.debug('Registering tunnel in Flashcore...')
			try {
				const record = await TunnelRegistry.register({
					pid: instance.process.pid!,
					port: effectivePort,
					url: instance.url,
					startedAt: Date.now(),
					provider: 'cloudflare'
				})

				logger.info(`Tunnel ID: ${record.id}`)
				logger.info(`Run \`robo tunnel stop ${record.id}\` to stop`)
				logger.info('')
			} catch (registerError) {
				logger.error('Failed to register tunnel:', registerError instanceof Error ? registerError.message : registerError)
				// Kill the tunnel since we couldn't track it
				instance.process.kill('SIGTERM')
				process.exit(1)
			}

			// Allow Node to exit - the child will continue running because
			// it was spawned with detached: true and file-based stdio
			instance.process.unref()
			return
		}

		// Attached (foreground) mode - wait for Ctrl+C
		logger.info('Press Ctrl+C to stop tunnel')

		await new Promise<void>((resolve) => {
			const cleanup = async () => {
				logger.info('Stopping tunnel...')
				await provider.stop(instance)
				resolve()
			}

			process.on('SIGINT', cleanup)
			process.on('SIGTERM', cleanup)

			// Also resolve if the tunnel process exits
			instance.process.on('exit', () => {
				resolve()
			})
		})
	} catch (error) {
		logger.error('Failed to start tunnel:', error instanceof Error ? error.message : error)
		process.exit(1)
	}
}
