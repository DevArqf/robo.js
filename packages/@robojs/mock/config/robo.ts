import type { Config } from 'robo.js'

export default <Config>{
	type: 'plugin',
	watcher: {
		ignore: ['src/app', 'src/components', 'src/hooks']
	}
}
