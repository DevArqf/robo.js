/**
 * Ping message utility for HMR dependency testing.
 * This module imports from deeper.ts to test deep dependency chains.
 */
import { formatMessage } from './deeper.js'

/**
 * Returns the ping response message.
 * Changes to this file should trigger HMR for handlers that import it.
 */
export function getPingMessage(): string {
	return formatMessage('Pong!')
}
