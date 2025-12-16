/**
 * Dev Reload Client
 *
 * Connects to the @robojs/server dev reload WebSocket and reloads the page
 * when plugin frontend assets change during development.
 *
 * Usage in plugin frontends:
 * ```typescript
 * import { initDevReload } from '@robojs/server/client'
 * initDevReload()
 * ```
 */

const DEV_RELOAD_PATH = '/__robo/ui-reload'

interface ReloadMessage {
	type: 'reload'
	plugin?: string
	timestamp: number
}

/**
 * Initialize the dev reload client.
 *
 * Connects to the dev reload WebSocket and reloads the page when assets change.
 * Silently fails in production or if WebSocket is unavailable.
 *
 * @param pluginName - Optional plugin name to filter reload messages.
 *                     If provided, only reloads when that specific plugin changes.
 */
export function initDevReload(pluginName?: string): void {
	// Skip in SSR or non-browser environments
	if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
		return
	}

	// Don't spam console in production
	const isDev = process.env.NODE_ENV !== 'production'

	try {
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
		const wsUrl = `${protocol}//${window.location.host}${DEV_RELOAD_PATH}`

		const ws = new WebSocket(wsUrl)

		ws.onopen = () => {
			if (isDev) {
				console.log('[Robo] Dev reload connected')
			}
		}

		ws.onmessage = (event) => {
			try {
				const message: ReloadMessage = JSON.parse(event.data)

				if (message.type === 'reload') {
					// If pluginName filter is set, only reload for that plugin
					if (pluginName && message.plugin && message.plugin !== pluginName) {
						return
					}

					if (isDev) {
						const source = message.plugin ? ` (${message.plugin})` : ''
						console.log(`[Robo] Assets changed${source}, reloading...`)
					}

					window.location.reload()
				}
			} catch {
				// Ignore parse errors
			}
		}

		ws.onerror = () => {
			// Silent fail - server might not support dev reload or we're in production
		}

		ws.onclose = () => {
			// Could implement reconnection logic here if needed
		}
	} catch {
		// Silent fail - WebSocket might be blocked or unavailable
	}
}
