import type { Config } from 'robo.js'

export default {
	type: 'robo',
	clientOptions: {
		intents: ['Guilds', 'GuildMessages']
	},
	plugins: ['@robojs/mock']
} satisfies Config
