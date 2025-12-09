import { useSession } from './hooks/useSession'
import { AppShell } from './components/layout/AppShell'
import { ConnectionScreen } from './components/layout/ConnectionScreen'
import './styles/discord-theme.css'
import './styles/globals.css'

export default function App() {
	const { isConnected, sessionId } = useSession()

	// Show connection screen if not connected
	if (!isConnected || !sessionId) {
		return <ConnectionScreen />
	}

	// Show main app shell when connected
	return <AppShell />
}
