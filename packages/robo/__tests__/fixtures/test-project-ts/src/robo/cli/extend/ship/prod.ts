import type { CliContext } from 'robo.js'

export const config = {
	description: 'Extension for ship prod command',
	priority: 5
}

export async function before(ctx: CliContext) {
	console.log('[ship prod extension] Checking shipping prerequisites...')

	// Example: could abort shipping under certain conditions
	// Return false to abort command execution
	return true
}

export async function after(ctx: CliContext) {
	console.log('[ship prod extension] Shipping completed:', ctx.result)
}
