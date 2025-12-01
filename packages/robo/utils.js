export { color, composeColors } from './dist/core/color.js'
export { cleanTempDir, getTempDir } from './dist/cli/utils/utils.js'

// Note: extractCommandOptions has been moved to @robojs/discordjs
// Import it from '@robojs/discordjs' instead of 'robo.js/utils.js'

import { Env } from './dist/core/env.js'

/**
 * @deprecated Use `Env.load()` instead.
 */
export async function loadEnv() {
	return Env.load()
}
