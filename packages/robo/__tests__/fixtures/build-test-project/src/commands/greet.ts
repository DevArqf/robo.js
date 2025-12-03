/**
 * Greet command with options for testing
 */
export const config = {
	description: 'Greet someone',
	options: [
		{
			name: 'name',
			description: 'Name to greet',
			type: 'string'
		}
	]
}

interface GreetOptions {
	name?: string
}

export default function greet(options: GreetOptions): string {
	return `Hello, ${options.name ?? 'World'}!`
}
