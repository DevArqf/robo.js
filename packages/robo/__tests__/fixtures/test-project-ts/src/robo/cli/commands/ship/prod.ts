import type { CliContext } from 'robo.js'

export const config = {
	description: 'Ship to production environment',
	options: [
		{ alias: '-f', name: '--force', description: 'Force shipping', type: 'boolean' },
		{ alias: '-t', name: '--tag', description: 'Release tag', type: 'string', required: true }
	]
}

export default function shipProd(ctx: CliContext) {
	const force = ctx.options.force as boolean
	const tag = ctx.options.tag as string

	console.log(`Shipping to production with tag: ${tag}`)
	if (force) {
		console.log('Force mode enabled')
	}

	return { environment: 'production', tag, force }
}
