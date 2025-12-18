import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { SessionProvider, WebSocketProvider } from './stores/sessionStore'
import { PlaybackProvider } from './stores/playbackStore'
import { UnifiedSelectionProvider } from './stores/unifiedSelectionStore'
import { ToasterProvider } from './components/common/Toaster'
import { DevToolsProvider } from './components/devtools/DevToolsPanel'
import { initDevReload } from '@robojs/server/client'

// Initialize dev reload for hot reloading during development
initDevReload()

// Check for test results viewing mode via URL params
function isTestResultsMode(): boolean {
	const urlParams = new URLSearchParams(window.location.search)
	return urlParams.get('tests') === 'true' || urlParams.get('testResults') === 'true'
}

// Get initial session ID from URL query params or localStorage
function getInitialSessionId(): string | null {
	// Check URL query params first
	const urlParams = new URLSearchParams(window.location.search)
	const sessionParam = urlParams.get('session') || urlParams.get('token')

	if (sessionParam) {
		// Remove 'mock:' prefix if present for cleaner storage
		// Also strip trailing slashes that may come from server redirects
		let cleanId = sessionParam.startsWith('mock:') ? sessionParam.slice(5) : sessionParam
		cleanId = cleanId.replace(/\/+$/, '')
		localStorage.setItem('stage_session_id', cleanId)
		return cleanId
	}

	// Fall back to localStorage
	return localStorage.getItem('stage_session_id')
}

const initialSessionId = getInitialSessionId()
const testResultsMode = isTestResultsMode()
console.log('[Stage] Initial session ID from URL/localStorage:', initialSessionId)
if (testResultsMode) {
	console.log('[Stage] Test results viewing mode enabled')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<ToasterProvider>
			<DevToolsProvider initialTab={testResultsMode ? 'tests' : undefined} autoOpen={testResultsMode}>
				<PlaybackProvider>
					<UnifiedSelectionProvider>
						<SessionProvider initialSessionId={initialSessionId}>
							<WebSocketProvider>
								<App testResultsMode={testResultsMode} />
							</WebSocketProvider>
						</SessionProvider>
					</UnifiedSelectionProvider>
				</PlaybackProvider>
			</DevToolsProvider>
		</ToasterProvider>
	</React.StrictMode>
)
