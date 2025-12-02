import { createCliCommandConfig, type CliContext } from 'robo.js/cli.js'

export const config = createCliCommandConfig({
	description: 'Ship to production environment',
	options: [
		{ alias: '-f', name: '--force', description: 'Force shipping', type: 'boolean' },
		{ alias: '-t', name: '--tag', description: 'Release tag', type: 'string', required: true }
	]
} as const)

export default function shipProd(ctx: CliContext<typeof config>) {
	// TypeScript knows: tag is string (required), force is boolean | undefined
	console.log(`Shipping to production with tag: ${ctx.options.tag}`)
	if (ctx.options.force) {
		console.log('Force mode enabled')
	}

	return { environment: 'production', tag: ctx.options.tag, force: ctx.options.force ?? false }
}
