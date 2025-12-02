import type { CliContext } from 'robo.js'

export const config = {
	description: 'Greet someone by name',
	options: [
		{ alias: '-n', name: '--name', description: 'Name to greet', type: 'string', default: 'World' },
		{ alias: '-l', name: '--loud', description: 'Use uppercase', type: 'boolean' }
	]
}

export default function greet(ctx: CliContext) {
	const name = ctx.options.name as string
	const loud = ctx.options.loud as boolean

	const message = `Hello, ${name}!`
	console.log(loud ? message.toUpperCase() : message)

	return { greeted: name, loud }
}
