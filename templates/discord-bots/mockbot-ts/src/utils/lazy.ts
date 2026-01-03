/**
 * Lazy-loaded utility module for HMR dynamic import testing.
 * This module is dynamically imported by commands/lazy.ts.
 */

/**
 * Returns a message for the lazy-loaded command.
 * Changes to this file should trigger HMR for handlers that dynamically import it.
 */
export function getLazyMessage(): string {
	return 'Lazy loaded!'
}
