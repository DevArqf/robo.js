import type { CliContext } from 'robo.js'

export const config = {
	description: 'Ship commands for managing releases'
}

export default function ship(ctx: CliContext) {
	console.log('Ship: Use a subcommand like "ship prod" or "ship staging"')
}
