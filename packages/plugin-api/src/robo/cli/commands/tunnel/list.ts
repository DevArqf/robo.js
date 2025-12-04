/**
 * List all running tunnels.
 *
 * Shows tunnel ID, port, URL, and uptime for each active tunnel.
 */
import { createCliCommandConfig } from 'robo.js'
import { TunnelRegistry } from '../../../../core/tunnel/registry.js'
import type { CliContext } from 'robo.js'

export const config = createCliCommandConfig({
	description: 'List all running tunnels',
	options: [
		{
			alias: '-v',
			name: '--verbose',
			description: 'Show debug output',
			type: 'boolean',
			default: false
		}
	]
} as const)

/**
 * Format milliseconds into a human-readable duration
 */
function formatAge(ms: number): string {
	const seconds = Math.floor(ms / 1000)
	const minutes = Math.floor(seconds / 60)
	const hours = Math.floor(minutes / 60)
	const days = Math.floor(hours / 24)

	if (days > 0) {
		return `${days}d ${hours % 24}h`
	}
	if (hours > 0) {
		return `${hours}h ${minutes % 60}m`
	}
	if (minutes > 0) {
		return `${minutes}m ${seconds % 60}s`
	}
	return `${seconds}s`
}

export default async function ({ options, logger }: CliContext<typeof config>) {
	const { verbose } = options

	// Enable debug output if verbose flag is set
	if (verbose) {
		logger.setup({ level: 'debug' })
	}
	const tunnels = await TunnelRegistry.getAll()

	if (tunnels.length === 0) {
		logger.info('No tunnels running')
		logger.info('Run `robo tunnel start` to start a new tunnel')
		return
	}

	logger.info(`Running tunnels (${tunnels.length}):\n`)
	logger.info('ID        PORT   AGE       URL')
	logger.info('\u2500'.repeat(70))

	for (const tunnel of tunnels) {
		const age = formatAge(Date.now() - tunnel.startedAt)
		const id = tunnel.id.padEnd(8)
		const port = String(tunnel.port).padEnd(6)
		const ageStr = age.padEnd(9)

		logger.info(`${id}  ${port} ${ageStr} ${tunnel.url}`)
	}

	logger.info('')
	logger.info('Run `robo tunnel stop <id>` to stop a specific tunnel')
	logger.info('Run `robo tunnel stop --all` to stop all tunnels')
}
