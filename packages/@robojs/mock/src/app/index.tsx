import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { SessionProvider, WebSocketProvider } from './stores/sessionStore'

// Get initial session ID from URL query params or localStorage
function getInitialSessionId(): string | null {
	// Check URL query params first
	const urlParams = new URLSearchParams(window.location.search)
	const sessionParam = urlParams.get('session') || urlParams.get('token')

	if (sessionParam) {
		// Remove 'mock:' prefix if present for cleaner storage
		const cleanId = sessionParam.startsWith('mock:') ? sessionParam.slice(5) : sessionParam
		localStorage.setItem('stage_session_id', cleanId)
		return cleanId
	}

	// Fall back to localStorage
	return localStorage.getItem('stage_session_id')
}

const initialSessionId = getInitialSessionId()

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<SessionProvider initialSessionId={initialSessionId}>
			<WebSocketProvider>
				<App />
			</WebSocketProvider>
		</SessionProvider>
	</React.StrictMode>
)
