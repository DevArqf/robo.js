import type { Config } from 'robo.js'

export default <Config>{
	experimental: {
		disableBot: true
	},
	plugins: ['@robojs/patch', '@robojs/server', '@robojs/sync'],
	type: 'robo',
	watcher: {
		ignore: ['src/app', 'src/components', 'src/hooks', 'src/config']
	}
}
