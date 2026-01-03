/**
 * API Utilities
 *
 * Provides helpers for making API calls from the Stage UI.
 * The API base path is derived from the current window location
 * to support various deployment configurations.
 */

/**
 * Get the plugin prefix from the current URL.
 *
 * The Stage UI is served at paths like:
 * - `/stage/` (no prefix)
 * - `/mock/stage/` (with prefix)
 * - `/some-custom-prefix/stage/` (custom prefix)
 *
 * @returns The prefix (e.g., '/mock') or empty string if no prefix
 */
export function getPluginPrefix(): string {
	if (typeof window === 'undefined') {
		return ''
	}

	const pathname = window.location.pathname

	// Find where /stage/ appears in the path
	const stageIndex = pathname.indexOf('/stage')
	if (stageIndex > 0) {
		// Extract the prefix before /stage
		return pathname.substring(0, stageIndex)
	}

	// No prefix found
	return ''
}

/**
 * Build a URL for a static asset with the proper prefix.
 * @param path - The asset path (e.g., '/avatars/0.png')
 */
export function assetUrl(path: string): string {
	const prefix = getPluginPrefix()
	// Ensure path starts with /
	const normalizedPath = path.startsWith('/') ? path : `/${path}`
	return `${prefix}${normalizedPath}`
}

/**
 * Get the API base path by detecting the plugin prefix from the current URL.
 *
 * The API is at the same prefix level as the Stage UI:
 * - `/api/` (no prefix)
 * - `/mock/api/` (with prefix)
 * - `/some-custom-prefix/api/` (custom prefix)
 */
export function getApiBasePath(): string {
	return `${getPluginPrefix()}/api`
}

/**
 * Build a full API URL for the given endpoint path.
 * @param path - The API endpoint path (e.g., '/control/tests/registry')
 */
export function apiUrl(path: string): string {
	const base = getApiBasePath()
	// Ensure path starts with /
	const normalizedPath = path.startsWith('/') ? path : `/${path}`
	return `${base}${normalizedPath}`
}

/**
 * Fetch from an API endpoint with automatic base path resolution.
 * @param path - The API endpoint path (e.g., '/control/tests/registry')
 * @param init - Fetch init options
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
	return fetch(apiUrl(path), init)
}

/**
 * Fetch JSON from an API endpoint with automatic base path resolution.
 * @param path - The API endpoint path (e.g., '/control/tests/registry')
 * @param init - Fetch init options
 */
export async function apiFetchJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
	const response = await apiFetch(path, init)
	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: 'Request failed' }))
		throw new Error(error.error || `HTTP ${response.status}`)
	}
	return response.json()
}
