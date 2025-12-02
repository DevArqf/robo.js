import { createCliCommandConfig, type CliContext } from 'robo.js/cli.js'

export const config = createCliCommandConfig({
	description: 'Ship to staging environment',
	options: [
		{ alias: '-b', name: '--branch', description: 'Branch to ship', type: 'string', default: 'main' }
	]
} as const)

export default function shipStaging(ctx: CliContext<typeof config>) {
	// TypeScript knows: branch is string (has default)
	console.log(`Shipping to staging from branch: ${ctx.options.branch}`)

	return { environment: 'staging', branch: ctx.options.branch }
}
