import { createCliCommandConfig, type CliContext } from 'robo.js/cli.js'

export const config = createCliCommandConfig({
	description: 'Greet someone by name',
	options: [
		{ alias: '-n', name: '--name', description: 'Name to greet', type: 'string', default: 'World' },
		{ alias: '-l', name: '--loud', description: 'Use uppercase', type: 'boolean' }
	]
} as const)

export default function greet(ctx: CliContext<typeof config>) {
	// TypeScript knows: name is string (has default), loud is boolean | undefined
	const message = `Hello, ${ctx.options.name}!`
	console.log(ctx.options.loud ? message.toUpperCase() : message)

	return { greeted: ctx.options.name, loud: ctx.options.loud ?? false }
}
