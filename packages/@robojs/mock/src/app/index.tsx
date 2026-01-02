import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { SessionProvider, WebSocketProvider } from './stores/sessionStore'
import { PlaybackProvider } from './stores/playbackStore'
import { ToasterProvider } from './components/common/Toaster'
import { DevToolsProvider } from './components/devtools/DevToolsPanel'
import { initDevReload } from '@robojs/server/client'
import { normalizeStageSessionId } from './utils'

// Initialize dev reload for hot reloading during development
initDevReload()

// Get initial session ID from URL query params or localStorage
function getInitialSessionId(): string | null {
	// Check URL query params first
	const urlParams = new URLSearchParams(window.location.search)
	const sessionParam = urlParams.get('session') || urlParams.get('token')

	if (sessionParam) {
		const cleanId = normalizeStageSessionId(sessionParam)
		localStorage.setItem('stage_session_id', cleanId)
		return cleanId
	}

	// Fall back to localStorage
	return localStorage.getItem('stage_session_id')
}

const initialSessionId = getInitialSessionId()
console.log('[Stage] Initial session ID from URL/localStorage:', initialSessionId)

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<ToasterProvider>
			<DevToolsProvider>
				<PlaybackProvider>
					<SessionProvider initialSessionId={initialSessionId}>
						<WebSocketProvider>
							<App />
						</WebSocketProvider>
					</SessionProvider>
				</PlaybackProvider>
			</DevToolsProvider>
		</ToasterProvider>
	</React.StrictMode>
)
