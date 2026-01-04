/**
 * CLI Extension for `robo dev` command
 *
 * Adds force registration option:
 * - --force (-f): Force re-registration of Discord commands even if unchanged
 */
import type { CliExtendConfig, CliBeforeHook } from 'robo.js'

export const config: CliExtendConfig = {
	options: [
		{
			alias: '-f',
			name: '--force',
			description: 'Force re-registration of Discord commands even if unchanged',
			type: 'boolean'
		}
	]
}

export const before: CliBeforeHook = async (ctx) => {
	const { force } = ctx.options as { force?: boolean }

	if (force) {
		process.env.DISCORD_FORCE_REGISTER = 'true'
		ctx.logger.debug('Force registration enabled via --force flag')
	}
}
