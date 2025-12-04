/**
 * Error hook - forwards unhandled errors to Discord debug channel
 */
import { sendDebugError } from '../core/debug.js'
import { devLogger } from '../core/helpers.js'
import type { ErrorContext } from 'robo.js'

export default async function (context: ErrorContext) {
	const { error, type } = context

	devLogger.debug(`Received ${type} error, forwarding to debug channel...`)

	const sent = await sendDebugError(error)
	if (sent) {
		devLogger.debug('Error forwarded to debug channel')
	}
}
