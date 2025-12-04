/**
 * Build transform hook for @robojs/dev
 * Strips dev commands from production builds
 */
import type { BuildTransformContext, ProcessedEntry } from 'robo.js'

export default function (entries: ProcessedEntry[], context: BuildTransformContext): ProcessedEntry[] {
	const { mode, logger } = context

	// Only filter in production mode
	if (mode !== 'production') {
		return entries
	}

	const originalCount = entries.length
	const filtered = entries.filter((entry) => {
		// Remove all entries from this plugin in production
		const isDevPlugin = entry.path.includes('plugin-devtools') || entry.path.includes('@robojs/dev')

		if (isDevPlugin) {
			logger.debug(`Stripping dev entry: ${entry.key}`)
		}

		return !isDevPlugin
	})

	const strippedCount = originalCount - filtered.length
	if (strippedCount > 0) {
		logger.info(`Stripped ${strippedCount} dev entries from production build`)
	}

	return filtered
}
