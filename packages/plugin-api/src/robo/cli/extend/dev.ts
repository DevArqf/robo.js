/**
 * CLI Extension for `robo dev` command
 *
 * Adds the -t/--tunnel flag to expose local server to the internet.
 */
import type { CliExtendConfig, CliBeforeHook } from 'robo.js'

export const config: CliExtendConfig = {
	options: [
		{
			alias: '-t',
			name: '--tunnel',
			description: 'Expose your local server to the internet',
			type: 'boolean'
		}
	],
	priority: 10
}

export const before: CliBeforeHook = async (ctx) => {
	const { tunnel } = ctx.options as { tunnel?: boolean }

	if (!tunnel) {
		return // Continue normally
	}

	// Validate PORT is set
	if (!process.env.PORT) {
		ctx.logger.error('Cannot start tunnel without a PORT environment variable.')
		process.exit(1)
	}

	// Import tunnel provider
	const { CloudflareProvider } = await import('../../../core/tunnel/index.js')
	const provider = new CloudflareProvider()

	// Install cloudflared if needed
	if (!provider.isInstalled()) {
		ctx.logger.event('Installing Cloudflared...')
		await provider.install()
	}

	// Initialize tunnel (creates/fetches credentials for static tunnels)
	ctx.logger.event('Initializing Cloudflare tunnel...')
	const initialized = await provider.initialize({
		domain: process.env.CLOUDFLARE_DOMAIN,
		apiKey: process.env.CLOUDFLARE_API_KEY,
		zoneId: process.env.CLOUDFLARE_ZONE_ID,
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID
	})

	if (initialized) {
		ctx.logger.debug('Cloudflare Tunnel initialized successfully!')
	} else {
		ctx.logger.debug('Using dynamic tunnel (no static tunnel configured)')
	}

	// Signal to start.ts lifecycle hook that tunnel should start
	process.env.__ROBO_TUNNEL_ENABLED = 'true'
}
