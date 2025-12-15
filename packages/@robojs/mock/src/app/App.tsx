import React, { useState, useEffect, useCallback } from 'react'
import { useSession } from './hooks/useSession'
import { AppShell } from './components/layout/AppShell'
import { ConnectionScreen } from './components/layout/ConnectionScreen'
import { ConnectionStatusOverlay } from './components/layout/ConnectionStatusOverlay'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { KeyboardShortcuts } from './components/common/KeyboardShortcuts'
import { Modal } from './components/modals/Modal'
import './styles/discord-theme.css'
import './styles/globals.css'

export default function App() {
	const { isConnected, sessionId, activeModal, submitModal, closeModal } = useSession()
	const [hasEverConnected, setHasEverConnected] = useState(false)
	const [showConnectionScreen, setShowConnectionScreen] = useState(false)

	// Track when we first connect successfully
	useEffect(() => {
		if (isConnected && !hasEverConnected) {
			setHasEverConnected(true)
			setShowConnectionScreen(false)
		}
	}, [isConnected, hasEverConnected])

	// Handle "Change Session" - show connection screen overlay
	const handleChangeSession = useCallback(() => {
		setShowConnectionScreen(true)
	}, [])

	// Handle modal submission
	const handleModalSubmit = async (customId: string, components: Parameters<typeof submitModal>[1]) => {
		await submitModal(customId, components)
		closeModal()
	}

	// Show connection screen if never connected, or if user explicitly requested it
	if ((!hasEverConnected && (!isConnected || !sessionId)) || showConnectionScreen) {
		return (
			<ErrorBoundary>
				{hasEverConnected ? (
					// Show as overlay on top of existing UI
					<>
						<KeyboardShortcuts />
						<AppShell />
						<div style={{ position: 'fixed', inset: 0, background: 'var(--background-tertiary)', zIndex: 9998 }}>
							<ConnectionScreen />
						</div>
					</>
				) : (
					<ConnectionScreen />
				)}
			</ErrorBoundary>
		)
	}

	// Show main app shell when connected (or was previously connected)
	return (
		<ErrorBoundary>
			<KeyboardShortcuts />
			<ConnectionStatusOverlay onChangeSession={handleChangeSession} />
			<AppShell />
			{activeModal && <Modal modal={activeModal.modal} onClose={closeModal} onSubmit={handleModalSubmit} />}
		</ErrorBoundary>
	)
}
