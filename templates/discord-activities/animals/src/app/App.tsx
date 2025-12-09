import { DiscordContextProvider } from '../hooks/useDiscordSdk'
import { SyncContextProvider } from '@robojs/sync'
import { Activity } from './Activity'
import './App.css'
import { useMemo, useEffect, useState } from 'react'

/**
 * Set `authenticate` to true to enable Discord authentication.
 * You can also set the `scope` prop to request additional permissions.
 *
 * ```
 * <DiscordContextProvider authenticate scope={['identify', 'guilds']}>
 *  <Activity />
 * </DiscordContextProvider>
 * ```
 *
 * Learn more:
 * https://robojs.dev/discord-activities/authentication
 */
export default function App() {
	// Generate a stable random ID for local testing (persists across rerenders)
	const localUserId = useMemo(() => `local-${Math.random().toString(36).substring(7)}`, [])
	const [syncReady, setSyncReady] = useState(false)

	// Initialize sync WebSocket handler on mount
	useEffect(() => {
		const initSync = async () => {
			try {
				console.log('[App] Initializing sync handler...')
				const response = await fetch('/api/init-sync')
				const result = await response.json()
				console.log('[App] Sync init result:', result)
				setSyncReady(true)
			} catch (error) {
				console.error('[App] Failed to initialize sync:', error)
				// Still set ready to avoid blocking the app
				setSyncReady(true)
			}
		}
		initSync()
	}, [])

	if (!syncReady) {
		return (
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
				<p>Initializing...</p>
			</div>
		)
	}

	return (
		<DiscordContextProvider authenticate scope={['identify', 'guilds']}>
			<SyncContextProvider
				clientData={{
					localUserId,
					username: 'LocalPlayer'
				}}
			>
				<Activity />
			</SyncContextProvider>
		</DiscordContextProvider>
	)
}
