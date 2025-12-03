/**
 * Build complete hook for testing build hook compilation
 */
import type { BuildCompleteContext } from 'robo.js'

export default function buildComplete(context: BuildCompleteContext): void {
	context.logger.debug('Build complete hook executed')
	const started = context.store.get('buildStarted')
	if (started) {
		context.logger.debug('Build store verified - start hook ran first')
	}
}
