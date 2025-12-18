/**
 * Deep utility module for HMR dependency testing.
 * This module is imported by ping-message.ts to test deep dependency chains.
 */

/**
 * Formats a message by returning it as-is.
 * Used to test that changes to this file propagate through the dependency chain.
 */
export function formatMessage(text: string): string {
	return text
}
