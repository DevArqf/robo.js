import { logger } from '../../core/logger.js'

// Register custom log levels BEFORE creating any forks
logger({
	customLevels: {
		typeerror: {
			label: 'typeerror',
			priority: 7,
			color: 'info'
		}
	}
})

export const compilerLogger = logger.fork('compiler')
