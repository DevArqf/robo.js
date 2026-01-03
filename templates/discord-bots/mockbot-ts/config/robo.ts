import type { Config } from 'robo.js'

export default <Config>{
	clientOptions: {
		intents: ['Guilds', 'GuildMessages']
	},
	plugins: ['@robojs/mock', '@robojs/discordjs', '@robojs/server'],
	logger: {
		colorMap: true,
		// level: 'debug'
	},
	type: 'robo'
}
