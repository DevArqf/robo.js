/**
 * Tunnel Utilities
 *
 * Pure utility functions for tunnel operations.
 * Extracted for testability.
 */

/**
 * Check if a process is still alive by sending signal 0
 */
export function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0)
		return true
	} catch {
		return false
	}
}

/**
 * Generate a short random ID for tunnel identification
 */
export function generateId(): string {
	return Math.random().toString(36).substring(2, 8)
}

/**
 * Format milliseconds into a human-readable duration
 */
export function formatAge(ms: number): string {
	const seconds = Math.floor(ms / 1000)
	const minutes = Math.floor(seconds / 60)
	const hours = Math.floor(minutes / 60)
	const days = Math.floor(hours / 24)

	if (days > 0) {
		return `${days}d ${hours % 24}h`
	}
	if (hours > 0) {
		return `${hours}h ${minutes % 60}m`
	}
	if (minutes > 0) {
		return `${minutes}m ${seconds % 60}s`
	}
	return `${seconds}s`
}

/**
 * Extract a trycloudflare.com tunnel URL from cloudflared output.
 * Used for quick tunnels (non-configured domains).
 */
export function extractTunnelUrl(output: string): string | null {
	const regex = /https:\/\/[a-zA-Z0-9.-]*\.trycloudflare.com/
	const match = output.match(regex)
	return match ? match[0] : null
}
