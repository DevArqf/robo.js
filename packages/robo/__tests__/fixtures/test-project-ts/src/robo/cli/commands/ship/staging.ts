import type { CliContext } from 'robo.js'

export const config = {
	description: 'Ship to staging environment',
	options: [
		{ alias: '-b', name: '--branch', description: 'Branch to ship', type: 'string', default: 'main' }
	]
}

export default function shipStaging(ctx: CliContext) {
	const branch = ctx.options.branch as string

	console.log(`Shipping to staging from branch: ${branch}`)

	return { environment: 'staging', branch }
}
