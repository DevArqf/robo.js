/**
 * Tunnel command - shows available subcommands.
 *
 * Tunnels expose your local server to the internet via Cloudflare Quick Tunnels.
 * Perfect for testing webhooks, sharing previews, or Discord Activity development.
 */
import type { CliCommandConfig, CliContext } from 'robo.js'

export const config: CliCommandConfig = {
	description: 'Manage tunnels for local development'
}

export default async function ({ logger }: CliContext) {
	logger.log('Tunnel commands:')
	logger.log('')
	logger.log('  robo tunnel start        Start a tunnel (background by default)')
	logger.log('  robo tunnel start -a     Start a tunnel in foreground (attached)')
	logger.log('  robo tunnel start -p 8080    Start a tunnel on specific port')
	logger.log('  robo tunnel list         List all running tunnels')
	logger.log('  robo tunnel stop <id>    Stop a specific tunnel')
	logger.log('  robo tunnel stop --all   Stop all running tunnels')
	logger.log('')
	logger.log('Use --help with any subcommand for more details.')
}
