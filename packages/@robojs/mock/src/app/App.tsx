import React from 'react'
import { useSession } from './hooks/useSession'
import { AppShell } from './components/layout/AppShell'
import { ConnectionScreen } from './components/layout/ConnectionScreen'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { KeyboardShortcuts } from './components/common/KeyboardShortcuts'
import { Modal } from './components/modals/Modal'
import './styles/discord-theme.css'
import './styles/globals.css'

export default function App() {
	const { isConnected, sessionId, activeModal, submitModal, closeModal } = useSession()

	// Show connection screen if not connected
	if (!isConnected || !sessionId) {
		return (
			<ErrorBoundary>
				<ConnectionScreen />
			</ErrorBoundary>
		)
	}

	// Handle modal submission
	const handleModalSubmit = async (customId: string, components: Parameters<typeof submitModal>[1]) => {
		await submitModal(customId, components)
		closeModal()
	}

	// Show main app shell when connected
	return (
		<ErrorBoundary>
			<KeyboardShortcuts />
			<AppShell />
			{activeModal && (
				<Modal
					modal={activeModal.modal}
					onClose={closeModal}
					onSubmit={handleModalSubmit}
				/>
			)}
		</ErrorBoundary>
	)
}
