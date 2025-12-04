import type { Config } from 'robo.js'

export default <Config>{
	type: 'robo',
	watcher: {
		ignore: ['src/app', 'src/components', 'src/hooks']
	}
}
