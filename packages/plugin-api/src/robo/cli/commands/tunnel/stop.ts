/**
 * Stop a running tunnel.
 *
 * Can stop a specific tunnel by ID or all running tunnels with --all.
 */
import { createCliCommandConfig } from 'robo.js'
import { TunnelRegistry } from '../../../../core/tunnel/registry.js'
import type { CliContext } from 'robo.js'

export const config = createCliCommandConfig({
	description: 'Stop a running tunnel',
	options: [
		{
			alias: '-a',
			name: '--all',
			description: 'Stop all running tunnels',
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

export default async function ({ args, options, logger }: CliContext<typeof config>) {
	const { all, verbose } = options

	// Enable debug output if verbose flag is set
	if (verbose) {
		logger.setup({ level: 'debug' })
	}
	const [tunnelId] = args

	if (all) {
		const tunnels = await TunnelRegistry.getAll()
		if (tunnels.length === 0) {
			logger.info('No tunnels running')
			return
		}

		const count = await TunnelRegistry.killAll()
		logger.info(`Stopped ${count} tunnel${count === 1 ? '' : 's'}`)
		return
	}

	if (!tunnelId) {
		logger.error('Please provide a tunnel ID or use --all')
		logger.info('Run `robo tunnel list` to see running tunnels')
		return
	}

	const success = await TunnelRegistry.kill(tunnelId)
	if (success) {
		logger.info(`Stopped tunnel ${tunnelId}`)
	} else {
		logger.error(`Tunnel ${tunnelId} not found or already stopped`)
	}
}
