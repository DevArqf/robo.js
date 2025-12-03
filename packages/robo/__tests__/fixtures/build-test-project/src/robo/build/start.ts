/**
 * Build start hook for testing build hook compilation
 */
import type { BuildContext } from 'robo.js'

export default function buildStart(context: BuildContext): void {
	context.logger.debug('Build start hook executed')
	context.store.set('buildStarted', true)
}
